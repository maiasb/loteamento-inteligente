'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lot, LotStatus, Block } from '@/types';

interface LotSelectorProps {
  lots: Lot[];
  blocks?: Block[];
  onLotSelect?: (lot: Lot) => void;
  onMultipleSelect?: (lots: Lot[]) => void;
  onSingleLotClick?: (lot: Lot) => void;
  onLotEdit?: (lot: Lot) => void;
  onLotDelete?: (lotId: string) => void;
  onToggleLotStatus?: (lotId: string, currentStatus: LotStatus) => Promise<void>;
  onPlaceLot?: (lot: Lot) => void; // Callback para posicionar lote no mapa
  onRemoveLotPosition?: (lot: Lot) => void; // Callback para remover posição do lote no mapa
  selectedLotIds?: string[];
  allowMultipleSelection?: boolean;
  lotsPerRow?: number;
  reservations?: any[]; // Array de reservas para mostrar no tooltip
  userRole?: string; // Role do usuário para verificar permissões
  userId?: number | string; // ID do usuário para verificar se é responsável pela reserva
  isAdminContext?: boolean; // True quando usado na página /admin/map-details para permitir edição de lotes bloqueados
  externalViewingLot?: Lot | null; // Lote para visualizar vindo de fora (ex: clique no mapa)
  onCloseExternalViewing?: () => void; // Callback para fechar visualização externa
  multiSelectAction?: 'delete' | 'block' | 'unblock' | null; // Tipo de ação em lote ativa
}

