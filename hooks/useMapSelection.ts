import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Map, Lot, LotStatus, Block } from '@/types';

const API_URL = '/api';

export const useMapSelection = () => {
  const [maps, setMaps] = useState<Map[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedMap, setSelectedMap] = useState<Map | null>(null);
  const selectedMapIdRef = useRef<string | null>(null);
  const hasLoadedMapsRef = useRef(false); // Controla se já carregou mapas
  const [selectedLots, setSelectedLots] = useState<Lot[]>([]); // Mudado para array
  const [viewingLot, setViewingLot] = useState<Lot | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Buscar apenas informações dos mapas (sem lotes e sem imagens para lista)
  useEffect(() => {
    // Evitar carregamento duplicado
    if (hasLoadedMapsRef.current) return;
    hasLoadedMapsRef.current = true;

    const fetchMaps = async () => {
      try {
        // Buscar todos os mapas (sem filtro de lotes)
        const response = await axios.get(`${API_URL}/mapas?minimal=true`);
        const mapsData = response.data;

        // Validar se mapsData é um array
        if (!Array.isArray(mapsData)) {
          setMaps([]);
          setLots([]);
          setSelectedMap(null);
          return;
        }

        if (mapsData.length > 0) {
          // Processar apenas os mapas (já filtrados pela API)
          const allMaps: Map[] = mapsData
            .filter((mapData) => mapData && mapData.mapId)
            .map((mapData) => ({
              id: mapData.mapId,
              name: mapData.name || `Mapa ${mapData.mapId}`,
              imageUrl: mapData.imageUrl || '',
              imageType: mapData.imageType || 'image/png',
              width: mapData.width || 800,
              height: mapData.height || 600,
              address: mapData.address || '',
              boundaryCoordinates: mapData.boundaryCoordinates || undefined,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

          setMaps(allMaps);

          // Verificar se há um mapa selecionado válido
          const currentMapId = selectedMapIdRef.current;
          const currentMapExists = currentMapId &&
            allMaps.some(m => m.id === currentMapId);

          if (!currentMapExists && allMaps.length > 0) {
            // Não há mapa selecionado OU o mapa não existe mais: selecionar o primeiro
            const firstMap = allMaps[0];
            selectedMapIdRef.current = firstMap.id;
            
            // Definir mapa sem imagem primeiro
            setSelectedMap({ ...firstMap, imageUrl: '' });
            
            // Carregar quadras primeiro
            loadBlocksForMap(firstMap.id);
            
            // Carregar imagem separadamente
            setIsLoadingImage(true);
            axios.get(`${API_URL}/mapas/imagem`, {
              params: { mapId: firstMap.id },
              timeout: 15000,
            })
              .then(response => {
                const { imageUrl, width, height } = response.data;
                setSelectedMap({
                  ...firstMap,
                  imageUrl: imageUrl || '',
                  width: width || firstMap.width,
                  height: height || firstMap.height,
                });
              })
              .catch(error => {
                console.error('Erro ao carregar imagem do mapa:', error);
              })
              .finally(() => {
                setIsLoadingImage(false);
              });
          } else if (currentMapExists) {
            // Mapa selecionado ainda existe, carregar apenas quadras
            loadBlocksForMap(currentMapId);
          }
        } else {
          setMaps([]);
          setLots([]);
          setSelectedMap(null);
          selectedMapIdRef.current = null;
        }
      } catch (error) {
        console.error('Erro ao buscar mapas:', error);
        setMaps([]);
        setLots([]);
        setSelectedMap(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMaps();
  }, []);

  // Função para carregar quadras de um mapa específico
  const loadBlocksForMap = async (mapId: string) => {
    setIsLoadingBlocks(true);
    try {
      const response = await axios.get(`${API_URL}/mapas/quadras`, {
        params: { mapId },
        timeout: 10000,
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        const blocksData = response.data.map((block: any) => ({
          id: block.id,
          mapId: block.mapId,
          name: block.name,
          description: block.description || '',
          createdAt: new Date(block.createdAt),
          updatedAt: new Date(block.updatedAt),
        }));

        setBlocks(blocksData);
        
        // Selecionar primeira quadra automaticamente
        if (blocksData.length > 0) {
          const firstBlock = blocksData[0];
          setSelectedBlock(firstBlock);
          await loadLotsForBlock(mapId, firstBlock.id, blocksData);
        }
      } else {
        setBlocks([]);
        setSelectedBlock(null);
        setLots([]);
      }
    } catch (error) {
      console.error('❌ [Página Pública] Erro ao carregar quadras do mapa:', error);
      setBlocks([]);
      setSelectedBlock(null);
      setLots([]);
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  // Função para carregar lotes de uma quadra específica
  const loadLotsForBlock = async (mapId: string, blockId: string, blocksData?: Block[]) => {
    setIsLoadingLots(true);
    try {
      const response = await axios.get(`${API_URL}/mapas/lotes`, {
        params: { mapId, blockId },
        timeout: 10000,
      });

      // Validar se a resposta é válida
      if (!response.data) {
        console.warn('⚠️ [Página Pública] API retornou resposta vazia para /mapas/lotes');
        setLots([]);
        setIsLoadingLots(false);
        return;
      }

      // A API retorna { mapId, lots: [] }
      const responseData = response.data[0];
      
      if (responseData && Array.isArray(responseData.lots) && responseData.lots.length > 0) {
        // Buscar nome da quadra usando blocksData se fornecido, senão usa blocks do estado
        const blocksToSearch = blocksData || blocks;
        const selectedBlockData = blocksToSearch.find(b => b.id.toString() === blockId.toString());
        const blockName = selectedBlockData?.name || null;
        
        const lotsData = responseData.lots.map((lot: any) => ({
          id: lot.id?.toString() || '',
          mapId: lot.mapId?.toString() || mapId,
          blockId: lot.blockId?.toString() || blockId,
          blockName: blockName, // Adicionar nome da quadra
          lotNumber: lot.lotNumber || '',
          status: lot.status as LotStatus || LotStatus.AVAILABLE,
          price: parseFloat(lot.price) || 0,
          size: parseFloat(lot.size) || 0,
          description: lot.description || '',
          features: lot.features ? (typeof lot.features === 'string' ? JSON.parse(lot.features) : lot.features) : [],
          coordinates: lot.coordinates ? (typeof lot.coordinates === 'string' ? JSON.parse(lot.coordinates) : lot.coordinates) : undefined,
          createdAt: new Date(lot.createdAt),
          updatedAt: new Date(lot.updatedAt),
        }));

        setLots(lotsData);
      } else {
        setLots([]);
      }
    } catch (error) {
      console.error('❌ [Página Pública] Erro ao carregar lotes da quadra:', error);
      setLots([]);
    } finally {
      setIsLoadingLots(false);
    }
  };

  const handleLotClick = useCallback((lot: Lot) => {
    // Sempre abre o modal de visualização ao clicar
    setViewingLot(lot);
  }, []);

  const handleToggleLotSelection = useCallback((lot: Lot) => {
    // Toggle seleção: adiciona ou remove o lote da lista
    if (lot.status !== LotStatus.AVAILABLE) return;

    setSelectedLots(prev => {
      const isAlreadySelected = prev.some(l => l.id === lot.id);
      if (isAlreadySelected) {
        return prev.filter(l => l.id !== lot.id);
      } else {
        return [...prev, lot];
      }
    });
  }, []);

  const handleOpenPurchaseModal = useCallback(() => {
    if (selectedLots.length > 0) {
      setShowPurchaseModal(true);
    } else {
      alert('Selecione pelo menos um lote disponível antes de enviar a reserva.');
    }
  }, [selectedLots]);

  const handlePurchaseSuccess = useCallback((reservationId?: string) => {
    setShowPurchaseModal(false);
    // Recarregar dados manualmente após sucesso
    if (selectedMap) {
      loadBlocksForMap(selectedMap.id);
    }
    
    // Se não tiver reservationId (será redirecionado pela página), mostrar alerta
    if (!reservationId) {
      alert(`${selectedLots.length === 1 ? 'Seu interesse foi registrado' : 'Seus interesses foram registrados'} com sucesso! ${selectedLots.length === 1 ? 'O lote foi reservado' : 'Os lotes foram reservados'}. Entraremos em contato em breve.`);
    }
    
    setSelectedLots([]);
    return reservationId;
  }, [selectedLots.length, selectedMap]);

  const handlePurchaseClose = useCallback(() => {
    setShowPurchaseModal(false);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedLots([]);
  }, []);

  const handleViewClose = useCallback(() => {
    setViewingLot(null);
  }, []);

  const availableLotsCount = lots.filter((lot) => lot.status === LotStatus.AVAILABLE).length;
  const reservedLotsCount = lots.filter((lot) => lot.status === LotStatus.RESERVED).length;
  const soldLotsCount = lots.filter((lot) => lot.status === LotStatus.SOLD).length;

  const selectMap = useCallback(
    async (mapId: string) => {
      const map = maps.find((m) => m.id === mapId);
      
      if (!map) {
        setSelectedMap(null);
        selectedMapIdRef.current = null;
        setBlocks([]);
        setSelectedBlock(null);
        setLots([]);
        return;
      }
      
      // Definir mapa sem imagem primeiro
      setSelectedMap({ ...map, imageUrl: '' });
      selectedMapIdRef.current = mapId;
      
      // Carregar quadras primeiro
      loadBlocksForMap(mapId);
      
      // Carregar imagem separadamente de forma assíncrona
      setIsLoadingImage(true);
      try {
        const response = await axios.get(`${API_URL}/mapas/imagem`, {
          params: { mapId },
          timeout: 15000,
        });
        const { imageUrl, width, height } = response.data;
        const fullMap: Map = {
          ...map,
          imageUrl: imageUrl || '',
          width: width || map.width,
          height: height || map.height,
        };
        setSelectedMap(fullMap);
      } catch (error) {
        console.error('Erro ao carregar imagem do mapa:', error);
        // Manter o mapa selecionado mesmo sem imagem
      } finally {
        setIsLoadingImage(false);
      }
    },
    [maps]
  );

  const selectBlock = useCallback(
    async (blockId: string) => {
      const block = blocks.find((b: Block) => b.id === blockId);
      setSelectedBlock(block || null);

      if (block && selectedMap) {
        await loadLotsForBlock(selectedMap.id, blockId, blocks);
      } else {
        setLots([]);
      }
    },
    [blocks, selectedMap]
  );

  return {
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
    isLoadingStats,
    availableLotsCount,
    reservedLotsCount,
    soldLotsCount,
    handleLotClick,
    handleToggleLotSelection, // Nova função para adicionar/remover lote da seleção
    handleOpenPurchaseModal, // Nova função para abrir modal
    handleClearSelection, // Nova função para limpar seleção
    handlePurchaseSuccess,
    handlePurchaseClose,
    handleViewClose,
    selectMap,
    selectBlock,
    isLotSelected: (lotId: string) => selectedLots.some(l => l.id === lotId), // Helper para verificar se lote está selecionado
  };
};
