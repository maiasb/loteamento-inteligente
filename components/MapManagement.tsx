'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Map } from '@/types/Map';
import { useMapOperations } from '@/hooks/useMapOperations';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import InteractiveMap from '@/components/InteractiveMap';
import axios from 'axios';

export default function MapManagement() {
  const router = useRouter();
  const { maps, isLoading, deleteMapById, loadMaps } = useMapOperations();
  const [isCreating, setIsCreating] = useState(false);
  const [editingMap, setEditingMap] = useState<Map | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapsWithReservedLots, setMapsWithReservedLots] = useState<
    Record<string, { hasReserved: boolean; count: number }>
  >({});

  // Atualiza a lista de mapas a cada 10 segundos para todos os clientes
  useRealtimeUpdates(() => {
    loadMaps();
  }, 10000);

  // Verificar lotes reservados/vendidos para cada mapa
  useEffect(() => {
    const checkReservedLots = async () => {
      const results: Record<string, { hasReserved: boolean; count: number }> = {};

      for (const map of maps) {
        try {
          const response = await axios.get('/api/mapas/verificar-lotes-reservados', {
            params: { mapId: map.id },
            timeout: 5000,
          });
          results[map.id] = {
            hasReserved: response.data.hasReservedOrSoldLots,
            count: response.data.count,
          };
        } catch (error) {
          console.error(`Erro ao verificar lotes do mapa ${map.id}:`, error);
          results[map.id] = { hasReserved: false, count: 0 };
        }
      }

      setMapsWithReservedLots(results);
    };

    if (maps.length > 0) {
      checkReservedLots();
    }
  }, [maps]);

  const handleSubmit = async () => {
    if (!editingMap?.name?.trim()) {
      alert('Por favor, preencha o nome do mapa');
      return;
    }

    setIsSubmitting(true);
    try {
      // Criar sem imagem
      const url = '/api/mapas/criar';
      const payload = {
        name: editingMap.name,
        description: editingMap.description || '',
        imageUrl: '',
        imageType: 'image/png',
        width: 800,
        height: 600,
      };

      await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      await loadMaps();

      setIsCreating(false);
      setEditingMap(null);
      alert('✅ Mapa criado com sucesso!');
    } catch {
      alert('❌ Erro ao criar mapa. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este mapa e todos os lotes associados?')) {
      try {
        await deleteMapById(id);
        alert('✅ Mapa excluído com sucesso!');
      } catch (thrown) {
        console.error('Erro ao deletar:', thrown);
        const err = thrown as { error?: string; count?: number };

        // Tratar erro de lotes reservados/vendidos
        if (err.error && err.count) {
          alert(
            `❌ Não é possível excluir este mapa\n\n` +
              `Existem ${err.count} lote(s) com reservas ou vendas ativas.\n\n` +
              `📋 O que fazer:\n` +
              `1. Acesse a página de Reservas\n` +
              `2. Cancele as reservas/vendas dos lotes deste mapa\n` +
              `3. Tente excluir o mapa novamente\n\n` +
              `💡 Dica: Você pode identificar os lotes pelos status "Reservado" ou "Vendido"`
          );
        } else if (err.error) {
          alert(`❌ Erro ao excluir mapa\n\n${err.error}`);
        } else {
          alert('❌ Erro ao deletar mapa. Verifique sua conexão e tente novamente.');
        }
      }
    }
  };

  const handleEditDetails = (map: Map) => {
    setEditingMap(map);
    setIsEditingDetails(true);
  };

  const handleUpdateDetails = async () => {
    if (!editingMap?.name?.trim()) {
      alert('Por favor, preencha o nome do mapa');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = '/api/mapas/atualizar';
      const payload = {
        id: editingMap.id,
        name: editingMap.name,
        description: editingMap.description || '',
      };

      await axios.patch(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      await loadMaps();
      setIsEditingDetails(false);
      setEditingMap(null);
      alert('✅ Mapa atualizado com sucesso!');
    } catch (error) {
      console.error('[MapManagement] Erro ao atualizar mapa:', error);
      const axiosError = axios.isAxiosError(error) ? error : null;
      const message = error instanceof Error ? error.message : undefined;
      console.error('[MapManagement] Detalhes do erro:', {
        message,
        response: axiosError?.response?.data,
        status: axiosError?.response?.status,
      });
      const errorMessage =
        axiosError?.response?.data?.error || message || 'Erro ao atualizar mapa. Tente novamente.';
      alert(`❌ ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 pr-0 lg:pr-20">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Gerenciar Loteamentos</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="px-5 py-2.5 bg-[var(--success)] text-white font-semibold rounded-xl hover:bg-[var(--success)]/90 shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <span className="text-xl font-bold">+</span>
          Novo Mapa
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--primary)] rounded-full mb-4 animate-pulse shadow-[var(--shadow-lg)]">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <p className="text-[var(--foreground)] text-lg font-semibold">Carregando mapas...</p>
        </div>
      ) : maps.length === 0 && !isCreating ? (
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
            Nenhum mapa cadastrado
          </p>
          <p className="text-[var(--foreground)] opacity-70 text-sm font-medium">
            Clique em &quot;Novo Mapa&quot; para começar
          </p>
        </div>
      ) : null}

      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-2xl shadow-2xl border-2 border-[var(--primary)]/30 my-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-[var(--foreground)] p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-bold">Novo Mapa</h2>
                    <p className="text-white opacity-90 text-sm">Cadastre um novo loteamento</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingMap(null);
                  }}
                  disabled={isSubmitting}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">
                  Nome do Loteamento *
                </label>
                <input
                  type="text"
                  value={editingMap?.name || ''}
                  onChange={(e) => setEditingMap({ ...editingMap, name: e.target.value } as Map)}
                  className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  placeholder="Ex: Chácara Jardim Ypiranga"
                />
              </div>
              <div>
                <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">
                  Descrição
                </label>
                <textarea
                  value={editingMap?.description || ''}
                  onChange={(e) =>
                    setEditingMap({ ...editingMap, description: e.target.value } as Map)
                  }
                  className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  placeholder="Descrição detalhada do loteamento"
                  rows={3}
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[var(--card-bg)] border-t border-[var(--border)] p-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingMap(null);
                }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-[var(--surface)] hover:bg-[var(--background)] text-[var(--foreground)] font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !editingMap?.name?.trim()}
                className="flex-1 px-4 py-3 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Criando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Criar Mapa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {maps.map((map) => (
          <div
            key={map.id}
            className="bg-[var(--card-bg)] border-2 border-[var(--primary)]/30 rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] transition-shadow"
          >
            <div className="h-64 bg-gradient-to-br from-[var(--surface)] to-[var(--background)] flex items-center justify-center overflow-hidden relative">
              {map.imageUrl && map.imageUrl.trim() !== '' ? (
                <div className="w-full h-full">
                  <InteractiveMap imageUrl={map.imageUrl} lots={[]} isEditMode={false} />
                </div>
              ) : (
                <div className="text-[var(--foreground)] opacity-70 text-center p-4">
                  <svg
                    className="w-16 h-16 mx-auto mb-2 text-[var(--accent)]"
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
                  <p className="text-sm font-semibold text-[var(--foreground)]">Sem imagem</p>
                </div>
              )}
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg text-[var(--foreground)] mb-2">{map.name}</h3>
              {map.description && (
                <p className="text-sm text-[var(--foreground)] opacity-70 font-medium mb-3">
                  {map.description}
                </p>
              )}
              {mapsWithReservedLots[map.id]?.hasReserved && (
                <div className="mb-3 bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-orange-800">
                        ⚠️ Lotes Reservados/Vendidos
                      </p>
                      <p className="text-xs text-orange-700">
                        {mapsWithReservedLots[map.id]?.count} lote(s) com reservas ativas
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-1 mb-4">
                <p className="text-xs text-[var(--foreground)] opacity-70 font-semibold">
                  <span className="font-bold">Dimensões:</span> {map.width} x {map.height}px
                </p>
                <p className="text-xs text-[var(--foreground)] opacity-60 font-mono bg-[var(--surface)] px-2 py-1 rounded">
                  ID: {map.id}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/map-details?mapId=${map.id}`)}
                  className="flex-1 px-4 py-2.5 bg-[var(--primary)] text-white font-semibold rounded-xl hover:bg-[var(--primary-dark)] text-center transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer"
                >
                  Gerenciar
                </button>
                <button
                  onClick={() => handleEditDetails(map)}
                  className="px-4 py-2.5 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer"
                  title="Editar nome e descrição"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                {!mapsWithReservedLots[map.id]?.hasReserved ? (
                  <button
                    onClick={() => handleDelete(map.id)}
                    disabled={isLoading}
                    className="px-4 py-2.5 bg-[var(--danger)] text-white font-semibold rounded-xl hover:bg-[var(--danger-dark)] transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[var(--shadow-md)] disabled:hover:translate-y-0 flex items-center justify-center gap-1.5"
                    title="Excluir mapa"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                ) : (
                  <div
                    className="px-4 py-2.5 bg-orange-500/90 text-white font-semibold rounded-xl cursor-not-allowed flex items-center gap-2"
                    title={`Este mapa possui ${mapsWithReservedLots[map.id]?.count || 0} lote(s) reservado(s) ou vendido(s). Cancele as reservas/vendas para poder excluir.`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Bloqueado
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Edição de Detalhes */}
      {isEditingDetails && editingMap && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-md shadow-2xl border-2 border-[var(--primary)]/30">
            <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-[var(--foreground)] p-6 rounded-t-2xl shadow-[var(--shadow-md)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-bold">Editar Mapa</h2>
                    <p className="text-white opacity-90 text-sm">Alterar informações</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditingDetails(false);
                    setEditingMap(null);
                  }}
                  disabled={isSubmitting}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={editingMap.name || ''}
                  onChange={(e) => setEditingMap({ ...editingMap, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  placeholder="Nome do mapa"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">
                  Descrição
                </label>
                <textarea
                  value={editingMap.description || ''}
                  onChange={(e) => setEditingMap({ ...editingMap, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  placeholder="Descrição do mapa"
                  rows={3}
                />
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border-t border-[var(--border)] p-6 flex gap-3">
              <button
                onClick={() => {
                  setIsEditingDetails(false);
                  setEditingMap(null);
                }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-[var(--surface)] hover:bg-[var(--background)] text-[var(--foreground)] font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateDetails}
                disabled={isSubmitting || !editingMap?.name?.trim()}
                className="flex-1 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