export default function LotSelector({
  lots,
  blocks = [],
  onLotSelect,
  onMultipleSelect,
  onSingleLotClick,
  onLotEdit,
  onLotDelete,
  onToggleLotStatus,
  onPlaceLot,
  onRemoveLotPosition,
  selectedLotIds = [],
  allowMultipleSelection = false,
  lotsPerRow = 10,
  reservations = [],
  userRole,
  userId,
  isAdminContext = false,
  externalViewingLot = null,
  onCloseExternalViewing,
  multiSelectAction = null,
}: LotSelectorProps) {
  const router = useRouter();
  const [selectedLotForModal, setSelectedLotForModal] = useState<Lot | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Unifica visualização: usa externalViewingLot se fornecido, caso contrário selectedLotForModal
  const viewingLot = externalViewingLot || selectedLotForModal;
  
  // Buscar reserva quando externalViewingLot mudar
  React.useEffect(() => {
    if (externalViewingLot && (externalViewingLot.status === LotStatus.RESERVED || externalViewingLot.status === LotStatus.SOLD)) {
      fetchLotReservation(externalViewingLot.id);
    }
  }, [externalViewingLot]);
  const [editedLot, setEditedLot] = useState<Lot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);
  const [pricePerM2Input, setPricePerM2Input] = useState<string>('');
  const [priceDisplay, setPriceDisplay] = useState<string>('');
  const [hoveredLot, setHoveredLot] = useState<Lot | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [lotReservation, setLotReservation] = useState<any | null>(null);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [lotToUnblock, setLotToUnblock] = useState<Lot | null>(null);
  
  // Função unificada para fechar modal
  const closeModal = () => {
    if (externalViewingLot && onCloseExternalViewing) {
      onCloseExternalViewing();
    } else {
      setSelectedLotForModal(null);
    }
    setIsEditing(false);
    setEditedLot(null);
    setLotReservation(null);
  };

  // Buscar reserva específica do lote via API
  const fetchLotReservation = async (lotId: string) => {
    try {
      // Buscar todas as reservas sem paginação para garantir que encontramos a do lote
      const response = await fetch(`/api/reservas?limit=1000`);
      const data = await response.json();
      
      // A API retorna: { reservations: [...], totalCount: N }
      let reservation = null;
      
      if (data.reservations && Array.isArray(data.reservations)) {
        // Buscar a reserva que contém este lote específico
        reservation = data.reservations.find((r: any) => {
          if (r.status === 'cancelled') return false;
          
          // Verificar se algum dos lotes desta reserva corresponde ao lotId
          const hasLot = r.lots?.some((l: any) => {
            return String(l.id) === String(lotId) || String(l.lot_id) === String(lotId);
          });
          
          return hasLot;
        });
      } else if (Array.isArray(data)) {
        // Formato alternativo: array direto
        reservation = data.find((r: any) => {
          if (r.status === 'cancelled') return false;
          return r.lots?.some((l: any) => 
            String(l.id) === String(lotId) || String(l.lot_id) === String(lotId)
          );
        });
      }
      
      setLotReservation(reservation || null);
    } catch (error) {
      console.error('Erro ao buscar reserva do lote:', error);
      setLotReservation(null);
    }
  };

  const sortedLots = [...lots].sort((a, b) => {
    const numA = parseInt(a.lotNumber) || 0;
    const numB = parseInt(b.lotNumber) || 0;
    return numA - numB;
  });

  const handleLotClick = (lot: Lot) => {
    // Vendedores NUNCA podem clicar em lotes bloqueados
    if (lot.status === LotStatus.BLOCKED && userRole === 'vendedor') {
      return;
    }

    // Admin/Dev clicando em lote bloqueado na página /maps
    // Só abre modal de confirmação se NÃO estiver em modo multi-select
    if (lot.status === LotStatus.BLOCKED && (userRole === 'admin' || userRole === 'dev') && !isAdminContext && !allowMultipleSelection) {
      setLotToUnblock(lot);
      setShowUnblockConfirm(true);
      return;
    }

    // Se está em modo multi-select
    if (allowMultipleSelection) {
      // No contexto admin, permite selecionar lotes disponíveis E bloqueados
      if (isAdminContext) {
        if (lot.status !== LotStatus.AVAILABLE && lot.status !== LotStatus.BLOCKED) {
          return; // Não permite selecionar lotes reservados ou vendidos
        }
      } else {
        // Na página /maps, só permite selecionar lotes disponíveis
        if (lot.status !== LotStatus.AVAILABLE) {
          return; // Não faz nada para lotes não disponíveis em modo multi-select
        }
      }
      // Notifica seleção múltipla
      if (onMultipleSelect) {
        onMultipleSelect([lot]);
      }
      return;
    }

    // Se está em modo single click (não multi-select) e tem handler específico
    // Mas APENAS em contexto não-admin (na página /maps por exemplo)
    if (!allowMultipleSelection && onSingleLotClick && lot.status === LotStatus.AVAILABLE && !isAdminContext) {
      onSingleLotClick(lot);
      return;
    }

    // Comportamento padrão: abrir modal para visualizar/editar
    // Admin pode editar, usuário comum só visualiza reservados/vendidos
    
    // Abre o modal para mostrar detalhes do lote
    setSelectedLotForModal(lot);

    // Se o lote está reservado ou vendido, buscar informações da reserva
    if (lot.status === LotStatus.RESERVED || lot.status === LotStatus.SOLD) {
      fetchLotReservation(lot.id);
    } else {
      setLotReservation(null);
    }

    // Garante que pricePerM2 está calculado se não existir
    const lotWithCalculatedPrice = {
      ...lot,
      pricePerM2: lot.pricePerM2 || (lot.size > 0 ? lot.price / lot.size : 0)
    };

    setEditedLot(lotWithCalculatedPrice);
    setPricePerM2Input(lotWithCalculatedPrice.pricePerM2.toFixed(2));
    setPriceDisplay(lotWithCalculatedPrice.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    // Permite editar apenas lotes disponíveis e bloqueados
    setIsEditing(!!onLotEdit && (lot.status === LotStatus.AVAILABLE || lot.status === LotStatus.BLOCKED));
  };

  const handleAddLot = () => {
    if (!viewingLot) return;

    if (allowMultipleSelection && onMultipleSelect) {
      // Apenas notificar qual lote foi clicado para toggle
      onMultipleSelect([viewingLot]);
    } else if (onLotSelect) {
      onLotSelect(viewingLot);
    } 

    closeModal();
  };

  const handleToggleBlockStatus = async () => {
    if (!selectedLotForModal) return;
    if (!onToggleLotStatus) return; // Só funciona se onToggleLotStatus estiver disponível

    const newStatus = selectedLotForModal.status === LotStatus.BLOCKED ? LotStatus.AVAILABLE : LotStatus.BLOCKED;

    // Se está desbloqueando, pedir confirmação
    if (selectedLotForModal.status === LotStatus.BLOCKED) {
      if (!confirm(`Deseja desbloquear o lote ${selectedLotForModal.lotNumber}?`)) {
        return;
      }
    }

    setIsTogglingBlock(true);
    try {
      // Usar função específica de toggle
      await onToggleLotStatus(selectedLotForModal.id, selectedLotForModal.status);
      // Atualizar o lote no modal
      setSelectedLotForModal({
        ...selectedLotForModal,
        status: newStatus,
      });
      
      // Mostrar mensagem de sucesso
      if (newStatus === LotStatus.BLOCKED) {
        alert(`Lote ${selectedLotForModal.lotNumber} bloqueado com sucesso!`);
      } else {
        alert(`Lote ${selectedLotForModal.lotNumber} desbloqueado com sucesso!`);
      }
    } catch (error) {
      console.error('Erro ao alterar status do lote:', error);
      alert('Erro ao alterar status do lote');
    } finally {
      setIsTogglingBlock(false);
    }
  };

  const getLotColor = (lot: Lot): string => {
    // Cores consistentes com o mapa para clara identificação de status
    switch (lot.status) {
      case LotStatus.AVAILABLE:
        return 'bg-green-500 hover:bg-green-600 border-green-600'; // Verde - Disponível
      case LotStatus.RESERVED:
        return 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600'; // Amarelo - Reservado
      case LotStatus.SOLD:
        return 'bg-red-500 hover:bg-red-600 border-red-600'; // Vermelho - Vendido
      case LotStatus.BLOCKED:
        return 'bg-gray-500 hover:bg-gray-600 border-gray-600'; // Cinza - Bloqueado
      default:
        return 'bg-gray-400 border-gray-500';
    }
  };

  const isLotClickable = (lot: Lot): boolean => {
    // Vendedores NUNCA podem clicar em lotes bloqueados
    if (lot.status === LotStatus.BLOCKED && userRole === 'vendedor') {
      return false;
    }
    
    // Em modo multi-select
    if (allowMultipleSelection) {
      // No contexto admin, permite clicar em disponíveis E bloqueados
      if (isAdminContext) {
        return lot.status === LotStatus.AVAILABLE || lot.status === LotStatus.BLOCKED;
      }
      // Na página /maps, apenas lotes disponíveis
      return lot.status === LotStatus.AVAILABLE;
    }
    
    // Em modo single-click, vendedores podem clicar em disponíveis, reservados e vendidos
    // (disponíveis para comprar, reservados/vendidos para ver detalhes)
    if (userRole === 'vendedor') {
      return lot.status === LotStatus.AVAILABLE || 
             lot.status === LotStatus.RESERVED || 
             lot.status === LotStatus.SOLD;
    }
    
    // Admin/Dev podem clicar em qualquer lote (para editar/visualizar)
    if (onLotEdit || onToggleLotStatus) return true;
    
    // Fallback: lotes bloqueados não são clicáveis
    if (lot.status === LotStatus.BLOCKED) return false;
    return true;
  };

  const handleMouseEnter = (lot: Lot, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setHoveredLot(lot);
  };

  const handleMouseLeave = () => {
    setHoveredLot(null);
  };

  const getReservationForLot = (lotId: string) => {
    // Buscar apenas reservas que não estejam canceladas
    return reservations.find(r => 
      r.status !== 'cancelled' &&
      r.lots?.some((l: any) => l.id === lotId || l.id === parseInt(lotId))
    );
  };

  const handleReservationClick = (reservation: any) => {
    if (reservation) {
      // Redirecionar para a página de reservas com o ID da reserva na URL
      router.push(`/reservations?reservationId=${reservation.id}`);
    }
  };

  const selectedLots = lots.filter(lot => selectedLotIds.includes(lot.id));
  const totalPrice = selectedLots.reduce((sum, lot) => sum + lot.price, 0);
  const totalSize = selectedLots.reduce((sum, lot) => sum + lot.size, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gray-800 rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
        <h3 className="text-white font-semibold mb-3 md:mb-4 text-center text-base md:text-lg">
          Selecione o(s) Lote(s)
        </h3>

        <div
          className="grid gap-1.5 sm:gap-2 justify-center relative"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${typeof window !== 'undefined' && window.innerWidth < 640 ? '45px' : '60px'}, 1fr))`,
            maxWidth: '100%',
          }}
        >
          {sortedLots.map((lot) => {
            const isSelected = selectedLotIds.includes(lot.id);
            const isClickable = isLotClickable(lot);
            const reservation = getReservationForLot(lot.id);

            return (
              <div
                key={lot.id}
                className="relative group"
              >
                {/* Botões de ação que aparecem no hover */}
                {isAdminContext && !allowMultipleSelection && (onLotDelete || onToggleLotStatus || onPlaceLot || onRemoveLotPosition) && (
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-row gap-1 opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-75 transition-all duration-200 origin-top">
                    
                    {/* Botão de posicionar no mapa */}
                    {onPlaceLot && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlaceLot(lot);
                        }}
                        className={`p-1.5 rounded-lg shadow-lg cursor-pointer transform hover:scale-110 transition-all ${
                          lot.lat != null && lot.lng != null
                            ? 'bg-yellow-500 hover:bg-yellow-600'
                            : 'bg-green-500 hover:bg-green-600'
                        }`}
                        title={lot.lat != null && lot.lng != null ? 'Reposicionar no mapa' : 'Posicionar no mapa'}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    )}

                    {/* Botão de remover posição do mapa */}
                    {onRemoveLotPosition && lot.lat != null && lot.lng != null && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveLotPosition(lot);
                        }}
                        className="p-1.5 bg-red-500 hover:bg-red-600 rounded-lg shadow-lg cursor-pointer transform hover:scale-110 transition-all"
                        title="Remover marcação do mapa"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4l16 16" />
                        </svg>
                      </button>
                    )}

                    {/* Botão de bloqueio/desbloqueio */}
                    {onToggleLotStatus && (lot.status === LotStatus.AVAILABLE || lot.status === LotStatus.BLOCKED) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLotStatus(lot.id, lot.status);
                        }}
                        className={`p-1.5 rounded-lg shadow-lg cursor-pointer transform hover:scale-110 transition-all ${
                          lot.status === LotStatus.BLOCKED 
                            ? 'bg-yellow-500 hover:bg-yellow-600' 
                            : 'bg-orange-500 hover:bg-orange-600'
                        }`}
                        title={lot.status === LotStatus.BLOCKED ? "Desbloquear lote" : "Bloquear lote"}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {lot.status === LotStatus.BLOCKED ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          )}
                        </svg>
                      </button>
                    )}
                    
                    {/* Botão de exclusão */}
                    {onLotDelete && (lot.status === LotStatus.AVAILABLE || lot.status === LotStatus.BLOCKED) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Tem certeza que deseja excluir o lote ${lot.lotNumber}?`)) {
                            onLotDelete(lot.id);
                          }
                        }}
                        className="p-1.5 bg-red-500 hover:bg-red-600 rounded-lg shadow-lg cursor-pointer transform hover:scale-110 transition-all"
                        title="Excluir lote"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                <div
                  className={`
                    aspect-square rounded-lg border-2
                    transition-all duration-200
                    flex items-center justify-center
                    min-h-[45px] sm:min-h-[60px]
                    ${getLotColor(lot)}
                    ${isClickable ? 'cursor-pointer active:scale-95 sm:hover:scale-105 touch-manipulation' : 'cursor-not-allowed opacity-70'}
                  `}
                  onClick={() => handleLotClick(lot)}
                  onMouseEnter={(e) => {
                    // Apenas mostrar tooltip em desktop (não mobile)
                    if (window.innerWidth >= 1024) {
                      handleMouseEnter(lot, e);
                    }
                  }}
                  onMouseLeave={handleMouseLeave}
                  title={`Lote ${lot.lotNumber} - ${lot.status}`}
                >
                  <span className="text-white font-bold text-xs sm:text-sm select-none">
                    {lot.lotNumber}
                  </span>
                  
                  {/* Indicador de seleção - apenas em modo multi-select */}
                  {allowMultipleSelection && (
                    multiSelectAction === 'block'
                      ? lot.status === LotStatus.AVAILABLE
                      : multiSelectAction === 'unblock'
                      ? lot.status === LotStatus.BLOCKED
                      : multiSelectAction === 'delete'
                      ? (isAdminContext
                          ? (lot.status !== LotStatus.RESERVED && lot.status !== LotStatus.SOLD)
                          : lot.status === LotStatus.AVAILABLE)
                      : (isAdminContext
                          ? (lot.status === LotStatus.AVAILABLE || lot.status === LotStatus.BLOCKED)
                          : lot.status === LotStatus.AVAILABLE)
                  ) && (
                    multiSelectAction === 'block' ? (
                      // Modo bloquear: cadeado fechado quando selecionado (só lotes disponíveis)
                      isSelected ? (
                        <div className="absolute top-0 right-0 w-5 h-5 rounded-bl-lg rounded-tr-lg flex items-center justify-center shadow-md bg-gray-600">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-sm transition-all duration-200" />
                      )
                    ) : multiSelectAction === 'unblock' ? (
                      // Modo desbloquear: cadeado aberto quando selecionado (só lotes bloqueados)
                      isSelected ? (
                        <div className="absolute top-0 right-0 w-5 h-5 rounded-bl-lg rounded-tr-lg flex items-center justify-center shadow-md bg-blue-600">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-sm transition-all duration-200" />
                      )
                    ) : (
                      // Modo delete ou padrão: lixeira ou checkmark
                      <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-200 ${
                        isSelected
                          ? multiSelectAction === 'delete'
                            ? 'bg-red-500 border-red-500'
                            : 'bg-blue-500 border-blue-500'
                          : 'bg-white/20 backdrop-blur-sm'
                      }`}>
                        {isSelected && (
                          multiSelectAction === 'delete' ? (
                            <svg className="w-full h-full text-white p-px" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          ) : (
                            <svg className="w-full h-full text-white p-px" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip com informações do lote */}
      {hoveredLot && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-gray-900 border-2 border-gray-700 rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[350px] animate-in fade-in duration-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <h4 className="text-white font-bold text-lg">Lote {hoveredLot.lotNumber}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  hoveredLot.status === LotStatus.AVAILABLE ? 'bg-green-500/20 text-green-300' :
                  hoveredLot.status === LotStatus.RESERVED ? 'bg-yellow-500/20 text-yellow-300' :
                  hoveredLot.status === LotStatus.SOLD ? 'bg-red-500/20 text-red-300' :
                  'bg-gray-500/20 text-gray-300'
                }`}>
                  {hoveredLot.status === LotStatus.AVAILABLE && 'Disponível'}
                  {hoveredLot.status === LotStatus.RESERVED && 'Reservado'}
                  {hoveredLot.status === LotStatus.SOLD && 'Vendido'}
                  {hoveredLot.status === LotStatus.BLOCKED && 'Bloqueado'}
                </span>
              </div>

              {hoveredLot.status === LotStatus.AVAILABLE && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-400">Área</p>
                      <p className="text-white font-semibold">{hoveredLot.size} m²</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Preço</p>
                      <p className="text-white font-semibold">R$ {hoveredLot.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  {hoveredLot.pricePerM2 && (
                    <div className="text-sm">
                      <p className="text-gray-400">Preço/m²</p>
                      <p className="text-white font-semibold">R$ {hoveredLot.pricePerM2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {hoveredLot.description && (
                    <div className="text-sm">
                      <p className="text-gray-400">Descrição</p>
                      <p className="text-white text-xs">{hoveredLot.description}</p>
                    </div>
                  )}
                </>
              )}

              {(hoveredLot.status === LotStatus.RESERVED || hoveredLot.status === LotStatus.SOLD) && (() => {
                const reservation = getReservationForLot(hoveredLot.id);
                const lotInReservation = reservation?.lots?.find(
                  (l: any) => l.id === hoveredLot.id || l.id === parseInt(hoveredLot.id)
                );
                const displayPrice = lotInReservation?.agreed_price 
                  ? Number(lotInReservation.agreed_price) 
                  : hoveredLot.price;
                
                return reservation ? (
                  <div className="space-y-2">
                    <div className="text-sm">
                      <p className="text-gray-400">Valor Acordado</p>
                      <p className="text-white font-semibold">R$ {displayPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-gray-400">Cliente</p>
                      <p className="text-white font-semibold">{reservation.customer_name}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-gray-400">Vendedor</p>
                      <p className="text-white">{reservation.seller_name}</p>
                    </div>
                    {reservation.created_at && (
                      <div className="text-sm">
                        <p className="text-gray-400">Data</p>
                        <p className="text-white">{new Date(reservation.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Sem informações de reserva disponíveis</p>
                );
              })()}

              {hoveredLot.status === LotStatus.BLOCKED && (
                <div className="text-sm space-y-2">
                  {(userRole === 'admin' || userRole === 'dev') ? (
                    // Admin/Dev: mostrar informações do lote
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-gray-400">Área</p>
                          <p className="text-white font-semibold">{hoveredLot.size} m²</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Preço</p>
                          <p className="text-white font-semibold">R$ {hoveredLot.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                      {hoveredLot.pricePerM2 && (
                        <div>
                          <p className="text-gray-400">Preço/m²</p>
                          <p className="text-white font-semibold">R$ {hoveredLot.pricePerM2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      )}
                      {hoveredLot.description && (
                        <div>
                          <p className="text-gray-400">Descrição</p>
                          <p className="text-white text-xs">{hoveredLot.description}</p>
                        </div>
                      )}
                      {!isAdminContext && (
                        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-2 mt-2">
                          <p className="text-blue-300 text-xs font-semibold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Clique para desbloquear
                          </p>
                        </div>
                      )}
                      {isAdminContext && (
                        <div className="bg-gray-500/20 border border-gray-500/30 rounded-lg p-2 mt-2">
                          <p className="text-gray-300 text-xs">Este lote está bloqueado</p>
                        </div>
                      )}
                    </>
                  ) : (
                    // Vendedor: apenas mensagem
                    <p className="text-gray-400">Este lote está bloqueado.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação para desbloquear lote */}
      {showUnblockConfirm && lotToUnblock && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-bg)] rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[var(--foreground)]">
                  Desbloquear Lote
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Lote {lotToUnblock.lotNumber}
                </p>
              </div>
            </div>
            
            <p className="text-[var(--foreground)] mb-6">
              Tem certeza que deseja desbloquear este lote? Ele ficará disponível para reservas.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUnblockConfirm(false);
                  setLotToUnblock(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg transition-colors bg-gray-500/20 text-gray-300 hover:bg-gray-500/30"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!onToggleLotStatus || !lotToUnblock) return;
                  
                  setIsTogglingBlock(true);
                  try {
                    await onToggleLotStatus(lotToUnblock.id, lotToUnblock.status);
                    setShowUnblockConfirm(false);
                    setLotToUnblock(null);
                    
                    // Mostrar mensagem de sucesso
                    alert(`Lote ${lotToUnblock.lotNumber} foi desbloqueado com sucesso!`);
                  } catch (error) {
                    console.error('Erro ao desbloquear lote:', error);
                    alert('Erro ao desbloquear o lote. Tente novamente.');
                  } finally {
                    setIsTogglingBlock(false);
                  }
                }}
                disabled={isTogglingBlock}
                className="flex-1 px-4 py-2 rounded-lg transition-colors bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTogglingBlock ? 'Desbloqueando...' : 'Desbloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalhes do lote */}
      {viewingLot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] rounded-2xl max-w-lg w-full shadow-2xl border border-[var(--border)] my-auto max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="p-4 sm:p-6 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
                  Lote {viewingLot.lotNumber}
                </h3>
                <div className="flex items-center gap-2">
                  {/* Botão de posicionar no mapa */}
                  {onPlaceLot && userRole !== 'seller' && !externalViewingLot && (
                    <button
                      onClick={() => {
                        onPlaceLot(viewingLot);
                        closeModal();
                      }}
                      className={`p-2 rounded-lg transition-colors touch-manipulation cursor-pointer ${
                        viewingLot.lat != null && viewingLot.lng != null
                          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                      title={viewingLot.lat != null && viewingLot.lng != null ? 'Reposicionar no mapa' : 'Posicionar no mapa'}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  {/* Botão de remover marcação do mapa */}
                  {onRemoveLotPosition && userRole !== 'seller' && !externalViewingLot && viewingLot.lat != null && viewingLot.lng != null && (
                    <button
                      onClick={() => {
                        onRemoveLotPosition(viewingLot);
                        closeModal();
                      }}
                      className="p-2 rounded-lg transition-colors touch-manipulation cursor-pointer bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      title="Remover marcação do mapa"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4l16 16" />
                      </svg>
                    </button>
                  )}
                  {/* Botão de bloquear/desbloquear apenas para administradores e desenvolvedores */}
                  {onToggleLotStatus && userRole !== 'seller' && !externalViewingLot && (viewingLot.status === LotStatus.AVAILABLE || viewingLot.status === LotStatus.BLOCKED) && (
                    <button
                      onClick={handleToggleBlockStatus}
                      disabled={isTogglingBlock}
                      className={`p-2 rounded-lg transition-colors touch-manipulation ${
                        viewingLot.status === LotStatus.BLOCKED
                          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 cursor-pointer'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white cursor-pointer'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={viewingLot.status === LotStatus.BLOCKED ? 'Desbloquear lote' : 'Bloquear lote'}
                    >
                      {isTogglingBlock ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          {viewingLot.status === LotStatus.BLOCKED ? (
                            <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                          ) : (
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          )}
                        </svg>
                      )}
                    </button>
                  )}
                  {/* Botão de excluir apenas para administradores e desenvolvedores */}
                  {onLotDelete && userRole !== 'seller' && !externalViewingLot && (viewingLot.status === LotStatus.AVAILABLE || viewingLot.status === LotStatus.BLOCKED) && (
                    <button
                      onClick={async () => {
                        if (confirm(`Tem certeza que deseja excluir o lote ${viewingLot.lotNumber}?`)) {
                          setIsDeleting(true);
                          try {
                            await onLotDelete(viewingLot.id);
                            closeModal();
                          } finally {
                            setIsDeleting(false);
                          }
                        }
                      }}
                      disabled={isDeleting}
                      className="p-2 rounded-lg transition-colors touch-manipulation bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Excluir lote"
                    >
                      {isDeleting ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                  <button
                    onClick={closeModal}
                    className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors p-2 -m-2 touch-manipulation"
                    aria-label="Fechar"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              {isEditing && editedLot && !externalViewingLot ? (
                // Modo de edição (apenas quando não é visualização externa)
                <>
                  <div>
                    <label className="block text-[var(--foreground)] text-sm mb-2">Número do Lote *</label>
                    <input
                      type="text"
                      value={editedLot.lotNumber}
                      onChange={(e) => setEditedLot({ ...editedLot, lotNumber: e.target.value })}
                      className="w-full px-4 py-3 sm:py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground)]/40 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                      placeholder="Ex: 01, A1, etc"
                    />
                  </div>

                  {blocks.length > 0 && (
                    <div>
                      <label className="block text-[var(--foreground)] text-sm mb-2">Quadra</label>
                      <select
                        value={editedLot.blockId || ''}
                        onChange={(e) => setEditedLot({ ...editedLot, blockId: e.target.value || undefined })}
                        className="w-full px-4 py-3 sm:py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-base cursor-pointer focus:ring-2 focus:ring-blue-500 touch-manipulation"
                      >
                        <option value="">Sem quadra</option>
                        {blocks.map((block) => (
                          <option key={block.id} value={block.id}>
                            {block.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[var(--foreground)] text-sm mb-2">Área (m²) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editedLot.size || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const newSize = value === '' ? 0 : parseFloat(value);
                        setEditedLot({
                          ...editedLot,
                          size: newSize
                        });
                      }}
                      className="w-full px-4 py-3 sm:py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground)]/40 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                      placeholder="300.00"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--foreground)] text-sm mb-2">Preço Total (R$) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--foreground)]/60 font-bold text-base">R$</span>
                      <input
                        type="text"
                        value={priceDisplay}
                        onChange={(e) => {
                          let value = e.target.value;
                          
                          // Remove tudo exceto dígitos
                          value = value.replace(/\D/g, '');
                          
                          if (value === '') {
                            setPriceDisplay('');
                            setEditedLot({
                              ...editedLot,
                              price: 0
                            });
                            return;
                          }
                          
                          // Adiciona zeros à esquerda se necessário
                          value = value.padStart(3, '0');
                          
                          // Separa centavos dos reais
                          const cents = value.slice(-2);
                          const reais = value.slice(0, -2);
                          
                          // Formata com separador de milhar
                          const formattedReais = parseInt(reais).toLocaleString('pt-BR');
                          const formattedValue = `${formattedReais},${cents}`;
                          
                          setPriceDisplay(formattedValue);
                          
                          // Converte para número decimal
                          const numericValue = parseFloat(`${reais}.${cents}`);
                          setEditedLot({
                            ...editedLot,
                            price: numericValue
                          });
                        }}
                        className="w-full pl-12 sm:pl-10 pr-4 py-3 sm:py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground)]/40 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                        placeholder="0,00"
                      />
                    </div>
                    <p className="text-xs text-[var(--foreground)]/60 mt-1">💡 Preencha manualmente o valor do lote</p>
                  </div>

                  <div>
                    <label className="block text-[var(--foreground)] text-sm mb-2">Descrição</label>
                    <textarea
                      value={editedLot.description || ''}
                      onChange={(e) => setEditedLot({ ...editedLot, description: e.target.value })}
                      className="w-full px-4 py-3 sm:py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground)]/40 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation resize-none"
                      rows={3}
                      placeholder="Informações adicionais sobre o lote"
                    />
                  </div>
                </>
              ) : (
                // Modo de visualização
                <>
                  {(viewingLot.status === LotStatus.RESERVED || viewingLot.status === LotStatus.SOLD) ? (
                    // Visualização mínima para lotes reservados/vendidos
                    (() => {
                      const reservation = getReservationForLot(viewingLot.id);
                      // Buscar agreed_price do lote na reserva
                      const lotInReservation = reservation?.lots?.find(
                        (l: any) => l.id === viewingLot.id || l.id === parseInt(viewingLot.id)
                      );
                      const displayPrice = lotInReservation?.agreed_price 
                        ? Number(lotInReservation.agreed_price) 
                        : viewingLot.price;
                      
                      return (
                        <>
                          <div className={`bg-[var(--surface)] rounded-xl p-4 border-l-4 ${
                            viewingLot.status === LotStatus.SOLD 
                              ? 'border-red-500' 
                              : 'border-yellow-500'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[var(--foreground)] font-bold text-lg">Informações do Lote</h4>
                              <span className={`px-3 py-1.5 rounded-full text-sm font-bold shadow-md border-2 ${
                                viewingLot.status === LotStatus.RESERVED 
                                  ? 'bg-yellow-500 text-white border-yellow-600' 
                                  : 'bg-red-500 text-white border-red-600'
                              }`}>
                                {viewingLot.status === LotStatus.RESERVED ? 'Reservado' : 'Vendido'}
                              </span>
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                                <span className="text-[var(--foreground)]/60 text-sm">Número do Lote</span>
                                <span className="text-[var(--foreground)] font-bold text-lg">{viewingLot.lotNumber}</span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                                <span className="text-[var(--foreground)]/60 text-sm">Área</span>
                                <span className="text-[var(--foreground)] font-semibold">{viewingLot.size} m²</span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                                <span className="text-[var(--foreground)]/60 text-sm">Valor Acordado</span>
                                <span className="text-[var(--foreground)] font-bold text-lg">
                                  R$ {displayPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {lotInReservation?.agreed_price && viewingLot.price !== Number(lotInReservation.agreed_price) && (
                                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                                  <span className="text-[var(--foreground)]/60 text-sm">Valor Base do Lote</span>
                                  <span className="text-[var(--foreground)]/60 text-sm">
                                    R$ {viewingLot.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                              {reservation && (
                                <div className="flex justify-between items-center py-2">
                                  <span className="text-[var(--foreground)]/60 text-sm">Comprador/Reservado por</span>
                                  <span className="text-[var(--foreground)] font-semibold">{reservation.customer_name}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {onLotEdit && (
                            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
                              <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <p className="font-bold text-orange-800 text-sm mb-1">⚠️ Lote com restrição</p>
                                  <p className="text-orange-700 text-sm">
                                    Este lote não pode ser editado ou excluído enquanto estiver {viewingLot.status === LotStatus.RESERVED ? 'reservado' : 'vendido'}. 
                                    Cancele a {viewingLot.status === LotStatus.RESERVED ? 'reserva' : 'venda'} primeiro na página de <strong>Reservas</strong>.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    // Visualização completa para lotes disponíveis/bloqueados
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-4">
                          <p className="text-[var(--foreground)]/60 text-xs sm:text-sm mb-1">Status</p>
                          <p className={`font-bold text-base sm:text-lg ${
                            viewingLot.status === LotStatus.AVAILABLE
                              ? 'text-green-400'
                              : 'text-gray-400'
                          }`}>
                            {viewingLot.status === LotStatus.AVAILABLE ? 'Disponível' : 'Bloqueado'}
                          </p>
                        </div>

                        <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-4">
                          <p className="text-[var(--foreground)]/60 text-xs sm:text-sm mb-1">Área</p>
                          <p className="font-bold text-base sm:text-lg text-[var(--foreground)]">{viewingLot.size}m²</p>
                        </div>
                      </div>

                      {viewingLot.blockId && blocks.length > 0 && (
                        <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-4">
                          <p className="text-[var(--foreground)]/60 text-xs sm:text-sm mb-1">Quadra</p>
                          <p className="font-bold text-base sm:text-lg text-[var(--foreground)]">
                            {blocks.find(b => b.id === viewingLot.blockId)?.name || 'Não identificada'}
                          </p>
                        </div>
                      )}

                      <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-4">
                        <p className="text-[var(--foreground)]/60 text-xs sm:text-sm mb-1">Valor Total</p>
                        <p className="font-bold text-xl sm:text-2xl text-[var(--foreground)]">
                          R$ {viewingLot.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {viewingLot.pricePerM2 && (
                          <p className="text-[var(--foreground)]/60 text-xs sm:text-sm mt-1">
                            R$ {viewingLot.pricePerM2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m²
                          </p>
                        )}
                      </div>

                      {viewingLot.description && (
                        <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-4">
                          <p className="text-[var(--foreground)]/60 text-xs sm:text-sm mb-2">Descrição</p>
                          <p className="text-[var(--foreground)] text-sm">{viewingLot.description}</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="sticky bottom-0 p-4 sm:p-6 border-t border-[var(--border)] flex gap-2 sm:gap-3 flex-shrink-0 bg-[var(--card-bg)] rounded-b-2xl">
              {/* Modal para lotes reservados/vendidos: apenas botão de redirecionar */}
              {(viewingLot.status === LotStatus.RESERVED || viewingLot.status === LotStatus.SOLD) ? (
                (() => {
                  const reservation = lotReservation; // Usar lotReservation buscado via API
                  
                  // Verificar se o usuário pode ver o botão de redirecionamento
                  const isAdmin = userRole === 'admin' || userRole === 'dev';
                  const isResponsibleSeller = reservation && userId && String(reservation.user_id) === String(userId);
                  const canViewReservation = isAdmin || isResponsibleSeller;
                  
                  return reservation && canViewReservation ? (
                    <button
                      onClick={() => {
                        handleReservationClick(reservation);
                        closeModal();
                      }}
                      className="flex-1 px-4 sm:px-6 py-3 text-base bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-xl transition-colors touch-manipulation flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Ir para {viewingLot.status === LotStatus.RESERVED ? 'Reserva' : 'Compra'}
                    </button>
                  ) : (
                    <button
                      onClick={closeModal}
                      className="flex-1 px-4 sm:px-6 py-3 text-base bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white font-semibold rounded-xl transition-colors touch-manipulation"
                    >
                      Fechar
                    </button>
                  );
                })()
              ) : (
                /* Modal para lotes disponíveis/bloqueados: botões normais */
                <>
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 sm:px-6 py-3 sm:py-3 text-base bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white font-semibold rounded-xl transition-colors touch-manipulation cursor-pointer"
                  >
                    Cancelar
                  </button>
                  {onLotEdit ? (
                    isEditing && editedLot ? (
                      <button
                        onClick={() => {
                          onLotEdit(editedLot);
                          closeModal();
                        }}
                        className="flex-1 px-4 sm:px-6 py-3 text-base bg-[var(--success)] hover:bg-[var(--success)]/90 active:bg-[var(--success)]/80 text-white font-semibold rounded-xl transition-colors touch-manipulation cursor-pointer"
                      >
                        Salvar Alterações
                      </button>
                    ) : (
                      <>
                        {(viewingLot.status === LotStatus.AVAILABLE || viewingLot.status === LotStatus.BLOCKED) && (
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              // Garante que pricePerM2 está calculado
                              const lotWithCalculatedPrice = {
                                ...viewingLot,
                                pricePerM2: viewingLot.pricePerM2 || (viewingLot.size > 0 ? viewingLot.price / viewingLot.size : 0)
                              };
                              setEditedLot(lotWithCalculatedPrice);
                              setPriceDisplay(lotWithCalculatedPrice.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                            }}
                            className="flex-1 px-4 sm:px-6 py-3 text-base bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-xl transition-colors touch-manipulation"
                          >
                            Editar Lote
                          </button>
                        )}
                      </>
                    )
                  ) : (
                    <button
                      onClick={handleAddLot}
                      className="flex-1 px-4 sm:px-6 py-3 text-base bg-[var(--success)] hover:bg-[var(--success-dark)] text-white font-semibold rounded-xl transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={viewingLot.status !== LotStatus.AVAILABLE}
                    >
                      {selectedLotIds.includes(viewingLot.id) ? 'Remover da Seleção' : 'Adicionar à Seleção'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {allowMultipleSelection && selectedLots.length > 0 && (
        <div className="bg-blue-500/30 border-2 border-blue-400 rounded-xl p-3 sm:p-4 shadow-lg">
          <h4 className="text-[var(--foreground)] font-bold mb-2 text-base sm:text-lg">
            Seleção Atual ({selectedLots.length} {selectedLots.length === 1 ? 'lote' : 'lotes'})
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-[var(--foreground)]/80 text-sm">
              <span>Lotes:</span>
              <span className="font-medium">
                {selectedLots.map(l => l.lotNumber).join(', ')}
              </span>
            </div>
            <div className="flex justify-between text-[var(--foreground)]/80 text-sm">
              <span>Área Total:</span>
              <span className="font-medium">{totalSize}m²</span>
            </div>
            <div className="flex justify-between text-[var(--foreground)] text-base sm:text-lg font-bold pt-2 border-t border-[var(--border)]">
              <span>Total:</span>
              <span>R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl p-3 sm:p-4 shadow-lg">
        <h3 className="text-[var(--foreground)]/80 font-semibold mb-3 text-base sm:text-lg">Legenda:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded flex-shrink-0"></div>
            <span className="text-[var(--foreground)]/80 text-xs sm:text-sm">Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-500 rounded flex-shrink-0"></div>
            <span className="text-[var(--foreground)]/80 text-xs sm:text-sm">Reservado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-500 rounded flex-shrink-0"></div>
            <span className="text-[var(--foreground)]/80 text-xs sm:text-sm">Vendido</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-500 rounded flex-shrink-0"></div>
            <span className="text-[var(--foreground)]/80 text-xs sm:text-sm">Bloqueado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
