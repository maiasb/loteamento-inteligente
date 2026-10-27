'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import InteractiveMap from '@/components/InteractiveMap';
import PublicMapViewer from '@/components/PublicMapViewer';
import LotSelector from '@/components/LotSelector';
import PurchaseModal from '@/components/PurchaseModal';
import { useMapSelection } from '@/hooks/useMapSelection';
import { Lot } from '@/types/Lot';
import { LotStatus } from '@/types/LotStatus';
import { ReservationSummary } from '@/types/ReservationSummary';
import { useAuth } from '@/contexts/AuthContext';
import { showAlert } from '@/hooks/useCustomAlert';

export default function AdminMapsLotsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    maps,
    blocks,
    selectedBlock,
    lots,
    selectedMap,
    selectedLots, // Mudado de selectedLot para selectedLots
    viewingLot,
    showPurchaseModal,
    isLoading,
    isLoadingBlocks,
    isLoadingLots,
    isLoadingImage,
    handleLotClick,
    handleToggleLotSelection, // Nova função para adicionar/remover da lista
    handleOpenPurchaseModal, // Nova função
    handleClearSelection, // Nova função
    handlePurchaseSuccess,
    handlePurchaseClose,
    handleViewClose,
    selectMap,
    selectBlock,
    isLotSelected, // Helper para verificar se está selecionado
  } = useMapSelection();

  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [mapStats, setMapStats] = useState({
    available: 0,
    reserved: 0,
    sold: 0,
    blocked: 0,
    total: 0,
  });
  const [isLoadingMapStats, setIsLoadingMapStats] = useState(false);
  const loadedStatsForMapRef = useRef<string | null>(null);
  const loadedReservationsForBlockRef = useRef<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [singleLotPurchase, setSingleLotPurchase] = useState<Lot | null>(null);
  const [clickedLot, setClickedLot] = useState<Lot | null>(null); // Lote clicado no mapa

  // Função para carregar estatísticas do mapa
  const loadMapStats = async (forceReload = false) => {
    if (!selectedMap?.id) {
      setMapStats({ available: 0, reserved: 0, sold: 0, blocked: 0, total: 0 });
      loadedStatsForMapRef.current = null;
      return;
    }

    // Evitar carregar se já foi carregado para este mapa (a menos que seja forceReload)
    if (!forceReload && loadedStatsForMapRef.current === selectedMap.id) {
      return;
    }

    loadedStatsForMapRef.current = selectedMap.id;
    setIsLoadingMapStats(true);
    try {
      const response = await axios.get('/api/mapas/estatisticas/', {
        params: { mapId: selectedMap.id },
        timeout: 30000,
        maxRedirects: 5,
      });

      if (response.data) {
        setMapStats(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas do mapa:', error);
      setMapStats({ available: 0, reserved: 0, sold: 0, blocked: 0, total: 0 });
    } finally {
      setIsLoadingMapStats(false);
    }
  };

  // Carregar estatísticas quando o mapa muda
  useEffect(() => {
    loadMapStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMap?.id]);

  // Função para buscar reservas (apenas dados mínimos para redirecionamento)
  const fetchReservations = async () => {
    if (!selectedBlock?.id) return;

    try {
      // Buscar apenas reservas da quadra selecionada
      const response = await axios.get('/api/reservas/', {
        params: {
          minimal: true,
          redirectOnly: true,
          blockId: selectedBlock.id, // Filtrar apenas reservas desta quadra
        },
        timeout: 30000,
        maxRedirects: 5,
      });
      setReservations(response.data);
    } catch (error) {
      console.error('Erro ao buscar reservas:', error);
    }
  };

  // Recarregar reservas quando a quadra mudar
  useEffect(() => {
    if (selectedBlock?.id) {
      // Evitar carregar se já foi carregado para esta quadra
      if (loadedReservationsForBlockRef.current !== selectedBlock.id) {
        loadedReservationsForBlockRef.current = selectedBlock.id;
        fetchReservations();
      }
    } else {
      setReservations([]);
      loadedReservationsForBlockRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlock?.id]);

  // Recarregar estatísticas sempre que os lotes mudarem
  useEffect(() => {
    if (selectedMap?.id && lots.length > 0) {
      loadMapStats(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots.length, lots]);

  // Função para quando clicar em um único lote (sem multi-select)
  const handleSingleLotClick = (lot: Lot) => {
    if (lot.status === LotStatus.AVAILABLE) {
      setSingleLotPurchase(lot);
    }
  };

  // Função para fechar modal de compra única
  const handleSinglePurchaseClose = () => {
    setSingleLotPurchase(null);
  };

  // Função para sucesso na compra única
  const handleSinglePurchaseSuccess = async (reservationId?: string) => {
    setSingleLotPurchase(null);
    handlePurchaseSuccess(reservationId);

    // Redirecionar para a página da reserva se o ID for retornado
    if (reservationId) {
      // Mostrar mensagem de sucesso
      showAlert({
        title: 'Reserva Criada!',
        message: 'Sua reserva foi registrada e você será redirecionado para visualizá-la.',
        type: 'success',
      });

      // Aguardar um pouco para garantir que a reserva foi salva no banco
      await new Promise((resolve) => setTimeout(resolve, 800));
      router.push(`/reservations?reservationId=${reservationId}`);
    } else {
      // Recarregar reservas e estatísticas após sucesso
      setTimeout(() => {
        fetchReservations();
        loadMapStats(true);
      }, 500);
    }
  };

  // Função para bloquear/desbloquear lote
  const handleToggleLotStatus = async (lotId: string, currentStatus: LotStatus) => {
    try {
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) {
        throw new Error('Lote não encontrado');
      }

      const newStatus =
        currentStatus === LotStatus.BLOCKED ? LotStatus.AVAILABLE : LotStatus.BLOCKED;

      // Atualizar via API
      await axios.patch('/api/mapas/lotes/atualizar/', {
        id: lot.id,
        mapId: lot.mapId,
        blockId: lot.blockId,
        lotNumber: lot.lotNumber,
        status: newStatus,
        price: lot.price,
        size: lot.size,
        description: lot.description,
        features: lot.features,
      });

      // Recarregar lotes para refletir a mudança
      if (selectedBlock) {
        selectBlock(selectedBlock.id);
      }
    } catch (error) {
      console.error('Erro ao alterar status do lote:', error);
      throw error;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-auto min-h-screen lg:h-screen overflow-y-auto lg:overflow-hidden">
      {/* Sidebar à esquerda */}
      <div className="w-full lg:w-[420px] xl:w-[480px] flex-shrink-0 bg-[var(--card-bg)] border-r border-[var(--border)] lg:overflow-y-auto">
        <div className="p-6">
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Loteamentos</h1>
            </div>

            {!isLoading && maps.length === 0 && (
              <div className="text-center py-12 bg-[var(--card-bg)] rounded-2xl border-2 border-dashed border-[var(--accent)]/40 shadow-[var(--shadow-md)]">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)]/20 rounded-full mb-4 shadow-md">
                  <svg
                    className="w-8 h-8 text-[var(--accent)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <p className="text-[var(--foreground)] text-lg font-semibold mb-2">
                  Nenhum loteamento cadastrado
                </p>
                <p className="text-[var(--foreground)]/80 text-sm font-medium mb-4">
                  Acesse a página de gerenciamento para criar um novo loteamento
                </p>
                <button
                  onClick={() => (window.location.href = '/map-details')}
                  className="px-6 py-3 bg-[var(--accent)] text-[#1c1c1c] font-semibold rounded-lg hover:bg-[var(--accent-light)] transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Gerenciar Loteamentos
                </button>
              </div>
            )}

            {(isLoading || maps.length > 0) && maps.length > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-bold text-[var(--foreground)] opacity-80 mb-2">
                  Mapa
                </label>
                <div className="max-w-md">
                  {isLoading ? (
                    <div className="h-12 w-full bg-[var(--surface)] rounded-xl animate-pulse"></div>
                  ) : (
                    <select
                      value={selectedMap?.id || ''}
                      onChange={(e) => selectMap(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--surface)] text-[var(--foreground)] rounded-xl border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors font-semibold cursor-pointer"
                    >
                      {maps.map((map) => (
                        <option key={map.id} value={map.id}>
                          {map.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Informações do Loteamento */}
            {selectedMap && (
              <div className="bg-gradient-to-br from-[var(--card-bg)] to-[var(--surface)] rounded-2xl p-6 mb-8 shadow-[var(--shadow-lg)] border-2 border-[var(--border)]">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-[var(--accent)] to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                      {selectedMap.name}
                    </h2>
                    {selectedMap.description && (
                      <p className="text-[var(--foreground)] opacity-70 mb-3">
                        {selectedMap.description}
                      </p>
                    )}
                    {selectedMap.address && (
                      <div className="flex items-center gap-2 text-[var(--foreground)] opacity-80">
                        <svg
                          className="w-5 h-5 text-[var(--accent)]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium">{selectedMap.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Seleção de Quadras */}
            {isLoading || isLoadingBlocks ? (
              <div className="mb-6">
                <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
                  Quadra
                </label>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-[var(--surface)] border-2 border-[var(--border)] animate-pulse"
                    >
                      <div className="h-3 w-12 bg-[var(--border)] rounded mb-2"></div>
                      <div className="h-5 w-8 bg-[var(--border)] rounded mb-1"></div>
                      <div className="h-3 w-16 bg-[var(--border)] rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !isLoading && blocks.length === 0 ? (
              <div className="mb-6 text-center py-12 bg-[var(--card-bg)] rounded-2xl border-2 border-dashed border-yellow-500/40 shadow-[var(--shadow-md)]">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500/20 rounded-full mb-4 shadow-md">
                  <svg
                    className="w-8 h-8 text-yellow-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <p className="text-yellow-500 text-lg font-semibold mb-2">
                  Nenhuma quadra cadastrada
                </p>
                <p className="text-[var(--foreground)]/80 text-sm font-medium">
                  Cadastre quadras neste loteamento para começar
                </p>
              </div>
            ) : blocks.length > 0 ? (
              <div className="mb-6">
                <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
                  Quadra
                </label>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                  {blocks.map((block) => (
                    <button
                      key={block.id}
                      onClick={() => {
                        if (selectedBlock?.id !== block.id) {
                          selectBlock(block.id);
                        }
                      }}
                      className={`p-4 rounded-xl font-semibold transition-all border-2 cursor-pointer ${
                        selectedBlock?.id === block.id
                          ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg scale-105 border-emerald-500'
                          : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] border-[var(--border)] hover:border-emerald-400 hover:shadow-md'
                      }`}
                    >
                      <div className="text-xs mb-1 opacity-70">Quadra</div>
                      <div className="text-lg font-bold">{block.name}</div>
                      {block.description && (
                        <div className="text-xs mt-1 opacity-70 truncate">{block.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Seletor de Lotes */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-[var(--accent)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  {isLoading || isLoadingBlocks ? (
                    <div className="h-6 w-32 bg-[var(--border)] rounded animate-pulse"></div>
                  ) : (
                    <>
                      Lotes
                      {selectedBlock && (
                        <span className="text-[var(--foreground)] opacity-60 text-base">
                          - {selectedBlock.name}
                        </span>
                      )}
                    </>
                  )}
                </h2>

                {/* Checkbox para ativar seleção múltipla */}
                {!isLoading && lots.length > 0 && (
                  <label className="flex items-center gap-3 px-4 py-2 bg-[var(--surface)] rounded-xl border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={multiSelectMode}
                      onChange={(e) => {
                        setMultiSelectMode(e.target.checked);
                        if (!e.target.checked) {
                          // Limpar seleção ao desativar modo múltiplo
                          handleClearSelection();
                        }
                      }}
                      className="w-5 h-5 rounded border-2 border-[var(--border)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      Selecionar múltiplos lotes
                    </span>
                  </label>
                )}
              </div>

              {isLoading || isLoadingLots ? (
                <div className="py-6">
                  <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 gap-2">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg animate-pulse"
                      ></div>
                    ))}
                  </div>
                </div>
              ) : lots.length > 0 ? (
                <LotSelector
                  lots={lots}
                  onMultipleSelect={
                    multiSelectMode
                      ? (lots) => {
                          // Recebe um array com um único lote para fazer toggle
                          if (lots.length === 1) {
                            handleToggleLotSelection(lots[0]);
                          }
                        }
                      : undefined
                  }
                  onSingleLotClick={!multiSelectMode ? handleSingleLotClick : undefined}
                  onToggleLotStatus={
                    user?.role === 'admin' || user?.role === 'dev'
                      ? handleToggleLotStatus
                      : undefined
                  }
                  selectedLotIds={selectedLots.map((l) => l.id)}
                  allowMultipleSelection={multiSelectMode}
                  lotsPerRow={15}
                  reservations={reservations}
                  userRole={user?.role}
                  userId={user?.id}
                  externalViewingLot={clickedLot}
                  onCloseExternalViewing={() => setClickedLot(null)}
                />
              ) : !isLoading && selectedBlock && lots.length === 0 ? (
                <div className="text-center py-12 bg-[var(--card-bg)] rounded-2xl border-2 border-dashed border-red-500/40 shadow-[var(--shadow-md)]">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4 shadow-md">
                    <svg
                      className="w-8 h-8 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>
                  <p className="text-red-500 text-lg font-semibold mb-2">Nenhum lote cadastrado</p>
                  <p className="text-[var(--foreground)]/80 text-sm font-medium">
                    Cadastre lotes nesta quadra para começar
                  </p>
                </div>
              ) : !isLoading && !selectedBlock ? (
                <div className="text-center py-12 bg-emerald-500/10 rounded-xl border-2 border-dashed border-emerald-500/30">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-emerald-500/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-emerald-400 text-lg font-semibold">Selecione uma quadra</p>
                </div>
              ) : null}
            </div>
          </>
        </div>
      </div>

      {/* Área do Mapa à direita */}
      <div className="flex-1 relative flex flex-col min-h-[500px] lg:min-h-0 lg:overflow-hidden">
        {/* Estatísticas de Status dos Lotes */}
        {(isLoading || selectedMap) && (
          <div className="flex-shrink-0 bg-[var(--card-bg)] border-b border-[var(--border)] p-2 lg:p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg lg:rounded-xl p-2 lg:p-4 shadow-lg">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 lg:w-5 lg:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-[10px] lg:text-xs font-medium mb-0.5">
                      Disponível
                    </p>
                    {isLoading || isLoadingMapStats ? (
                      <div className="h-5 w-8 lg:h-7 lg:w-12 bg-white/20 rounded animate-pulse"></div>
                    ) : (
                      <p className="text-white text-lg lg:text-2xl font-bold">
                        {mapStats.available}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg lg:rounded-xl p-2 lg:p-4 shadow-lg">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 lg:w-5 lg:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-[10px] lg:text-xs font-medium mb-0.5">
                      Reservado
                    </p>
                    {isLoading || isLoadingMapStats ? (
                      <div className="h-5 w-8 lg:h-7 lg:w-12 bg-white/20 rounded animate-pulse"></div>
                    ) : (
                      <p className="text-white text-lg lg:text-2xl font-bold">
                        {mapStats.reserved}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg lg:rounded-xl p-2 lg:p-4 shadow-lg">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 lg:w-5 lg:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-[10px] lg:text-xs font-medium mb-0.5">Vendido</p>
                    {isLoading || isLoadingMapStats ? (
                      <div className="h-5 w-8 lg:h-7 lg:w-12 bg-white/20 rounded animate-pulse"></div>
                    ) : (
                      <p className="text-white text-lg lg:text-2xl font-bold">{mapStats.sold}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg lg:rounded-xl p-2 lg:p-4 shadow-lg">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 lg:w-5 lg:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 0 5.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-[10px] lg:text-xs font-medium mb-0.5">
                      Bloqueado
                    </p>
                    {isLoading || isLoadingMapStats ? (
                      <div className="h-5 w-8 lg:h-7 lg:w-12 bg-white/20 rounded animate-pulse"></div>
                    ) : (
                      <p className="text-white text-lg lg:text-2xl font-bold">{mapStats.blocked}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(isLoading || selectedMap) && (
          <div className="flex-1 min-h-[500px] flex flex-col lg:overflow-hidden">
            <div className="h-[500px] lg:flex-1 w-full relative">
              {isLoading || isLoadingImage ? (
                <div className="flex items-center justify-center h-full bg-[var(--surface)]">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mb-4"></div>
                    <p className="text-[var(--foreground)] text-sm font-medium">
                      Carregando mapa...
                    </p>
                  </div>
                </div>
              ) : selectedMap ? (
                selectedMap.overlayConfig ? (
                  <>
                    <div className="h-full relative flex flex-col">
                      {/* Barra de controle */}
                      <div className="flex-shrink-0 p-2 bg-[var(--card-bg)] border-b border-[var(--border)] flex justify-end gap-2">
                        <button
                          onClick={() => window.open(`/view/${selectedMap.id}/`, '_blank')}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm cursor-pointer shadow-md hover:shadow-lg"
                          title="Abrir página de visualização"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          <span className="hidden sm:inline">Visualizar Mapa</span>
                        </button>

                        {selectedMap.overlayConfig?.bounds && (
                          <button
                            onClick={() => {
                              const bounds = selectedMap.overlayConfig!.bounds;
                              const centerLat = (bounds.north + bounds.south) / 2;
                              const centerLng = (bounds.east + bounds.west) / 2;
                              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${centerLat},${centerLng}`;
                              window.open(mapsUrl, '_blank');
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm cursor-pointer"
                          >
                            <span>📍</span>
                            Abrir no Google Maps
                          </button>
                        )}
                      </div>

                      <div className="flex-1 relative">
                        <PublicMapViewer
                          address={selectedMap.address}
                          blocks={blocks}
                          lots={lots}
                          overlayConfig={selectedMap.overlayConfig}
                          onLotClick={(lot) => {
                            if (multiSelectMode) {
                              handleToggleLotSelection(lot);
                            } else {
                              if (lot.status === LotStatus.AVAILABLE) {
                                setSingleLotPurchase(lot);
                              } else {
                                setClickedLot(lot);
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Avisos e Legenda fora da área do mapa */}
                    <div className="flex-shrink-0 p-3 lg:p-4 bg-[var(--card-bg)] border-t border-[var(--border)] space-y-3">
                      {lots.length === 0 && (
                        <div className="bg-blue-500 text-white px-3 py-2 lg:px-4 lg:py-2 rounded-lg shadow-lg text-xs lg:text-sm font-medium flex items-center gap-2">
                          <svg
                            className="w-4 h-4 lg:w-5 lg:h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Cadastre lotes e defina suas áreas para visualizá-los aqui
                        </div>
                      )}

                      {/* Legenda */}
                      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg lg:rounded-xl shadow-lg p-3 lg:p-4 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xs lg:text-sm font-bold text-gray-800 dark:text-white mb-2 lg:mb-3">
                          Legenda:
                        </h3>
                        <div className="grid grid-cols-3 gap-2 lg:gap-3">
                          <div className="flex items-center gap-1.5 lg:gap-2">
                            <div className="w-4 h-4 lg:w-6 lg:h-6 bg-green-500 rounded border-2 border-green-600 flex-shrink-0"></div>
                            <span className="text-[10px] lg:text-xs font-medium text-gray-700 dark:text-gray-300">
                              Disponível
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 lg:gap-2">
                            <div className="w-4 h-4 lg:w-6 lg:h-6 bg-yellow-500 rounded border-2 border-yellow-600 flex-shrink-0"></div>
                            <span className="text-[10px] lg:text-xs font-medium text-gray-700 dark:text-gray-300">
                              Reservado
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 lg:gap-2">
                            <div className="w-4 h-4 lg:w-6 lg:h-6 bg-red-500 rounded border-2 border-red-600 flex-shrink-0"></div>
                            <span className="text-[10px] lg:text-xs font-medium text-gray-700 dark:text-gray-300">
                              Vendido
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : selectedMap.imageUrl ? (
                  <div className="h-full p-6">
                    <InteractiveMap
                      imageUrl={selectedMap.imageUrl}
                      lots={lots}
                      onLotClick={handleLotClick}
                      selectedLotIds={selectedLots.map((lot) => lot.id)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-[var(--surface)]">
                    <div className="text-center">
                      <svg
                        className="w-16 h-16 mx-auto mb-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg mb-2">
                        Nenhuma imagem do mapa carregada
                      </p>
                      <p className="text-gray-500 dark:text-gray-500 text-sm">
                        Adicione uma imagem ao mapa para começar a desenhar os lotes
                      </p>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Barra de Ação Flutuante para Seleção Múltipla */}
      {selectedLots.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 min-w-[300px] sm:min-w-[400px] border-2 border-blue-400/30">
            {/* Contador de Lotes */}
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{selectedLots.length}</span>
              </div>
              <div className="text-white">
                <p className="font-bold text-lg leading-tight">
                  {selectedLots.length === 1 ? '1 Lote' : `${selectedLots.length} Lotes`}
                </p>
                <p className="text-white opacity-80 text-sm">
                  Selecionado{selectedLots.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Separador */}
            <div className="hidden sm:block w-px h-12 bg-white/20"></div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearSelection}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 backdrop-blur-sm border border-white/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Limpar
              </button>

              <button
                onClick={handleOpenPurchaseModal}
                className="px-6 py-2.5 bg-white text-blue-600 rounded-xl font-bold transition-all duration-200 hover:scale-105 hover:shadow-xl flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Enviar Reserva
              </button>
            </div>
          </div>
        </div>
      )}

      {showPurchaseModal && selectedLots.length > 0 && (
        <PurchaseModal
          lots={selectedLots} // Mudado de lot para lots
          onClose={handlePurchaseClose}
          onSuccess={async (reservationId) => {
            const returnedId = handlePurchaseSuccess(reservationId);

            // Redirecionar para a página da reserva se o ID for retornado
            if (returnedId || reservationId) {
              const id = returnedId || reservationId;

              // Mostrar mensagem de sucesso
              showAlert({
                title: 'Reserva Criada!',
                message: 'Sua reserva foi registrada e você será redirecionado para visualizá-la.',
                type: 'success',
              });

              // Aguardar um pouco para garantir que a reserva foi salva no banco
              await new Promise((resolve) => setTimeout(resolve, 800));
              router.push(`/reservations?reservationId=${id}`);
            } else {
              // Recarregar reservas e estatísticas após sucesso
              setTimeout(() => {
                fetchReservations();
                loadMapStats(true);
              }, 500);
            }
          }}
        />
      )}

      {/* Modal para compra de lote único (sem multi-select) */}
      {singleLotPurchase && (
        <PurchaseModal
          lots={[singleLotPurchase]}
          onClose={handleSinglePurchaseClose}
          onSuccess={handleSinglePurchaseSuccess}
        />
      )}

      {/* Modal de Visualização de Lote */}
      {viewingLot && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleViewClose}
        >
          <div
            className="bg-[var(--card-bg)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={`px-6 py-4 rounded-t-2xl ${
                viewingLot.status === LotStatus.AVAILABLE
                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                  : viewingLot.status === LotStatus.RESERVED
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                    : viewingLot.status === LotStatus.BLOCKED
                      ? 'bg-gradient-to-r from-gray-500 to-gray-700'
                      : 'bg-gradient-to-r from-red-500 to-red-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--foreground)]">
                    Lote {viewingLot.lotNumber}
                  </h2>
                  <p className="text-[var(--foreground)] opacity-90 text-sm mt-1">
                    {viewingLot.status === LotStatus.AVAILABLE && '✓ Disponível'}
                    {viewingLot.status === LotStatus.RESERVED && '🔒 Reservado'}
                    {viewingLot.status === LotStatus.SOLD && '✓ Vendido'}
                    {viewingLot.status === LotStatus.BLOCKED && '🔒 Bloqueado'}
                  </p>
                </div>
                <button
                  onClick={handleViewClose}
                  className="text-[var(--foreground)] hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-6">
              {/* Informação de status */}
              {viewingLot.status !== LotStatus.AVAILABLE && (
                <div
                  className={`rounded-xl p-4 border-2 ${
                    viewingLot.status === LotStatus.RESERVED
                      ? 'bg-amber-100 border-amber-400'
                      : viewingLot.status === LotStatus.SOLD
                        ? 'bg-red-100 border-red-400'
                        : viewingLot.status === LotStatus.BLOCKED
                          ? 'bg-gray-300 border-gray-500'
                          : 'bg-gray-200 border-gray-400'
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      viewingLot.status === LotStatus.RESERVED
                        ? 'text-amber-900'
                        : viewingLot.status === LotStatus.SOLD
                          ? 'text-red-900'
                          : 'text-gray-800'
                    }`}
                  >
                    {viewingLot.status === LotStatus.RESERVED && '⚠️ Este lote está reservado.'}
                    {viewingLot.status === LotStatus.SOLD && '✓ Este lote foi vendido.'}
                    {viewingLot.status === LotStatus.BLOCKED &&
                      '⛔ Este lote está bloqueado e não pode ser reservado.'}
                  </p>
                </div>
              )}

              {/* Informações principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-1">
                    Número do Lote
                  </label>
                  <p className="text-xl font-bold text-[var(--foreground)]">
                    {viewingLot.lotNumber}
                  </p>
                </div>

                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-1">
                    Status
                  </label>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold shadow-md ${
                      viewingLot.status === LotStatus.AVAILABLE
                        ? 'bg-green-500 text-white border-2 border-green-600'
                        : viewingLot.status === LotStatus.RESERVED
                          ? 'bg-amber-500 text-white border-2 border-amber-600'
                          : viewingLot.status === LotStatus.SOLD
                            ? 'bg-red-500 text-white border-2 border-red-600'
                            : 'bg-gray-500 text-white border-2 border-gray-600'
                    }`}
                  >
                    {viewingLot.status === LotStatus.AVAILABLE && 'Disponível'}
                    {viewingLot.status === LotStatus.RESERVED && 'Reservado'}
                    {viewingLot.status === LotStatus.SOLD && 'Vendido'}
                    {viewingLot.status === LotStatus.BLOCKED && 'Bloqueado'}
                  </span>
                </div>

                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-1">
                    Área
                  </label>
                  <p className="text-xl font-bold text-[var(--foreground)]">{viewingLot.size} m²</p>
                </div>

                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-1">
                    Preço Total
                  </label>
                  <p className="text-xl font-bold text-[var(--foreground)]">
                    R$ {viewingLot.price.toLocaleString('pt-BR')}
                  </p>
                  {viewingLot.pricePerM2 && (
                    <p className="text-xs text-gray-600 mt-1">
                      R$ {viewingLot.pricePerM2.toLocaleString('pt-BR')}/m²
                    </p>
                  )}
                </div>
              </div>

              {/* Descrição */}
              {viewingLot.description && (
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-2">
                    Descrição
                  </label>
                  <p className="text-[var(--foreground)] leading-relaxed">
                    {viewingLot.description}
                  </p>
                </div>
              )}

              {/* Características */}
              {viewingLot.features && viewingLot.features.length > 0 && (
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-3">
                    Características
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {viewingLot.features.map((feature, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--foreground)] text-sm font-medium rounded-lg"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Área desenhada removida - lot.area.points não existe mais */}
            </div>

            {/* Footer */}
            <div className="bg-[var(--surface)] px-6 py-4 rounded-b-2xl flex justify-between items-center gap-3 border-t border-[var(--border)]">
              <button
                onClick={handleViewClose}
                className="px-6 py-2.5 text-sm font-medium text-[var(--foreground)] bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                Fechar
              </button>

              {viewingLot.status === LotStatus.AVAILABLE && (
                <button
                  onClick={() => {
                    handleToggleLotSelection(viewingLot);
                    handleViewClose();
                  }}
                  className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    isLotSelected(viewingLot.id)
                      ? 'bg-red-500 hover:bg-red-600 text-[var(--foreground)]'
                      : 'bg-green-600 hover:bg-green-700 text-[var(--foreground)]'
                  }`}
                >
                  {isLotSelected(viewingLot.id) ? (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Remover da Lista
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Adicionar à Lista
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal agora é tratado pelo LotSelector via externalViewingLot */}
    </div>
  );
}
