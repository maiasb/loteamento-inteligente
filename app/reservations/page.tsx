'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { useCustomAlert } from '@/hooks/useCustomAlert';

// Forçar essa página a ser apenas client-side (sem SSG/SSR)
export const dynamic = 'force-dynamic';

const API_URL = '/api';

interface Reservation {
  id: number;
  lot_id: number;
  seller_id: number | null;
  user_id?: number | null;
  map_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_cpf: string | null;
  payment_method: string | null;
  first_payment: number | null;
  installments: number | null;
  contract: string | null;
  message: string | null;
  seller_name: string;
  seller_email: string;
  seller_phone: string;
  seller_cpf: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
  lots?: any[];
}

// Funções auxiliares para formatação de moeda
const formatCurrency = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';
  
  return numValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const parseCurrency = (value: string): number => {
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

// Funções de máscara
const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  }
  return cleaned.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
  }
  // CNPJ
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
};

export default function ReservationsPage() {
  const customAlert = useCustomAlert();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedReservation, setExpandedReservation] = useState<number | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [lotPrices, setLotPrices] = useState<{ [lotId: number]: string }>({});
  const [lotFirstPayments, setLotFirstPayments] = useState<{ [lotId: number]: string }>({});
  const [lotInstallments, setLotInstallments] = useState<{ [lotId: number]: number | null }>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');
  const [processedReservationId, setProcessedReservationId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
  });
  
  // Paginação
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam) : 1;
  });

  const loadData = useCallback(async () => {
    try {
      // Carregar apenas a página atual com filtros
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };

      // Filtrar por user_id se não for DEV ou ADMIN
      if (user?.role !== UserRole.DEV && user?.role !== UserRole.ADMIN && user?.id) {
        params.userId = user.id;
      }

      const response = await axios.get(`${API_URL}/reservas`, { 
        params,
        timeout: 10000 
      });

      if (response.data) {
        // Atualizar para o novo formato de resposta
        let reservationsData: Reservation[] = [];
        
        if (typeof response.data === 'object' && 'reservations' in response.data) {
          // Novo formato com paginação
          reservationsData = response.data.reservations || [];
          setTotalCount(response.data.totalCount || 0);
        } else if (Array.isArray(response.data.data)) {
          // Formato intermediário
          reservationsData = response.data.data;
          setTotalCount(response.data.total || response.data.data.length);
        } else if (Array.isArray(response.data)) {
          // Formato antigo (array direto)
          reservationsData = response.data;
          setTotalCount(response.data.length);
        } else {
          reservationsData = [];
          setTotalCount(0);
        }
        
        // Ordenar: pendentes primeiro, depois por data (mais recente primeiro)
        const sortedReservations = reservationsData.sort((a, b) => {
          // Se um é pendente e o outro não, pendente vem primeiro
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          
          // Se ambos têm o mesmo status, ordena por data (mais recente primeiro)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        setReservations(sortedReservations);
      }
    } catch (error) {
      console.error('[Reservations] ❌ Erro ao carregar reservas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.role, currentPage, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sincronizar currentPage com URL
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const pageFromUrl = pageParam ? parseInt(pageParam) : 1;
    if (pageFromUrl !== currentPage) {
      setCurrentPage(pageFromUrl);
      // Resetar processedReservationId quando a página mudar
      setProcessedReservationId(null);
    }
  }, [searchParams, currentPage]);

  // Função para carregar estatísticas
  const loadStats = useCallback(async () => {
    try {
      const params: any = {};

      if (user?.role !== UserRole.DEV && user?.role !== UserRole.ADMIN && user?.id) {
        params.userId = user.id;
      }

      const response = await axios.get(`${API_URL}/reservas/stats`, { 
        params,
        timeout: 5000 
      });

      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('[Reservations] Erro ao carregar estatísticas:', error);
    }
  }, [user?.id, user?.role]);

  // Carregar estatísticas ao montar o componente
  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user, loadStats]);

  // Expandir automaticamente a reserva se vier da URL
  useEffect(() => {
    const reservationId = searchParams.get('reservationId');
    
    // Evitar processar a mesma reserva múltiplas vezes
    if (!reservationId || reservationId === processedReservationId) {
      return;
    }
    
    // Esperar os dados carregarem
    if (isLoading) {
      return;
    }
    
    const id = parseInt(reservationId);
    
    // Verificar se a reserva está na página atual
    const reservation = reservations.find(r => r.id === id);
    
    if (reservation) {
      // Reserva encontrada na página atual
      setExpandedReservation(id);
      setProcessedReservationId(reservationId);
      
      // Limpar reservationId da URL
      const urlParams = new URLSearchParams(searchParams.toString());
      urlParams.delete('reservationId');
      router.replace(`/reservations?${urlParams.toString()}`);
      
      // Scroll suave até a reserva após um pequeno delay
      setTimeout(() => {
        const element = document.getElementById(`reservation-${id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    } else if (reservations.length > 0) {
      // Reserva não está na página atual e já terminou de carregar
      // Buscar em qual página ela está usando o novo endpoint
      const findReservationPage = async () => {
        try {
          const params: any = {
            reservationId: id,
            limit: itemsPerPage,
          };

          if (statusFilter !== 'all') {
            params.status = statusFilter;
          }

          if (user?.role !== UserRole.DEV && user?.role !== UserRole.ADMIN && user?.id) {
            params.userId = user.id;
          }

          const response = await axios.get(`${API_URL}/reservas/find-page`, { 
            params,
            timeout: 5000 
          });

          if (response.data && response.data.page) {
            const pageNumber = response.data.page;
            
            // Navegar para a página correta se for diferente da atual
            if (pageNumber !== currentPage) {
              const urlParams = new URLSearchParams(searchParams.toString());
              urlParams.set('page', pageNumber.toString());
              // Manter reservationId para processar na nova página
              router.push(`/reservations?${urlParams.toString()}`);
            } else {
              // Mesma página, mas não encontrou - marcar como processado
              setProcessedReservationId(reservationId);
            }
          } else {
            // Não encontrou a reserva - marcar como processado e limpar URL
            setProcessedReservationId(reservationId);
            const urlParams = new URLSearchParams(searchParams.toString());
            urlParams.delete('reservationId');
            router.replace(`/reservations?${urlParams.toString()}`);
          }
        } catch (error) {
          console.error('[Reservations] Erro ao buscar página da reserva:', error);
          // Limpar reservationId e marcar como processado em caso de erro
          setProcessedReservationId(reservationId);
          const urlParams = new URLSearchParams(searchParams.toString());
          urlParams.delete('reservationId');
          router.replace(`/reservations?${urlParams.toString()}`);
        }
      };

      findReservationPage();
    }
  }, [searchParams, reservations, isLoading, processedReservationId, currentPage, statusFilter, user?.id, user?.role, router, itemsPerPage]);

  // Polling automático removido - atualização manual apenas
  // useRealtimeUpdates(() => {
  //   loadData();
  // }, 10000);

  const handleApprove = async (reservationId: number) => {
    // Verificar permissão antes de prosseguir
    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.DEV) {
      customAlert.warning('Você não tem permissão para aprovar reservas.');
      return;
    }

    if (!await customAlert.confirm('Tem certeza que deseja aprovar esta reserva?\n\nIsso marcará o lote como VENDIDO.')) {
      return;
    }

    try {
      await axios.put(`${API_URL}/reserva/confirmacao`, {
        reservationId: reservationId.toString(),
        status: 'completed',
        lotStatus: 'sold',
        userRole: user?.role
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      loadData(); // Recarregar dados
      loadStats(); // Recarregar estatísticas
    } catch (error) {
      console.error('[Reservations] ❌ Erro ao aprovar reserva:', error);
      customAlert.error('Erro ao aprovar reserva. Tente novamente.');
    }
  };

  const handleReject = async (reservationId: number) => {
    // Verificar permissão antes de prosseguir
    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.DEV) {
      customAlert.warning('Você não tem permissão para rejeitar reservas.');
      return;
    }

    if (!await customAlert.confirm('Tem certeza que deseja rejeitar esta reserva?')) {
      return;
    }

    try {
      await axios.put(`${API_URL}/reserva/confirmacao`, {
        reservationId: reservationId.toString(),
        status: 'cancelled',
        lotStatus: 'available',
        userRole: user?.role
      });
      loadData(); // Recarregar dados
      loadStats(); // Recarregar estatísticas
    } catch (error) {
      console.error('[Reservations] ❌ Erro ao rejeitar reserva:', error);
      customAlert.error('Erro ao rejeitar reserva. Tente novamente.');
    }
  };

  const handleEdit = (reservation: Reservation) => {
    // Verificar permissão: vendedores não podem editar reservas concluídas ou canceladas
    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.DEV && reservation.status !== 'pending') {
      customAlert.warning('Você não tem permissão para editar reservas já confirmadas ou canceladas.');
      return;
    }

    // Formatar telefones e CPFs antes de carregar no formulário
    const formattedReservation = {
      ...reservation,
      customer_phone: reservation.customer_phone ? formatPhone(reservation.customer_phone) : '',
      customer_cpf: reservation.customer_cpf ? formatCPF(reservation.customer_cpf) : '',
      seller_phone: reservation.seller_phone ? formatPhone(reservation.seller_phone) : '',
      seller_cpf: reservation.seller_cpf ? formatCPF(reservation.seller_cpf) : '',
      // Manter created_at no formato correto para datetime-local (YYYY-MM-DDTHH:MM:SS)
      created_at: reservation.created_at ? reservation.created_at.replace(' ', 'T') : ''
    };

    setEditingReservation(formattedReservation);
    
    // Inicializar preços, first_payments e installments dos lotes
    const prices: { [lotId: number]: string } = {};
    const firstPayments: { [lotId: number]: string } = {};
    const installments: { [lotId: number]: number | null } = {};
    
    if (reservation.lots && reservation.lots.length > 0) {
      reservation.lots.forEach((lot: any) => {
        prices[lot.id] = formatCurrency(lot.agreed_price || lot.price || 0);
        firstPayments[lot.id] = formatCurrency(lot.first_payment || 0);
        installments[lot.id] = lot.installments || null;
      });
    }
    
    setLotPrices(prices);
    setLotFirstPayments(firstPayments);
    setLotInstallments(installments);
    
    setIsEditModalOpen(true);
  };

  const handleLotFirstPaymentChange = (lotId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove tudo exceto dígitos
    value = value.replace(/\D/g, '');
    
    // Converte para número e formata
    if (value === '') {
      setLotFirstPayments({ ...lotFirstPayments, [lotId]: '' });
      return;
    }
    
    // Adiciona zeros à esquerda se necessário para ter pelo menos 3 dígitos
    value = value.padStart(3, '0');
    
    // Separa os centavos dos reais
    const cents = value.slice(-2);
    const reais = value.slice(0, -2);
    
    // Formata para exibição
    const displayValue = `${parseInt(reais).toLocaleString('pt-BR')},${cents}`;
    setLotFirstPayments({ ...lotFirstPayments, [lotId]: displayValue });
  };

  const handleLotPriceChange = (lotId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove tudo exceto dígitos
    value = value.replace(/\D/g, '');
    
    // Converte para número e formata
    if (value === '') {
      setLotPrices({ ...lotPrices, [lotId]: '' });
      return;
    }
    
    // Adiciona zeros à esquerda se necessário para ter pelo menos 3 dígitos
    value = value.padStart(3, '0');
    
    // Separa os centavos dos reais
    const cents = value.slice(-2);
    const reais = value.slice(0, -2);
    
    // Formata para exibição
    const displayValue = `${parseInt(reais).toLocaleString('pt-BR')},${cents}`;
    setLotPrices({ ...lotPrices, [lotId]: displayValue });
  };

  const handleSaveEdit = async () => {
    if (!editingReservation) return;

    try {
      // Preparar preços, first_payments e installments dos lotes
      const lotsWithDetails = editingReservation.lots?.map((lot: any) => ({
        id: lot.id,
        agreed_price: lotPrices[lot.id] ? parseCurrency(lotPrices[lot.id]) : (lot.agreed_price || lot.price),
        firstPayment: lotFirstPayments[lot.id] ? parseCurrency(lotFirstPayments[lot.id]) : null,
        installments: lotInstallments[lot.id] || null
      })) || [];



      await axios.put(`${API_URL}/reservas/atualizar`, {
        id: editingReservation.id,
        customer_name: editingReservation.customer_name,
        customer_email: editingReservation.customer_email,
        customer_phone: editingReservation.customer_phone?.replace(/\D/g, ''),
        customer_cpf: editingReservation.customer_cpf?.replace(/\D/g, ''),
        payment_method: editingReservation.payment_method,
        contract: editingReservation.contract,
        message: editingReservation.message,
        seller_name: editingReservation.seller_name,
        seller_email: editingReservation.seller_email,
        seller_phone: editingReservation.seller_phone?.replace(/\D/g, ''),
        seller_cpf: editingReservation.seller_cpf?.replace(/\D/g, ''),
        // Converter formato de volta para MySQL (T -> espaço)
        created_at: editingReservation.created_at ? editingReservation.created_at.replace('T', ' ') : editingReservation.created_at,
        status: editingReservation.status,
        userRole: user?.role,
        lots: lotsWithDetails
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      setIsEditModalOpen(false);
      setEditingReservation(null);
      loadData();
      customAlert.success('Reserva editada com sucesso!');
    } catch (error) {
      console.error('[Reservations] ❌ Erro ao editar reserva:', error);
      customAlert.error('Erro ao editar reserva. Tente novamente.');
    }
  };

  // Calcular paginação
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Função para mudar página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Atualizar URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/reservations?${params.toString()}`);
  };

  // Atualizar filtro de status
  const handleStatusFilterChange = (status: typeof statusFilter) => {
    setStatusFilter(status);
    setCurrentPage(1);
    const params = new URLSearchParams();
    params.set('page', '1');
    router.push(`/reservations?${params.toString()}`);
  };

  // Reset para página 1 quando mudar o filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Verificar se há uma reserva para expandir automaticamente
  useEffect(() => {
    const reservationIdToExpand = sessionStorage.getItem('expandReservationId');
    if (reservationIdToExpand && reservations.length > 0) {
      const reservationId = parseInt(reservationIdToExpand);
      
      // Buscar a reserva pelo ID e verificar se não está cancelada
      const reservation = reservations.find(r => r.id === reservationId);
      
      // Se a reserva está cancelada, buscar outra reserva com o mesmo lote que não esteja cancelada
      let targetReservation: Reservation | undefined = reservation;
      if (!reservation || reservation.status === 'cancelled') {
        
        // Buscar o lote da reserva cancelada
        if (reservation?.lots && reservation.lots.length > 0) {
          const lotIds = reservation.lots.map((l: any) => l.id);
          
          // Buscar outra reserva com pelo menos um dos mesmos lotes e que não esteja cancelada
          targetReservation = reservations.find(r => 
            r.id !== reservationId &&
            r.status !== 'cancelled' &&
            r.lots?.some((l: any) => lotIds.includes(l.id))
          );
          
          if (targetReservation) {
          }
        }
      }
      
      if (targetReservation) {
        const reservationIndex = reservations.findIndex(r => r.id === targetReservation.id);
        
        if (reservationIndex !== -1) {
          // Calcular a página onde a reserva está
          const pageNumber = Math.floor(reservationIndex / itemsPerPage) + 1;
          
          // Definir a página correta
          setCurrentPage(pageNumber);
          
          // Expandir a reserva
          setExpandedReservation(targetReservation.id);
          
          // Scroll suave até a reserva (com delay maior para garantir renderização)
          setTimeout(() => {
            const element = document.getElementById(`reservation-${targetReservation.id}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 500);
        }
      }
      
      // Limpar o sessionStorage
      sessionStorage.removeItem('expandReservationId');
    }
  }, [reservations, itemsPerPage]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Minhas Reservas</h1>
        <p className="text-[var(--foreground)] opacity-70">Gerencie as reservas de lotes realizadas</p>

        {/* Badge informativo baseado no perfil */}
        {user?.role === UserRole.DEV || user?.role === UserRole.ADMIN ? (
          <div className="mt-3 inline-flex items-center gap-2 bg-purple-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold border border-purple-600 shadow-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Exibindo todas as reservas (Perfil: {user.role === UserRole.DEV ? 'DEV' : 'ADMIN'})
          </div>
        ) : user?.cpf && (
          <div className="mt-3 inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold border border-blue-600 shadow-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Exibindo apenas suas reservas (CPF: {user.cpf})
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div 
          onClick={() => handleStatusFilterChange(statusFilter === 'all' ? 'all' : 'all')}
          className={`bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-[var(--shadow-lg)] cursor-pointer transition-all duration-300 hover:scale-105 ${
        statusFilter === 'all' ? 'ring-4 ring-blue-300' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
          </div>
          <p className="text-white text-sm font-medium mb-1">Total de Reservas</p>
          {isLoading ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{stats.total}</p>
          )}
        </div>

        <div 
          onClick={() => handleStatusFilterChange(statusFilter === 'pending' ? 'all' : 'pending')}
          className={`bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-6 shadow-[var(--shadow-lg)] cursor-pointer transition-all duration-300 hover:scale-105 ${
        statusFilter === 'pending' ? 'ring-4 ring-yellow-300' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
          </div>
          <p className="text-white text-sm font-medium mb-1">Pendentes</p>
          {isLoading ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{stats.pending}</p>
          )}
        </div>

        <div 
          onClick={() => handleStatusFilterChange(statusFilter === 'completed' ? 'all' : 'completed')}
          className={`bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 shadow-[var(--shadow-lg)] cursor-pointer transition-all duration-300 hover:scale-105 ${
        statusFilter === 'completed' ? 'ring-4 ring-green-300' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
          </div>
          <p className="text-white text-sm font-medium mb-1">Concluídas</p>
          {isLoading ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{stats.completed}</p>
          )}
        </div>

        <div 
          onClick={() => handleStatusFilterChange(statusFilter === 'cancelled' ? 'all' : 'cancelled')}
          className={`bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 shadow-[var(--shadow-lg)] cursor-pointer transition-all duration-300 hover:scale-105 ${
        statusFilter === 'cancelled' ? 'ring-4 ring-red-300' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
          </div>
          <p className="text-white text-sm font-medium mb-1">Canceladas</p>
          {isLoading ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{stats.cancelled}</p>
          )}
        </div>
      </div>

      {/* Lista de Reservas */}
      <div className="bg-[var(--card-bg)] rounded-2xl p-6 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Reservas Realizadas
            {statusFilter !== 'all' && (
              <span className="text-sm font-normal text-[var(--foreground)] opacity-70">
                ({statusFilter === 'pending' && 'Pendentes'}
                {statusFilter === 'completed' && 'Concluídas'}
                {statusFilter === 'cancelled' && 'Canceladas'})
              </span>
            )}
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-[var(--surface)] rounded-xl border-2 border-[var(--border)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-12 bg-[var(--border)] rounded animate-pulse"></div>
                      <div className="h-6 w-24 bg-[var(--border)] rounded-full animate-pulse"></div>
                    </div>
                    <div className="h-6 w-48 bg-[var(--border)] rounded animate-pulse"></div>
                    <div className="h-4 w-64 bg-[var(--border)] rounded animate-pulse"></div>
                    <div className="flex gap-4">
                      <div className="h-4 w-32 bg-[var(--border)] rounded animate-pulse"></div>
                      <div className="h-4 w-32 bg-[var(--border)] rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-8 w-8 bg-[var(--border)] rounded-lg animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--surface)] rounded-full mb-4">
              <svg className="w-8 h-8 text-[var(--foreground)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-[var(--foreground)] opacity-70 text-lg">
              {statusFilter === 'all' ? 'Nenhuma reserva encontrada' : `Nenhuma reserva ${
                statusFilter === 'pending' ? 'pendente' : 
                statusFilter === 'completed' ? 'concluída' : 
                'cancelada'
              } encontrada`}
            </p>
            <p className="text-[var(--foreground)] opacity-50 text-sm mt-2">
              {statusFilter === 'all' 
                ? 'As reservas aparecerão aqui quando forem criadas'
                : 'Tente selecionar outro filtro ou limpar a busca'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {reservations.map((reservation) => (
              <div
                key={reservation.id}
                id={`reservation-${reservation.id}`}
                className="bg-[var(--surface)] rounded-xl border-2 border-[var(--border)] overflow-hidden hover:border-[var(--primary)]/30 transition-colors"
              >
                {/* Header do Card */}
                <div 
                  onClick={() => {
                    if (expandedReservation !== reservation.id) {
                      setExpandedReservation(reservation.id);
                    } else {
                      setExpandedReservation(null);
                    }
                  }}
                  className="p-4 flex items-start justify-between gap-4 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[var(--foreground)] opacity-50 font-mono text-xs">#{reservation.id}</span>
                      {reservation.status === 'pending' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white border border-amber-600 shadow-md">
                          Pendente
                        </span>
                      )}
                      {reservation.status === 'completed' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white border border-emerald-600 shadow-md">
                          Concluída
                        </span>
                      )}
                      {reservation.status === 'cancelled' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white border border-red-600 shadow-md">
                          Cancelada
                        </span>
                      )}
                    </div>
                    <h3 className="text-[var(--foreground)] font-bold text-lg truncate">{reservation.customer_name}</h3>
                    <p className="text-[var(--foreground)] opacity-60 text-sm truncate">{reservation.customer_email || 'Não Informado'}</p>
                  </div>

                  {/* Ícone de expandir/recolher */}
                  <div className="flex-shrink-0 p-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--background)] transition-colors">
                    <svg
                      className={`w-5 h-5 text-[var(--foreground)] transition-transform ${
                        expandedReservation === reservation.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {expandedReservation === reservation.id && (
                  <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)] pt-4">
                    {/* Informações do Cliente */}
                    <div>
                      <h4 className="text-[var(--foreground)] font-bold text-sm mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Dados do Cliente
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--card-bg)] p-3 rounded-lg">
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Nome Completo</p>
                          <p className="text-[var(--foreground)] font-medium text-sm">{reservation.customer_name}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Email</p>
                          <p className="text-[var(--foreground)] text-sm">{reservation.customer_email || 'Não Informado'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Telefone</p>
                          <p className="text-[var(--foreground)] text-sm">{reservation.customer_phone ? formatPhone(reservation.customer_phone) : 'Não Informado'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">CPF/CNPJ</p>
                          <p className="text-[var(--foreground)] font-mono text-sm">{reservation.customer_cpf ? formatCPF(reservation.customer_cpf) : 'Não informado'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Informações do Vendedor */}
                    <div>
                      <h4 className="text-[var(--foreground)] font-bold text-sm mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Dados do Vendedor
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--card-bg)] p-3 rounded-lg">
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Nome</p>
                          <p className="text-[var(--foreground)] text-sm">{reservation.seller_name}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Email</p>
                          <p className="text-[var(--foreground)] text-sm">{reservation.seller_email || 'Não Informado'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Telefone</p>
                          <p className="text-[var(--foreground)] text-sm">{reservation.seller_phone ? formatPhone(reservation.seller_phone) : 'Não Informado'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">CPF</p>
                          <p className="text-[var(--foreground)] font-mono text-sm">{reservation.seller_cpf ? formatCPF(reservation.seller_cpf) : 'Não Informado'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Informações da Venda */}
                    <div>
                      <h4 className="text-[var(--foreground)] font-bold text-sm mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Informações da Venda
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--card-bg)] p-3 rounded-lg">
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Forma de Pagamento</p>
                          <p className="text-[var(--foreground)] text-sm capitalize">
                            {reservation.payment_method === 'pix' && '💰 Pix'}
                            {reservation.payment_method === 'cartao' && '💳 Cartão'}
                            {reservation.payment_method === 'dinheiro' && '💵 Dinheiro'}
                            {reservation.payment_method === 'carne' && '📄 Carnê'}
                            {reservation.payment_method === 'financing' && '🏦 Financiamento'}
                            {reservation.payment_method === 'outro' && '📝 Outro'}
                            {!reservation.payment_method && 'Não informado'}
                            {reservation.payment_method && !['pix', 'cartao', 'dinheiro', 'carne', 'financing', 'outro'].includes(reservation.payment_method) && `📝 ${reservation.payment_method}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Data da Reserva</p>
                          <p className="text-[var(--foreground)] text-sm">
                            {new Date(reservation.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        {reservation.lots && reservation.lots.length > 0 && (
                          <div className="sm:col-span-2">
                          <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-2">Lotes Reservados</p>
                          <div className="space-y-2">
                            {reservation.lots.map((lot: any) => (
                            <div key={lot.id} className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)]">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-blue-600 text-sm font-medium">
                                    {lot.map_name && `${lot.map_name} / `}
                                    {lot.block_name ? `${lot.block_name} / ` : ''}
                                    Lote {lot.lot_number}
                                  </span>
                                </div>
                                <span className="text-[var(--foreground)] text-sm font-bold">
                                  R$ {Number(lot.agreed_price || lot.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              
                              {/* Mostrar entrada e parcelas se existirem */}
                              {(lot.first_payment || lot.installments) && (
                                <div className="flex gap-4 mt-2 pt-2 border-t border-[var(--border)]">
                                  {lot.first_payment && lot.first_payment > 0 && (
                                    <div className="flex-1">
                                      <p className="text-[var(--foreground)] opacity-40 text-xs mb-0.5">Entrada</p>
                                      <p className="text-green-400 text-xs font-bold">
                                        R$ {Number(lot.first_payment).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  )}
                                  {lot.installments && lot.installments > 0 && (
                                    <div className="flex-1">
                                      <p className="text-[var(--foreground)] opacity-40 text-xs mb-0.5">Parcelas</p>
                                      <p className="text-blue-400 text-xs font-bold">
                                        {lot.installments}x
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            ))}
                          </div>
                          </div>
                        )}
                        {reservation.contract && (
                          <div className="sm:col-span-2">
                            <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Número do Contrato</p>
                            <p className="text-[var(--foreground)] text-sm font-mono bg-[var(--background)] px-3 py-2 rounded border border-[var(--border)]">
                              {reservation.contract}
                            </p>
                          </div>
                        )}
                        {reservation.message && (
                          <div className="sm:col-span-2">
                            <p className="text-[var(--foreground)] opacity-50 text-xs font-medium mb-1">Mensagem do Cliente</p>
                            <p className="text-[var(--foreground)] text-sm bg-[var(--background)] p-2 rounded">{reservation.message}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[var(--border)]">
                      {/* Botão de Editar - Vendedores só podem editar reservas pendentes */}
                      {(reservation.status === 'pending' || user?.role === UserRole.ADMIN || user?.role === UserRole.DEV) && (
                        <button
                          onClick={() => handleEdit(reservation)}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors shadow-md cursor-pointer"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Editar Dados
                        </button>
                      )}

                      {reservation.status === 'pending' && (user?.role === UserRole.ADMIN || user?.role === UserRole.DEV) && (
                        <>
                          <button
                            onClick={() => handleApprove(reservation.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors shadow-md cursor-pointer"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Aprovar Reserva
                          </button>
                          <button
                            onClick={() => handleReject(reservation.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors shadow-md cursor-pointer"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Rejeitar Reserva
                          </button>
                        </>
                      )}

                      {/* Botão de cancelamento para reservas concluídas (apenas ADMIN e DEV) */}
                      {reservation.status === 'completed' && (user?.role === UserRole.ADMIN || user?.role === UserRole.DEV) && (
                        <button
                          onClick={() => handleReject(reservation.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors shadow-md cursor-pointer"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancelar Venda
                        </button>
                      )}
                    </div>

                    {reservation.status === 'completed' && (user?.role === UserRole.ADMIN || user?.role === UserRole.DEV) && (
                      <p className="text-xs text-[var(--foreground)] opacity-40 text-center -mt-2">
                        ⚠️ Cancelar venda marcará o lote como disponível novamente
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-6">
                <div className="text-sm text-[var(--foreground)] opacity-70">
                  Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, totalCount)} de {totalCount} reservas
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      // Mostrar apenas páginas próximas à atual
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-[var(--primary)] text-[var(--foreground)]'
                                : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (
                        page === currentPage - 2 ||
                        page === currentPage + 2
                      ) {
                        return <span key={page} className="px-2 text-[var(--foreground)] opacity-50">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Edição */}
      {isEditModalOpen && editingReservation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-3xl shadow-2xl border-2 border-[var(--primary)]/30 my-4 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-[var(--foreground)] p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-bold">Editar Reserva #{editingReservation.id}</h2>
                    <p className="text-white opacity-90 text-sm">Atualizar informações da reserva</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingReservation(null);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Dados do Cliente */}
              <div>
                <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Dados do Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Nome Completo *</label>
                    <input
                      type="text"
                      value={editingReservation.customer_name}
                      onChange={(e) => setEditingReservation({ ...editingReservation, customer_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Email *</label>
                    <input
                      type="email"
                      value={editingReservation.customer_email || ''}
                      onChange={(e) => setEditingReservation({ ...editingReservation, customer_email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Telefone *</label>
                    <input
                      type="tel"
                      value={editingReservation.customer_phone || ''}
                      onChange={(e) => {
                        const formatted = formatPhone(e.target.value);
                        setEditingReservation({ ...editingReservation, customer_phone: formatted });
                      }}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                      placeholder="(11) 98765-4321"
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">CPF/CNPJ</label>
                    <input
                      type="text"
                      value={editingReservation.customer_cpf || ''}
                      onChange={(e) => {
                        const formatted = formatCPF(e.target.value);
                        setEditingReservation({ ...editingReservation, customer_cpf: formatted });
                      }}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] font-mono"
                      placeholder="000.000.000-00"
                      maxLength={18}
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Vendedor */}
              <div>
                <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Dados do Vendedor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Nome do Vendedor *</label>
                    <input
                      type="text"
                      value={editingReservation.seller_name || ''}
                      onChange={(e) => setEditingReservation({ ...editingReservation, seller_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                      placeholder="Nome do vendedor"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Email do Vendedor *</label>
                    <input
                      type="email"
                      value={editingReservation.seller_email || ''}
                      onChange={(e) => setEditingReservation({ ...editingReservation, seller_email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                      placeholder="vendedor@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Telefone do Vendedor *</label>
                    <input
                      type="tel"
                      value={editingReservation.seller_phone || ''}
                      onChange={(e) => {
                        const formatted = formatPhone(e.target.value);
                        setEditingReservation({ ...editingReservation, seller_phone: formatted });
                      }}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                      placeholder="(11) 98765-4321"
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">CPF do Vendedor *</label>
                    <input
                      type="text"
                      value={editingReservation.seller_cpf || ''}
                      onChange={(e) => {
                        const formatted = formatCPF(e.target.value);
                        setEditingReservation({ ...editingReservation, seller_cpf: formatted });
                      }}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] font-mono"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                </div>
              </div>

              {/* Dados da Venda */}
              <div>
                <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Informações da Venda
                </h3>

                {/* Lotes e Preços */}
                {editingReservation.lots && editingReservation.lots.length > 0 && (
                  <div className="mb-6 p-4 bg-[var(--surface)] rounded-lg border-2 border-[var(--border)]">
                    <h4 className="text-[var(--foreground)] opacity-80 text-sm font-semibold mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Lotes Reservados e Preços
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      {editingReservation.lots.map((lot: any) => (
                        <div key={lot.id} className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)]">
                          <label className="block text-[var(--foreground)] opacity-70 text-sm font-medium mb-3">
                            Lote {lot.lot_number}{lot.block_name ? ` - Quadra ${lot.block_name}` : ''}
                          </label>
                          
                          <div className="space-y-2">
                            {/* Preço do Lote */}
                            <div className="flex items-center gap-2">
                              <span className="text-[var(--foreground)] opacity-50 text-xs w-20">Valor:</span>
                              <div className="flex-1 flex items-center gap-1">
                                <span className="text-[var(--foreground)] opacity-50 text-sm">R$</span>
                                <input
                                  type="text"
                                  value={lotPrices[lot.id] || ''}
                                  onChange={(e) => handleLotPriceChange(lot.id, e)}
                                  className="flex-1 px-3 py-2 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] text-right font-semibold"
                                  placeholder="0,00"
                                />
                              </div>
                            </div>

                            {/* Entrada (se não for Pix ou Dinheiro) */}
                            {editingReservation.payment_method && editingReservation.payment_method !== 'pix' && editingReservation.payment_method !== 'dinheiro' && (
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--foreground)] opacity-50 text-xs w-20">Entrada:</span>
                                <div className="flex-1 flex items-center gap-1">
                                  <span className="text-[var(--foreground)] opacity-50 text-sm">R$</span>
                                  <input
                                    type="text"
                                    value={lotFirstPayments[lot.id] || ''}
                                    onChange={(e) => handleLotFirstPaymentChange(lot.id, e)}
                                    className="flex-1 px-3 py-2 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] text-right font-semibold"
                                    placeholder="0,00"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Parcelas (se for Carnê, Cartão ou Financiamento) */}
                            {(editingReservation.payment_method === 'carne' || editingReservation.payment_method === 'cartao' || editingReservation.payment_method === 'financing') && (
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--foreground)] opacity-50 text-xs w-20">Parcelas:</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={lotInstallments[lot.id] || ''}
                                  onChange={(e) => setLotInstallments({ ...lotInstallments, [lot.id]: parseInt(e.target.value) || null })}
                                  className="flex-1 px-3 py-2 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] text-right font-semibold"
                                  placeholder="Ex: 12"
                                />
                                <span className="text-[var(--foreground)] opacity-50 text-xs">x</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Forma de Pagamento</label>
                    <select
                      value={editingReservation.payment_method || ''}
                      onChange={(e) => {
                        const newPaymentMethod = e.target.value;
                        // Limpar entrada e parcelas de todos os lotes se for pagamento à vista (pix ou dinheiro)
                        if (newPaymentMethod === 'pix' || newPaymentMethod === 'dinheiro') {
                          setEditingReservation({ 
                            ...editingReservation, 
                            payment_method: newPaymentMethod
                          });
                          // Limpar todos os valores de first_payment e installments
                          const emptyFirstPayments: { [lotId: number]: string } = {};
                          const emptyInstallments: { [lotId: number]: number | null } = {};
                          editingReservation.lots?.forEach((lot: any) => {
                            emptyFirstPayments[lot.id] = '';
                            emptyInstallments[lot.id] = null;
                          });
                          setLotFirstPayments(emptyFirstPayments);
                          setLotInstallments(emptyInstallments);
                        } else {
                          setEditingReservation({ ...editingReservation, payment_method: newPaymentMethod });
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      <option value="pix">💰 Pix</option>
                      <option value="cartao">💳 Cartão</option>
                      <option value="dinheiro">💵 Dinheiro</option>
                      <option value="carne">📄 Carnê</option>
                      <option value="financing">🏦 Financiamento</option>
                      <option value="outro">📝 Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Número do Contrato</label>
                    <input
                      type="text"
                      maxLength={50}
                      value={editingReservation.contract || ''}
                      onChange={(e) => setEditingReservation({ ...editingReservation, contract: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] font-mono"
                      placeholder="Ex: CONT-2025-001"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Data da Reserva</label>
                    <input
                      type="datetime-local"
                      value={editingReservation.created_at ? editingReservation.created_at.substring(0, 16) : ''}
                      onChange={(e) => {
                        // Manter formato YYYY-MM-DDTHH:MM:SS para compatibilidade com backend
                        const newValue = e.target.value + ':00';
                        setEditingReservation({ ...editingReservation, created_at: newValue });
                      }}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Mensagem do Cliente</label>
                    <textarea
                      value={editingReservation.message || ''}
                      onChange={(e) => setEditingReservation({ ...editingReservation, message: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                      rows={3}
                      placeholder="Mensagem ou solicitação do cliente"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-[var(--card-bg)] border-t border-[var(--border)] p-6 flex gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingReservation(null);
                }}
                className="flex-1 px-6 py-3 bg-[var(--surface)] hover:bg-[var(--background)] text-[var(--foreground)] font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
