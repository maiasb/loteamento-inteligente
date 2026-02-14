'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { Map, Lot, Block } from '@/types';
import LotSelector from '@/components/LotSelector';
import PublicMapViewer from '@/components/PublicMapViewer';
import PurchaseModal from '@/components/PurchaseModal';

// Forçar essa página a ser apenas client-side (sem SSG/SSR)
export const dynamic = 'force-dynamic';

const API_URL = '/api';

export default function MapViewPage() {
  const params = useParams();
  const router = useRouter();
  const mapId = params.id as string;

  const [map, setMap] = useState<Map | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [allLots, setAllLots] = useState<Lot[]>([]); // Todos os lotes do mapa
  const [lots, setLots] = useState<Lot[]>([]); // Lotes filtrados da quadra selecionada
  const [selectedLots, setSelectedLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [lotsPerRow, setLotsPerRow] = useState(15);

  const loadMapData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carregar dados apenas do mapa específico (não buscar todos)
      const mapResponse = await axios.get(`${API_URL}/mapas`, {
        params: { id: mapId },
        timeout: 10000,
      });

      // Se a API suportar filtro por ID, virá apenas um mapa, senão filtramos
      const mapsData = Array.isArray(mapResponse.data) ? mapResponse.data : [mapResponse.data];
      const mapData = mapsData.find((m: any) => m.mapId === mapId || m.id === mapId);

      if (mapData) {
        const mapObj: Map = {
          id: mapData.mapId || mapData.id || mapId,
          name: mapData.name || `Mapa ${mapData.mapId || mapId}`,
          description: mapData.description || '',
          imageUrl: mapData.imageUrl || '',
          imageType: 'image',
          width: mapData.width || 800,
          height: mapData.height || 600,
          address: mapData.address,
          overlayConfig: mapData.overlayConfig || null,
          createdAt: mapData.createdAt ? new Date(mapData.createdAt) : new Date(),
          updatedAt: mapData.updatedAt ? new Date(mapData.updatedAt) : new Date(),
        };
        setMap(mapObj);

        // Carregar quadras do mapa
        const blocksResponse = await axios.get(`${API_URL}/mapas/quadras`, {
          params: { mapId },
          timeout: 10000,
        });

        if (Array.isArray(blocksResponse.data)) {
          const blocksData = blocksResponse.data.map((block: any) => ({
            id: block.id.toString(),
            mapId: block.mapId,
            name: block.name,
            description: block.description || '',
            createdAt: new Date(block.createdAt),
            updatedAt: new Date(block.updatedAt),
          }));
          setBlocks(blocksData);

          // Carregar TODOS os lotes do mapa de uma vez
          const lotsResponse = await axios.get(`${API_URL}/mapas/lotes`, {
            params: { mapId }, // Sem blockId = todos os lotes
            timeout: 10000,
          });

          const lotsData = lotsResponse.data[0];
          if (lotsData && lotsData.lots && Array.isArray(lotsData.lots)) {
            const lotsWithMapId = lotsData.lots.map((lot: any) => {
              const blockId = lot.blockId?.toString() || null;
              const block = blocksData.find((b: Block) => b.id === blockId);
              return {
                ...lot,
                mapId: lotsData.mapId || mapId,
                blockId: blockId,
                blockName: block?.name || null, // Adicionar nome da quadra
                createdAt: lot.createdAt ? new Date(lot.createdAt) : new Date(),
                updatedAt: lot.updatedAt ? new Date(lot.updatedAt) : new Date(),
              };
            });
            setAllLots(lotsWithMapId);

            // Se houver quadras, selecionar a primeira automaticamente e filtrar lotes
            if (blocksData.length > 0) {
              const firstBlockId = blocksData[0].id;
              setSelectedBlockId(firstBlockId);
              const filteredLots = lotsWithMapId.filter((lot: Lot) => lot.blockId === firstBlockId);
              setLots(filteredLots);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do mapa:', err);
      setError('Erro ao carregar o mapa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const filterLotsByBlock = (blockId: string) => {
    if (!blockId) {
      setLots([]);
      return;
    }

    const filteredLots = allLots.filter(lot => {
      return lot.blockId === blockId;
    });
    setLots(filteredLots);
  };

  useEffect(() => {
    if (mapId) {
      loadMapData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  useEffect(() => {
    if (selectedBlockId && allLots.length > 0) {
      filterLotsByBlock(selectedBlockId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockId, allLots]);

  const handleMultipleSelect = (lots: Lot[]) => {
    setSelectedLots(lots);
  };

  const handlePurchaseClick = () => {
    if (selectedLots.length === 0) {
      alert('Selecione pelo menos um lote para continuar.');
      return;
    }
    setIsPurchaseModalOpen(true);
  };

  const handlePurchaseSuccess = async (reservationId?: string) => {
    setIsPurchaseModalOpen(false);
    setSelectedLots([]);
    
    // Redirecionar para a página da reserva se o ID for retornado
    if (reservationId) {
      // Mostrar mensagem de sucesso
      alert(`✅ Reserva criada com sucesso!\n\nSua reserva foi registrada e você será redirecionado para visualizá-la.`);
      
      // Aguardar um pouco para garantir que a reserva foi salva no banco
      await new Promise(resolve => setTimeout(resolve, 800));
      router.push(`/reservations?reservationId=${reservationId}`);
    } else {
      // Recarregar todos os lotes do mapa
      loadMapData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-white mt-4">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  if (error || !map) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Mapa não encontrado'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Voltar para Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Voltar
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">{map.name}</h1>
          {map.description && (
            <p className="text-white/70">{map.description}</p>
          )}
        </div>

        {/* Visualização do mapa com imagem (desabilitado - usando Google Maps agora) */}
        {/* {map.imageUrl && (
          <div className="mb-8 bg-[var(--card-bg)] rounded-xl p-6 shadow-[var(--shadow-md)]">
            <h2 className="text-white text-xl font-semibold mb-4">
              Visualização do Loteamento
            </h2>
            <div className="bg-white/5 rounded-lg p-4">
              Visualização com imagem desabilitada - usando mapa interativo do Google Maps
            </div>
          </div>
        )} */}

        {/* Estatísticas de Status dos Lotes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="text-white text-sm font-medium mb-1">Disponível</p>
            <p className="text-white text-4xl font-bold">
              {allLots.filter(lot => lot.status === 'available').length}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-white text-sm font-medium mb-1">Reservado</p>
            <p className="text-white text-4xl font-bold">
              {allLots.filter(lot => lot.status === 'reserved').length}
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-white text-sm font-medium mb-1">Vendido</p>
            <p className="text-white text-4xl font-bold">
              {allLots.filter(lot => lot.status === 'sold').length}
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
            <p className="text-white text-sm font-medium mb-1">Bloqueado</p>
            <p className="text-white text-4xl font-bold">
              {allLots.filter(lot => lot.status === 'blocked').length}
            </p>
          </div>
        </div>

        {/* Mapa Interativo com Overlay */}
        <div className="mb-8">
          <PublicMapViewer
            address={map?.address || undefined}
            blocks={blocks}
            lots={selectedBlockId ? lots : allLots}
            overlayConfig={map?.overlayConfig || undefined}
            onLotClick={(lot) => {
              if (lot.status === 'available') {
                const isSelected = selectedLots.some(l => l.id === lot.id);
                if (isSelected) {
                  setSelectedLots(selectedLots.filter(l => l.id !== lot.id));
                } else {
                  setSelectedLots([...selectedLots, lot]);
                }
              }
            }}
          />
        </div>

        {/* Seleção de Quadras */}
        {blocks.length > 0 && (
          <div className="mb-6 bg-[var(--card-bg)] rounded-xl p-6 shadow-[var(--shadow-md)]">
            <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtrar por Quadra
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <button
                onClick={() => setSelectedBlockId('')}
                className={`p-4 rounded-xl font-semibold transition-all ${
                  selectedBlockId === ''
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg scale-105'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                <div className="text-sm mb-1">Todas</div>
                <div className="text-lg font-bold">Quadras</div>
                <div className="text-xs mt-1 opacity-80">{allLots.length} lotes</div>
              </button>
              {blocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => {
                    setSelectedBlockId(block.id);
                  }}
                  className={`p-4 rounded-xl font-semibold transition-all ${
                    selectedBlockId === block.id
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg scale-105'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <div className="text-sm mb-1">Quadra</div>
                  <div className="text-lg font-bold">{block.name}</div>
                  {block.description && (
                    <div className="text-xs mt-1 opacity-80">{block.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {blocks.length === 0 && !loading && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
            <p className="text-yellow-500 font-semibold">
              ⚠️ Nenhuma quadra cadastrada neste loteamento.
            </p>
            <p className="text-yellow-400 text-sm mt-2">
              Os lotes podem ser selecionados diretamente no mapa acima.
            </p>
          </div>
        )}

        {/* Seletor de Lotes Estilo Grid (Alternativa) */}
        {selectedBlockId && lots.length > 0 && (
          <div className="mb-8">
            <div className="bg-[var(--card-bg)] rounded-xl p-6 shadow-[var(--shadow-md)]">
              <h2 className="text-white text-xl font-semibold mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
                  </svg>
                  Seleção em Grade - Quadra {blocks.find(b => b.id === selectedBlockId)?.name}
                </span>
                <div className="flex items-center gap-4">
                  <label className="text-white/80 text-sm">
                    Lotes por linha:
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="20"
                    value={lotsPerRow}
                    onChange={(e) => setLotsPerRow(parseInt(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-white font-medium">{lotsPerRow}</span>
                </div>
              </h2>
              <LotSelector
                lots={lots}
                onMultipleSelect={handleMultipleSelect}
                selectedLotIds={selectedLots.map(l => l.id)}
                allowMultipleSelection={true}
                lotsPerRow={lotsPerRow}
              />
            </div>
          </div>
        )}

        {/* Botão de Compra */}
        {selectedLots.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={handlePurchaseClick}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              Continuar com a Reserva ({selectedLots.length} {selectedLots.length === 1 ? 'lote' : 'lotes'})
            </button>
          </div>
        )}
      </div>

      {/* Modal de Compra */}
      {isPurchaseModalOpen && selectedLots.length > 0 && (
        <PurchaseModal
          lots={selectedLots}
          onClose={() => setIsPurchaseModalOpen(false)}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
}
