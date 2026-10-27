'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { UserRole } from '@/types/UserRole';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = '/api';

type DashboardStats = {
  summary: {
    totalMaps: number;
    totalLots: number;
    availableLots: number;
    reservedLots: number;
    soldLots: number;
    blockedLots: number;
  };
  financial: {
    totalValue: number;
    availableValue: number;
    reservedValue: number;
    soldValue: number;
    blockedValue: number;
    totalFirstPayments: number;
  };
  maps: Array<{
    id: string;
    name: string;
    description: string;
    totalLots: number;
    availableLots: number;
    reservedLots: number;
    soldLots: number;
    blockedLots: number;
  }>;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false); // Controla se já carregou os dados

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Carregar estatísticas agregadas do dashboard (apenas uma requisição otimizada)
      const response = await axios.get<DashboardStats>(`${API_URL}/dashboard/stats`, {
        timeout: 30000,
      });
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Redirecionar vendedores para a página de mapas
  useEffect(() => {
    if (user?.role === UserRole.VENDEDOR) {
      router.push('/maps');
      return;
    }
  }, [user, router]);

  // Carregar dados do dashboard apenas uma vez
  useEffect(() => {
    if (user?.role !== UserRole.VENDEDOR && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadDashboardData();
    }
  }, [user?.role]);

  // Não renderizar para vendedores
  if (user?.role === UserRole.VENDEDOR) {
    return null;
  }

  // Extrair dados das estatísticas (com valores padrão)
  const totalMaps = stats?.summary.totalMaps || 0;
  const totalLots = stats?.summary.totalLots || 0;
  const availableLots = stats?.summary.availableLots || 0;
  const reservedLots = stats?.summary.reservedLots || 0;
  const soldLots = stats?.summary.soldLots || 0;
  const blockedSlots = stats?.summary.blockedLots || 0;

  const totalValue = stats?.financial.totalValue || 0;
  const availableValue = stats?.financial.availableValue || 0;
  const reservedValue = stats?.financial.reservedValue || 0;
  const soldValue = stats?.financial.soldValue || 0;
  const blockedValue = stats?.financial.blockedValue || 0;
  const totalFirstPayments = stats?.financial.totalFirstPayments || 0;

  const maps = stats?.maps || [];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Dashboard</h1>
        <p className="text-[var(--foreground)] opacity-70">Visão geral dos loteamentos</p>
      </div>

      {/* Estatísticas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
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
          </div>
          <p className="text-white/90 text-sm font-medium mb-1">Total de Loteamentos</p>
          {isLoading ? (
            <div className="h-10 w-20 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{totalMaps}</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
            </div>
          </div>
          <p className="text-white/90 text-sm font-medium mb-1">Total de Lotes</p>
          {isLoading ? (
            <div className="h-10 w-24 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{totalLots}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl p-6 shadow-[var(--shadow-lg)] border-2 border-yellow-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-300/30 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-yellow-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636a9 9 0 11-12.728 0M12 9v2m0 4h.01"
                />
              </svg>
            </div>
          </div>
          <p className="text-yellow-900/90 text-sm font-medium mb-1">Lotes Reservados</p>
          {isLoading ? (
            <div className="h-10 w-20 bg-yellow-300/30 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-yellow-900 text-4xl font-bold">{reservedLots}</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
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
          </div>
          <p className="text-white/90 text-sm font-medium mb-1">Lotes Disponíveis</p>
          {isLoading ? (
            <div className="h-10 w-24 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{availableLots}</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-white/90 text-sm font-medium mb-1">Lotes Vendidos</p>
          {isLoading ? (
            <div className="h-10 w-20 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{soldLots}</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-gray-500 to-gray-700 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-white/90 text-sm font-medium mb-1">Lotes Bloqueados</p>
          {isLoading ? (
            <div className="h-10 w-20 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{blockedSlots}</p>
          )}
        </div>
      </div>

      {/* Estatísticas de Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-[var(--card-bg)] rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-6 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Distribuição por Status
          </h2>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--surface)] rounded-full animate-pulse"></div>
                      <div className="h-4 w-24 bg-[var(--surface)] rounded animate-pulse"></div>
                    </div>
                    <div className="h-4 w-20 bg-[var(--surface)] rounded animate-pulse"></div>
                  </div>
                  <div className="w-full bg-[var(--surface)] rounded-full h-3">
                    <div
                      className="bg-[var(--surface)] h-3 rounded-full animate-pulse"
                      style={{ width: '50%' }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-[var(--foreground)] font-medium">Disponível</span>
                  </div>
                  <span className="text-[var(--foreground)] font-bold">
                    {availableLots} (
                    {totalLots > 0 ? ((availableLots / totalLots) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-[var(--surface)] rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${totalLots > 0 ? (availableLots / totalLots) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-[var(--foreground)] font-medium">Reservado</span>
                  </div>
                  <span className="text-[var(--foreground)] font-bold">
                    {reservedLots} (
                    {totalLots > 0 ? ((reservedLots / totalLots) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-[var(--surface)] rounded-full h-3">
                  <div
                    className="bg-yellow-500 h-3 rounded-full transition-all"
                    style={{ width: `${totalLots > 0 ? (reservedLots / totalLots) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-[var(--foreground)] font-medium">Vendido</span>
                  </div>
                  <span className="text-[var(--foreground)] font-bold">
                    {soldLots} ({totalLots > 0 ? ((soldLots / totalLots) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-[var(--surface)] rounded-full h-3">
                  <div
                    className="bg-red-500 h-3 rounded-full transition-all"
                    style={{ width: `${totalLots > 0 ? (soldLots / totalLots) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <span className="text-[var(--foreground)] font-medium">Bloqueado</span>
                  </div>
                  <span className="text-[var(--foreground)] font-bold">
                    {blockedSlots} (
                    {totalLots > 0 ? ((blockedSlots / totalLots) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-[var(--surface)] rounded-full h-3">
                  <div
                    className="bg-gray-500 h-3 rounded-full transition-all"
                    style={{ width: `${totalLots > 0 ? (blockedSlots / totalLots) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[var(--card-bg)] rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-6 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Valores Financeiros
          </h2>
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-[var(--surface)] rounded-xl p-4 shadow-md">
                  <div className="h-4 w-32 bg-[var(--border)] rounded animate-pulse mb-2"></div>
                  <div className="h-8 w-40 bg-[var(--border)] rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-500/30 to-purple-500/30 border-2 border-blue-400 rounded-xl p-4 shadow-lg">
                <p className="text-[var(--foreground)] text-sm font-semibold mb-1">
                  Valor Total dos Lotes
                </p>
                <p className="text-[var(--foreground)] text-3xl font-bold">
                  R${' '}
                  {totalValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="bg-green-500/25 border-2 border-green-400 rounded-xl p-4 shadow-md">
                <p className="text-[var(--foreground)] text-sm font-semibold mb-1">
                  Disponível para Venda
                </p>
                <p className="text-[var(--foreground)] text-2xl font-bold">
                  R${' '}
                  {availableValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="bg-yellow-500/25 border-2 border-yellow-400 rounded-xl p-4 shadow-md">
                <p className="text-[var(--foreground)] text-sm font-semibold mb-1">
                  Valor dos Lotes Reservados
                </p>
                <p className="text-[var(--foreground)] text-2xl font-bold">
                  R${' '}
                  {reservedValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="bg-red-500/25 border-2 border-red-400 rounded-xl p-4 shadow-md">
                <p className="text-[var(--foreground)] text-sm font-semibold mb-1">
                  Valor Já Vendido
                </p>
                <p className="text-[var(--foreground)] text-2xl font-bold">
                  R${' '}
                  {soldValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="bg-gray-500/25 border-2 border-gray-400 rounded-xl p-4 shadow-md">
                <p className="text-[var(--foreground)] text-sm font-semibold mb-1">
                  Valor dos Lotes Bloqueados
                </p>
                <p className="text-[var(--foreground)] text-2xl font-bold">
                  R${' '}
                  {blockedValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="bg-blue-500/25 border-2 border-blue-400 rounded-xl p-4 shadow-md">
                <p className="text-[var(--foreground)] text-sm font-semibold mb-1">
                  Total de Entradas Recebidas
                </p>
                <p className="text-[var(--foreground)] text-2xl font-bold">
                  R${' '}
                  {totalFirstPayments.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lista de Mapas */}
      <div className="bg-[var(--card-bg)] rounded-2xl p-6 shadow-[var(--shadow-lg)]">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-6 flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          Mapas Cadastrados
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-[var(--surface)] rounded-xl p-5 border-2 border-[var(--border)]"
              >
                <div className="h-6 w-3/4 bg-[var(--border)] rounded animate-pulse mb-3"></div>
                <div className="h-4 w-full bg-[var(--border)] rounded animate-pulse mb-2"></div>
                <div className="h-4 w-2/3 bg-[var(--border)] rounded animate-pulse mb-4"></div>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="flex items-center justify-between">
                      <div className="h-3 w-24 bg-[var(--border)] rounded animate-pulse"></div>
                      <div className="h-3 w-12 bg-[var(--border)] rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : totalMaps === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--surface)] rounded-full mb-4">
              <svg
                className="w-8 h-8 text-[var(--foreground)] opacity-50"
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
            <p className="text-[var(--foreground)] opacity-70 text-lg">Nenhum mapa cadastrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {maps.map((map) => (
              <div
                key={map.id}
                className="bg-[var(--surface)] rounded-xl p-5 border-2 border-[var(--border)] hover:border-blue-400 hover:shadow-lg transition-all"
              >
                <h3 className="text-[var(--foreground)] font-bold text-lg mb-3">{map.name}</h3>
                {map.description && (
                  <p className="text-[var(--foreground)] opacity-80 text-sm mb-4 line-clamp-2">
                    {map.description}
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--foreground)] font-medium">Total de Lotes:</span>
                    <span className="text-[var(--foreground)] font-bold text-base">
                      {map.totalLots}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-500 font-medium">Disponíveis:</span>
                    <span className="text-green-500 font-bold text-base">{map.availableLots}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-yellow-500 font-medium">Reservados:</span>
                    <span className="text-yellow-500 font-bold text-base">{map.reservedLots}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-500 font-medium">Vendidos:</span>
                    <span className="text-red-500 font-bold text-base">{map.soldLots}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 font-medium">Bloqueados:</span>
                    <span className="text-gray-400 font-bold text-base">{map.blockedLots}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
