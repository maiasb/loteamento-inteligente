'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { Map, Block } from '@/types';
import { useBlockOperations } from '@/hooks/useBlockOperations';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

const API_URL = '/api';

export default function BlockManagement() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapId = searchParams.get('mapId') || '';

  const [map, setMap] = useState<Map | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [lotCounts, setLotCounts] = useState<Record<string, number>>({});

  const { blocks, isLoading, loadBlocks, createBlock, updateBlock, deleteBlock } = useBlockOperations();

  useEffect(() => {
    if (mapId) {
      loadMapData();
      loadBlocks(mapId);
    }
  }, [mapId, loadBlocks]);

  // Atualização em tempo real
  useRealtimeUpdates(() => {
    if (mapId) {
      loadBlocks(mapId);
      loadLotCounts();
    }
  }, 10000);

  const loadMapData = async () => {
    try {
      const response = await axios.get(`${API_URL}/mapas/lotes`, {
        params: { mapId },
        timeout: 10000,
      });

      const data = response.data[0];
      if (data) {
        const mapObj: Map = {
          id: data.mapId || data.id || mapId,
          name: data.name || `Mapa ${data.mapId || mapId}`,
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          imageType: 'image',
          width: data.width || 800,
          height: data.height || 600,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        };
        setMap(mapObj);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do mapa:', error);
    }
  };

  const loadLotCounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/mapas/lotes`, {
        params: { mapId },
        timeout: 10000,
      });

      const data = response.data[0];
      if (data && data.lots) {
        const counts: Record<string, number> = {};
        data.lots.forEach((lot: any) => {
          if (lot.blockId) {
            counts[lot.blockId] = (counts[lot.blockId] || 0) + 1;
          }
        });
        setLotCounts(counts);
      }
    } catch (error) {
      console.error('Erro ao carregar contagem de lotes:', error);
    }
  };

  useEffect(() => {
    if (mapId) {
      loadLotCounts();
    }
  }, [mapId]);

  const handleCreateBlock = () => {
    setEditingBlock({
      id: '',
      mapId,
      name: '',
      description: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setIsCreating(true);
  };

  const handleEditBlock = (block: Block) => {
    setEditingBlock({ ...block });
    setIsCreating(true);
  };

  const handleSaveBlock = async () => {
    if (!editingBlock) return;

    if (!editingBlock.name || editingBlock.name.trim() === '') {
      alert('❌ Nome da quadra é obrigatório');
      return;
    }

    try {
      if (editingBlock.id) {
        await updateBlock(editingBlock);
      } else {
        await createBlock({
          mapId: editingBlock.mapId,
          name: editingBlock.name,
          description: editingBlock.description,
        });
      }
      setIsCreating(false);
      setEditingBlock(null);
    } catch (error) {
      console.error('Erro ao salvar quadra:', error);
      alert('Erro ao salvar quadra. Tente novamente.');
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    const lotCount = lotCounts[blockId] || 0;
    
    const message = lotCount > 0
      ? `Esta quadra possui ${lotCount} lote(s) cadastrado(s) que serão excluídos.\n\nTem certeza que deseja continuar?`
      : 'Tem certeza que deseja excluir esta quadra?';

    if (confirm(message)) {
      try {
        await deleteBlock(blockId, mapId);
      } catch (error) {
        console.error('Erro ao deletar quadra:', error);
        alert('Erro ao deletar quadra. Tente novamente.');
      }
    }
  };

  if (!map) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6">
        <p className="text-[var(--foreground)]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-6">
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/map-management')}
          className="text-[var(--accent)] hover:text-[var(--accent-light)] font-medium hover:underline mb-4 transition-colors cursor-pointer"
        >
          ← Voltar para Gerência de Loteamentos
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">{map.name} - Quadras</h1>
            {map.description && <p className="text-[var(--foreground)] opacity-70 mt-1">{map.description}</p>}
          </div>
          <button
            onClick={handleCreateBlock}
            className="px-5 py-2.5 bg-[var(--accent)] text-[#1c1c1c] font-semibold rounded-xl hover:bg-[var(--accent-light)] shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer"
          >
            + Nova Quadra
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)]/20 rounded-full mb-4 shadow-md">
            <svg className="w-8 h-8 text-[var(--accent)] animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-[var(--foreground)] font-semibold">Carregando quadras...</p>
        </div>
      ) : blocks.length === 0 && !isCreating ? (
        <div className="text-center py-12 bg-[var(--card-bg)] rounded-2xl border-2 border-dashed border-[var(--accent)]/40 shadow-[var(--shadow-md)]">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)]/20 rounded-full mb-4 shadow-md">
            <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-[var(--foreground)] text-lg font-semibold mb-2">Nenhuma quadra cadastrada</p>
          <p className="text-[var(--foreground)] opacity-70 text-sm font-medium">Clique em "Nova Quadra" para começar</p>
        </div>
      ) : null}

      {/* Modal de Criação/Edição */}
      {isCreating && editingBlock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl border-2 border-[var(--primary)]/30">
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {editingBlock.id ? 'Editar Quadra' : 'Nova Quadra'}
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
                  Nome da Quadra *
                </label>
                <input
                  type="text"
                  value={editingBlock.name}
                  onChange={(e) => setEditingBlock({ ...editingBlock, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] font-medium focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] shadow-[var(--shadow-sm)]"
                  placeholder="Ex: Quadra A, Quadra 1, Setor Norte"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
                  Descrição
                </label>
                <textarea
                  value={editingBlock.description || ''}
                  onChange={(e) => setEditingBlock({ ...editingBlock, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] font-medium focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] shadow-[var(--shadow-sm)]"
                  placeholder="Descrição opcional da quadra"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingBlock(null);
                }}
                className="flex-1 px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] font-semibold rounded-xl hover:bg-[var(--surface-hover)] transition-colors shadow-[var(--shadow-sm)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBlock}
                className="flex-1 px-4 py-2.5 bg-[var(--primary)] text-[var(--foreground)] font-semibold rounded-xl hover:bg-[var(--primary-dark)] transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Quadras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blocks.map((block) => {
          const lotCount = lotCounts[block.id] || 0;
          
          return (
            <div key={block.id} className="bg-white border-2 border-[var(--primary)]/30 rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] transition-shadow">
              <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] p-5">
                <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">{block.name}</h3>
                <p className="text-[var(--foreground)] opacity-80 text-sm font-medium">
                  {lotCount} {lotCount === 1 ? 'lote cadastrado' : 'lotes cadastrados'}
                </p>
              </div>
              <div className="p-5">
                {block.description && (
                  <p className="text-sm text-[var(--foreground)]/70 font-medium mb-4">{block.description}</p>
                )}
                <div className="space-y-1 mb-4">
                  <p className="text-xs text-[var(--foreground)]/60 font-mono bg-[var(--surface)] px-2 py-1 rounded">
                    ID: {block.id}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/lot-management?mapId=${mapId}&blockId=${block.id}`}
                    className="flex-1 px-4 py-2.5 bg-[var(--success)] text-[var(--foreground)] font-semibold rounded-xl hover:bg-[var(--success-dark)] text-center transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer"
                  >
                    Ver Lotes
                  </Link>
                  <button
                    onClick={() => handleEditBlock(block)}
                    className="px-4 py-2.5 bg-[var(--primary)] text-[var(--foreground)] font-semibold rounded-xl hover:bg-[var(--primary-dark)] transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    disabled={isLoading}
                    className="px-4 py-2.5 bg-[var(--danger)] text-[var(--foreground)] font-semibold rounded-xl hover:bg-[var(--danger-dark)] transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--danger)]"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
