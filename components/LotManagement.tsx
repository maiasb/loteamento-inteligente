'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Map } from '@/types/Map';
import { Lot } from '@/types/Lot';
import { LotStatus } from '@/types/LotStatus';
import InteractiveMap from '@/components/InteractiveMap';
import LotSelector from '@/components/LotSelector';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useBlockOperations } from '@/hooks/useBlockOperations';

const API_URL = '/api';

export default function LotManagement() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapId = searchParams.get('mapId') || '';
  const blockIdParam = searchParams.get('blockId') || '';

  const [map, setMap] = useState<Map | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [viewingLot, setViewingLot] = useState<Lot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(blockIdParam);
  const [selectedBlockForNewLot, setSelectedBlockForNewLot] = useState<string>('');

  const { blocks, loadBlocks } = useBlockOperations();

  const loadData = useCallback(async () => {
    if (!mapId) return;

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
          address: data.address,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        };

        setMap(mapObj);

        if (data.lots && Array.isArray(data.lots)) {
          const lotsWithMapId = data.lots.map((lot: Lot) => ({
            ...lot,
            mapId: data.mapId || mapId,
            createdAt: new Date(lot.createdAt),
            updatedAt: new Date(lot.updatedAt),
          }));

          setLots(lotsWithMapId);
        } else {
          setLots([]);
        }
      }
    } catch (error) {
      console.error('[LotManagement] ❌ Erro ao buscar dados:', error);
      const defaultMap: Map = {
        id: mapId,
        name: `Mapa ${mapId}`,
        description: '',
        imageUrl: '',
        imageType: 'image',
        width: 800,
        height: 600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setMap(defaultMap);
      setLots([]);
      alert('Erro ao carregar dados do mapa. Usando valores padrão.');
    } finally {
      setIsLoading(false);
    }
  }, [mapId]);

  useEffect(() => {
    if (mapId) {
      loadBlocks(mapId);
    }
  }, [mapId, loadBlocks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeUpdates(() => {
    loadData();
  }, 10000);

  const reloadLots = async () => {
    try {
      const response = await axios.get(`${API_URL}/mapas/lotes`, {
        params: { mapId },
        timeout: 10000,
      });

      const data = response.data[0];
      if (data && data.lots && Array.isArray(data.lots)) {
        const lotsWithMapId = data.lots.map((lot: Lot) => ({
          ...lot,
          mapId: data.mapId || mapId,
          createdAt: new Date(lot.createdAt),
          updatedAt: new Date(lot.updatedAt),
        }));
        setLots(lotsWithMapId);
      } else {
        setLots([]);
      }
    } catch (error) {
      console.error('Erro ao recarregar lotes:', error);
    }
  };

  const saveLotToAPI = async (lot: Lot) => {
    try {
      await axios.post(`${API_URL}/mapas/lotes/criar`, lot, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      await reloadLots();
    } catch (error) {
      console.error('[LotManagement] ❌ Erro ao salvar lote:', error);
      throw error;
    }
  };

  const updateLotToAPI = async (lot: Lot) => {
    try {
      await axios.patch(`${API_URL}/mapas/lotes/atualizar`, lot, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      await reloadLots();
    } catch (error) {
      console.error('[LotManagement] ❌ Erro ao atualizar lote:', error);
      throw error;
    }
  };

  const validateLotNumber = async (lotNumber: string): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_URL}/mapas/lotes/numero-valido`, {
        params: { mapId, lotNumber },
      });
      const lotDoesNotExist = response.data.lotExists === 0;
      return lotDoesNotExist;
    } catch (error) {
      console.error('❌ Erro ao validar número do lote:', error);
      alert('Erro ao validar o número do lote. Tente novamente.');
      return false;
    }
  };

  const handleLotClick = () => {
    // Removida lógica - agora o modal gerencia tudo
  };

  const handleEditLot = async (lot: Lot) => {
    // Validações
    if (!lot.lotNumber || lot.lotNumber.trim() === '') {
      alert('❌ Número do lote é obrigatório');
      return;
    }

    const existingLot = lots.find((l) => l.id === lot.id);
    const lotNumberChanged = !existingLot || existingLot.lotNumber !== lot.lotNumber;

    if (lotNumberChanged) {
      const isNumberAvailable = await validateLotNumber(lot.lotNumber);
      if (!isNumberAvailable) {
        alert(`❌ O número do lote "${lot.lotNumber}" já está em uso. Escolha outro número.`);
        return;
      }
    }

    if (!lot.size || lot.size <= 0) {
      alert('❌ Informe o tamanho do lote (m²)');
      return;
    }

    if (!lot.pricePerM2 || lot.pricePerM2 <= 0) {
      alert('❌ Informe o preço por m² do lote');
      return;
    }

    if (!lot.price || lot.price <= 0) {
      alert('❌ O preço total do lote deve ser maior que zero');
      return;
    }

    const updatedLot: Lot = {
      ...lot,
      mapId,
      updatedAt: new Date(),
    };

    try {
      if (lot.id && lot.id !== '') {
        await updateLotToAPI(updatedLot);
      } else {
        await saveLotToAPI(updatedLot);
      }
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar lote. Tente novamente.');
    }
  };

  const handleNewLot = async () => {
    // Cria um lote temporário para o usuário preencher
    const tempLotNumber = `TEMP-${Date.now()}`;
    const newLot: Lot = {
      id: '',
      mapId,
      blockId: selectedBlockForNewLot || undefined,
      lotNumber: tempLotNumber,
      status: LotStatus.AVAILABLE,
      price: 0,
      size: 0,
      pricePerM2: 0,
      description: 'Novo lote - preencha as informações',
      features: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await saveLotToAPI(newLot);
      alert('✅ Novo lote criado! Clique nele para editar as informações.');
      setSelectedBlockForNewLot('');
    } catch (err) {
      console.error('Erro ao criar lote:', err);
      alert('Erro ao criar novo lote. Tente novamente.');
    }
  };

  if (isLoading || !map) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/map-management')}
          className="text-blue-700 hover:text-blue-900 font-medium hover:underline mb-2 transition-colors cursor-pointer"
        >
          ← Voltar para Gerência de Loteamentos
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{map.name}</h1>
            {map.description && <p className="text-gray-700 mt-1">{map.description}</p>}
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => router.push(`/admin/blocks?mapId=${mapId}`)}
              className="px-4 py-2 bg-purple-600 text-[var(--foreground)] font-medium rounded-lg hover:bg-purple-700 shadow-md transition-all hover:shadow-lg cursor-pointer"
            >
              Gerenciar Quadras
            </button>
            <button
              onClick={handleNewLot}
              className="px-4 py-2 bg-blue-600 text-[var(--foreground)] font-medium rounded-lg hover:bg-blue-700 shadow-md transition-all hover:shadow-lg cursor-pointer"
            >
              + Novo Lote
            </button>
          </div>
        </div>
      </div>

      {/* Seletor de Quadra para Novo Lote */}
      {blocks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-md mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Quadra para novo lote:</label>
            <select
              value={selectedBlockForNewLot}
              onChange={(e) => setSelectedBlockForNewLot(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sem quadra</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.name}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              {selectedBlockForNewLot
                ? `Próximo lote será criado na quadra "${blocks.find((b) => b.id === selectedBlockForNewLot)?.name}"`
                : 'Próximo lote será criado sem quadra'}
            </span>
          </div>
        </div>
      )}

      {/* Filtro de Quadras */}
      {blocks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-md mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filtrar por quadra:</label>
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as quadras</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.name}
                </option>
              ))}
            </select>
            {selectedBlockId && (
              <button
                onClick={() => setSelectedBlockId('')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Mapa (apenas visualização) */}
        {map.imageUrl && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Visualização do Mapa</h2>
            <InteractiveMap
              imageUrl={map.imageUrl}
              lots={lots}
              isEditMode={false}
              onLotClick={handleLotClick}
            />
            <p className="text-gray-500 text-sm mt-2 text-center">
              Use zoom/pan para navegar. Clique nos lotes para editar.
            </p>
          </div>
        )}

        {/* Seletor estilo Cinema */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Lotes Cadastrados</h2>
          {(() => {
            const filteredLots = selectedBlockId
              ? lots.filter((lot) => lot.blockId === selectedBlockId)
              : lots;

            return filteredLots.length > 0 ? (
              <>
                {selectedBlockId && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Mostrando {filteredLots.length} lote(s)</strong> da quadra &quot;
                      {blocks.find((b) => b.id === selectedBlockId)?.name}&quot;
                    </p>
                  </div>
                )}
                <LotSelector
                  lots={filteredLots}
                  blocks={blocks}
                  onLotEdit={handleEditLot}
                  selectedLotIds={[]}
                  allowMultipleSelection={false}
                  lotsPerRow={15}
                />
              </>
            ) : (
              <p className="text-gray-600 text-center py-8">
                {selectedBlockId
                  ? `Nenhum lote cadastrado na quadra "${blocks.find((b) => b.id === selectedBlockId)?.name}". Clique em "Novo Lote" para começar.`
                  : 'Nenhum lote cadastrado ainda. Clique em "Novo Lote" para começar.'}
              </p>
            );
          })()}
        </div>
      </div>

      {/* Modal de Visualização (lotes reservados/vendidos) */}
      {viewingLot && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setViewingLot(null)}
        >
          <div
            className="bg-[var(--card-bg)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-6 py-4 rounded-t-2xl ${
                viewingLot.status === LotStatus.RESERVED
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                  : 'bg-gradient-to-r from-red-500 to-red-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--foreground)]">
                    Lote {viewingLot.lotNumber}
                  </h2>
                  <p className="text-[var(--foreground)] opacity-90 text-sm mt-1">
                    {viewingLot.status === LotStatus.RESERVED ? '🔒 Reservado' : '✓ Vendido'}
                  </p>
                </div>
                <button
                  onClick={() => setViewingLot(null)}
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

            <div className="p-6 space-y-6">
              <div
                className={`rounded-xl p-4 border-2 ${
                  viewingLot.status === LotStatus.RESERVED
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-red-50 border-red-300'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    viewingLot.status === LotStatus.RESERVED ? 'text-amber-800' : 'text-red-800'
                  }`}
                >
                  {viewingLot.status === LotStatus.RESERVED
                    ? '⚠️ Este lote está reservado e não pode ser editado.'
                    : '✓ Este lote foi vendido e não pode ser editado.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-1">
                    Número
                  </label>
                  <p className="text-xl font-bold text-[var(--foreground)]">
                    {viewingLot.lotNumber}
                  </p>
                </div>
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-1">
                    Área
                  </label>
                  <p className="text-xl font-bold text-[var(--foreground)]">{viewingLot.size} m²</p>
                </div>
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] md:col-span-2">
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

              {viewingLot.description && (
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-2">
                    Descrição
                  </label>
                  <p className="text-[var(--foreground)]">{viewingLot.description}</p>
                </div>
              )}

              {viewingLot.features && viewingLot.features.length > 0 && (
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)] opacity-70 mb-3">
                    Características
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {viewingLot.features.map((feature, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-4">
              <button
                onClick={() => setViewingLot(null)}
                className="px-6 py-2.5 text-sm font-medium text-[var(--foreground)] bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
