'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Map, Block, Lot, LotStatus, GeoCoordinate } from '@/types';
import { useBlockOperations } from '@/hooks/useBlockOperations';
import { loadPdfJs } from '@/lib/pdfjs-wrapper';
import LotSelector from '@/components/LotSelector';
import InteractiveMap from '@/components/InteractiveMap';
import PublicMapViewer from '@/components/PublicMapViewer';
import LotPolygonEditor from '@/components/LotPolygonEditor';
import { useAuth } from '@/contexts/AuthContext';
import MapBoundaryEditor from './MapBoundaryEditor';

const API_URL = '/api';

export default function MapDetails() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapId = searchParams.get('mapId') || '';
  const { user } = useAuth();

  const [map, setMap] = useState<Map | null>(null);
  const [allMaps, setAllMaps] = useState<Map[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger para forçar refresh dos cards
  
  // Estados para estatísticas
  const [lotStats, setLotStats] = useState({
    available: 0,
    reserved: 0,
    sold: 0,
    blocked: 0
  });
  
  // Estados para modais
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [isAddingLot, setIsAddingLot] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [selectedBlockForLot, setSelectedBlockForLot] = useState<string>('');
  const [canSubmitLot, setCanSubmitLot] = useState(false);
  const [submitLotFn, setSubmitLotFn] = useState<(() => void) | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedBlockLots, setSelectedBlockLots] = useState<Lot[]>([]); // Lotes da quadra selecionada
  const [isLoadingBlockLots, setIsLoadingBlockLots] = useState(false);
  const [allLotsInMap, setAllLotsInMap] = useState<Lot[]>([]); // Todos os lotes do mapa para validação
  
  // Estados para seleção múltipla
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedLots, setSelectedLots] = useState<Lot[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Estados para criar novo mapa
  const [isCreatingMap, setIsCreatingMap] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapDescription, setNewMapDescription] = useState('');
  const [isSubmittingMap, setIsSubmittingMap] = useState(false);
  
  // Estados para deletar mapa
  const [isDeletingMap, setIsDeletingMap] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Estados para editar mapa
  const [isEditingMap, setIsEditingMap] = useState(false);
  const [editMapName, setEditMapName] = useState('');
  const [editMapDescription, setEditMapDescription] = useState('');
  const [isSubmittingMapEdit, setIsSubmittingMapEdit] = useState(false);

  // Estados para configurar área do mapa
  const [isConfiguringLocation, setIsConfiguringLocation] = useState(false);
  const [editingLotPolygon, setEditingLotPolygon] = useState<Lot | null>(null);
  const [showLotSelectionModal, setShowLotSelectionModal] = useState(false);
  const [isConfiguringBlockArea, setIsConfiguringBlockArea] = useState(false);
  const [editingBlockArea, setEditingBlockArea] = useState<Block | null>(null);
  
  // Estados para controlar visualização filtrada no mapa principal
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null); // ID da quadra em foco
  const [focusedLotId, setFocusedLotId] = useState<string | null>(null); // ID do lote em foco

  const { blocks, loadBlocks, createBlock, updateBlock, deleteBlock } = useBlockOperations();

  // Função para alternar seleção de lote
  const handleToggleLotSelection = (lot: Lot) => {
    setSelectedLots(prev => {
      const isSelected = prev.some(l => l.id === lot.id);
      if (isSelected) {
        return prev.filter(l => l.id !== lot.id);
      } else {
        return [...prev, lot];
      }
    });
  };

  // Função para verificar se lote está selecionado
  const isLotSelected = (lotId: string) => {
    return selectedLots.some(l => l.id === lotId);
  };

  // Função para limpar seleção
  const handleClearSelection = () => {
    setSelectedLots([]);
  };

  // Limpar seleção ao mudar de quadra ou desativar multi-select
  useEffect(() => {
    if (!multiSelectMode) {
      setSelectedLots([]);
    }
  }, [multiSelectMode]);

  useEffect(() => {
    setSelectedLots([]);
  }, [selectedBlockId]);

  // Função para buscar reservas de uma quadra específica
  const fetchReservations = useCallback(async (blockId?: string) => {
    try {
      const params = blockId ? { blockId, minimal: true } : {};
      const response = await axios.get('/api/reservas', { params });
      setReservations(response.data);
    } catch (error) {
      console.error('Erro ao buscar reservas:', error);
      setReservations([]);
    }
  }, []);

  // Função para carregar lotes de uma quadra específica
  const loadLotsForBlock = useCallback(async (blockId: string) => {
    if (!mapId) return [];

    try {
      const response = await axios.get(`${API_URL}/mapas/lotes`, {
        params: { mapId, blockId },
        timeout: 10000,
      });

      const data = response.data[0];
      if (data && data.lots && Array.isArray(data.lots)) {
        return data.lots.map((lot: Lot) => ({
          ...lot,
          mapId: data.mapId || mapId,
          createdAt: new Date(lot.createdAt),
          updatedAt: new Date(lot.updatedAt),
        }));
      }
      return [];
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao buscar lotes da quadra:', error);
      return [];
    }
  }, [mapId]);

  // Função para carregar lotes apenas da quadra selecionada
  const loadSelectedBlockLots = useCallback(async (blockId: string) => {
    if (!mapId || !blockId) {
      setSelectedBlockLots([]);
      return;
    }

    setIsLoadingBlockLots(true);
    try {
      const lots = await loadLotsForBlock(blockId);
      setSelectedBlockLots(lots);
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao carregar lotes da quadra:', error);
      setSelectedBlockLots([]);
    } finally {
      setIsLoadingBlockLots(false);
    }
  }, [mapId, loadLotsForBlock]);

  // Função para carregar todos os lotes do mapa (para validação de exclusão)
  const loadAllLotsInMap = useCallback(async () => {
    if (!mapId) return;

    try {
      const response = await axios.get(`${API_URL}/mapas/lotes`, {
        params: { mapId },
        timeout: 15000,
      });

      // A API retorna [{ mapId, lots: [...] }] ou diretamente [...]
      let lotsArray: Lot[] = [];
      
      if (response.data && Array.isArray(response.data)) {
        if (response.data.length > 0 && response.data[0].lots) {
          // Formato: [{ mapId, lots: [...] }]
          lotsArray = response.data[0].lots;
        } else {
          // Formato: [...]
          lotsArray = response.data;
        }
        
        setAllLotsInMap(lotsArray);
      } else {
        setAllLotsInMap([]);
      }
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao carregar todos os lotes:', error);
      setAllLotsInMap([]);
    }
  }, [mapId]);

  // Função para carregar apenas as estatísticas dos lotes (otimizada)
  const loadLotStats = useCallback(async () => {
    if (!mapId) return;

    try {
      setIsLoadingStats(true);
      
      const response = await axios.get(`${API_URL}/mapas/lotes/stats`, {
        params: { mapId },
        timeout: 10000,
      });

      if (response.data) {
        setLotStats({
          available: response.data.available || 0,
          reserved: response.data.reserved || 0,
          sold: response.data.sold || 0,
          blocked: response.data.blocked || 0
        });
      }
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao carregar stats dos lotes:', error);
      // Se falhar, reseta para 0
      setLotStats({
        available: 0,
        reserved: 0,
        sold: 0,
        blocked: 0
      });
    } finally {
      setIsLoadingStats(false);
    }
  }, [mapId]);

  // Função para carregar a imagem de um mapa específico
  const loadMapImage = useCallback(async (mapIdToLoad: string) => {
    if (!mapIdToLoad) return;
    
    setIsLoadingImage(true);
    try {
      const response = await axios.get(`${API_URL}/mapas/imagem`, {
        params: { mapId: mapIdToLoad },
        timeout: 30000, // Timeout maior para imagens (30 segundos)
      });

      if (!response?.data) {
        console.warn('[MapDetails] Resposta vazia ao carregar imagem');
        setIsLoadingImage(false);
        return;
      }

      const { imageUrl, width, height } = response.data;

      // Atualizar o mapa atual se for o mesmo
      setMap(prevMap => {
        if (prevMap && prevMap.id === mapIdToLoad) {
          return {
            ...prevMap,
            imageUrl: imageUrl || '',
            width: width || prevMap.width,
            height: height || prevMap.height,
          };
        }
        return prevMap;
      });

      // Atualizar na lista de todos os mapas também
      setAllMaps(prevMaps => 
        prevMaps.map(m => 
          m.id === mapIdToLoad 
            ? { ...m, imageUrl: imageUrl || '', width: width || m.width, height: height || m.height }
            : m
        )
      );
    } catch (error: any) {
      // Silenciar erro 404 - endpoint pode não existir em alguns ambientes
      if (error.response?.status !== 404) {
        console.error('[MapDetails] ❌ Erro ao carregar imagem do mapa:', error);
      }
      // Não mostra erro ao usuário, apenas loga (imagem é opcional)
    } finally {
      setIsLoadingImage(false);
    }
  }, []);

  const loadMapData = useCallback(async (currentMapId?: string) => {
    const targetMapId = currentMapId || mapId;
    try {
      // Buscar mapas completos
      const response = await axios.get(`${API_URL}/mapas`, {
        timeout: 10000,
      });

      const mapsData = response.data;
      const formattedMaps: Map[] = mapsData.map((m: any) => ({
        id: m.mapId || m.id,
        name: m.name || `Mapa ${m.mapId || m.id}`,
        description: m.description || '',
        imageUrl: m.imageUrl || m.image_url || '',
        imageType: 'image',
        width: m.width || 800,
        height: m.height || 600,
        address: m.address || '',
        boundaryCoordinates: m.boundaryCoordinates || undefined,
        createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
      }));
      
      setAllMaps(formattedMaps);

      // Se tem mapId, buscar o mapa específico
      if (targetMapId) {
        const data = mapsData.find((m: any) => m.mapId === targetMapId || m.id === targetMapId);
        
        if (data) {
          const mapObj: Map = {
            id: data.mapId || data.id || targetMapId,
            name: data.name || `Mapa ${data.mapId || targetMapId}`,
            description: data.description || '',
            imageUrl: data.imageUrl || data.image_url || '',
            imageType: 'image',
            width: data.width || 800,
            height: data.height || 600,
            address: data.address || '',
            boundaryCoordinates: data.boundaryCoordinates || undefined,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          };
          setMap(mapObj);
        } else {
          setMap(null);
        }
      } else {
        // Se não tem mapId, selecionar o primeiro mapa
        if (formattedMaps.length > 0) {
          const firstMap = formattedMaps[0];
          router.push(`/admin/map-details?mapId=${firstMap.id}`);
        } else {
          setMap(null);
        }
      }
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao buscar dados:', error);
      // Em caso de erro, cria um mapa padrão
      const defaultMap: Map = {
        id: targetMapId,
        name: `Mapa ${targetMapId}`,
        description: '',
        imageUrl: '',
        imageType: 'image',
        width: 800,
        height: 600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setMap(defaultMap);
    } finally {
      setIsLoading(false);
    }
  }, [mapId, router]);

  // Flag para controlar se já inicializou
  const hasInitialized = useRef(false);

  // Carregar dados iniciais apenas uma vez quando o componente montar
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      
      const initializeData = async () => {
        await loadMapData(mapId);
        
        // Após carregar mapas, se tem mapId, carregar dados específicos
        if (mapId && mapId.trim() !== '') {
          loadBlocks(mapId);
          loadLotStats();
          loadMapImage(mapId);
        }
      };
      
      initializeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar quadras quando o mapId da URL estiver disponível após o carregamento inicial
  useEffect(() => {
    if (hasInitialized.current && mapId && mapId.trim() !== '' && blocks.length === 0) {
      // Carregar quadras se ainda não foram carregadas
      loadBlocks(mapId);
      loadLotStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, blocks.length]);

  // Detectar mudança de mapId (quando usuário troca de mapa via seletor)
  const previousMapIdRef = useRef<string>('');
  useEffect(() => {
    // Ignorar a primeira execução (montagem inicial)
    if (!hasInitialized.current) {
      return;
    }
    
    // Apenas executar se o mapId mudou
    if (previousMapIdRef.current && previousMapIdRef.current !== mapId) {
      // Limpar estado anterior
      setSelectedBlockLots([]);
      setSelectedBlockId('');
      setReservations([]);
    }
    
    // Carregar dados sempre que mapId estiver definido
    if (mapId && mapId.trim() !== '') {
      // Atualizar o mapa atual baseado no mapId da URL
      const selectedMap = allMaps.find(m => m.id === mapId);
      if (selectedMap) {
        setMap(selectedMap);
      }
      
      loadBlocks(mapId);
      loadLotStats();
      loadMapImage(mapId);
      loadAllLotsInMap();
    }
    
    previousMapIdRef.current = mapId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // Selecionar automaticamente a primeira quadra quando as quadras forem carregadas
  useEffect(() => {
    if (blocks && blocks.length > 0 && !selectedBlockId) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [blocks, selectedBlockId]);

  // Carregar lotes e reservas quando a quadra selecionada mudar
  useEffect(() => {
    if (selectedBlockId && mapId) {
      loadSelectedBlockLots(selectedBlockId);
      fetchReservations(selectedBlockId);
    } else {
      setSelectedBlockLots([]);
      setReservations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockId, mapId]);

  // Recarregar estatísticas e lotes da quadra quando houver mudanças (refresh manual)
  useEffect(() => {
    if (mapId && refreshTrigger > 0) {
      loadLotStats();
      if (selectedBlockId) {
        loadSelectedBlockLots(selectedBlockId);
        fetchReservations(selectedBlockId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // Polling automático removido - atualização manual apenas
  // useRealtimeUpdates(() => {
  //   if (mapId) {
  //     loadMapData();
  //     loadBlocks(mapId);
  //     fetchReservations(); // Recarregar reservas também
  //   }
  // }, 10000);

  const handleAddBlock = () => {
    setEditingBlock({
      id: '',
      mapId,
      name: '',
      description: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setIsAddingBlock(true);
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
        alert('✅ Quadra atualizada com sucesso!');
      } else {
        await createBlock({
          mapId: editingBlock.mapId,
          name: editingBlock.name,
          description: editingBlock.description,
        });
        alert('✅ Quadra criada com sucesso!');
      }
      setIsAddingBlock(false);
      setEditingBlock(null);
    } catch (error) {
      console.error('Erro ao salvar quadra:', error);
      alert('❌ Erro ao salvar quadra. Tente novamente.');
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      // Busca lotes da quadra para informar o usuário
      const lotsInBlock = await loadLotsForBlock(blockId);
      
      const message = lotsInBlock.length > 0
        ? `Esta quadra possui ${lotsInBlock.length} lote(s) cadastrado(s) que serão excluídos.\n\nTem certeza que deseja continuar?`
        : 'Tem certeza que deseja excluir esta quadra?';

      if (confirm(message)) {
        await deleteBlock(blockId, mapId);
        
        // Recarregar quadras para atualizar o mapa
        await loadBlocks(mapId);
        
        // Recarregar todos os lotes do mapa
        await loadAllLotsInMap();
        
        // Se a quadra excluída estava selecionada, limpar seleção
        if (selectedBlockId === blockId) {
          setSelectedBlockId('');
          setSelectedBlockLots([]);
        }
        
        // Limpar foco se a quadra excluída estava focada
        if (focusedBlockId === blockId) {
          setFocusedBlockId(null);
        }
        
        alert('✅ Quadra excluída com sucesso!');
      }
    } catch (error: any) {
      console.error('Erro ao deletar quadra:', error);
      
      // Tratar erro de lotes reservados/vendidos
      if (error.error && error.count) {
        alert(
          `❌ Não é possível excluir esta quadra\n\n` +
          `Existem ${error.count} lote(s) com reservas ou vendas ativas.\n\n` +
          `📋 O que fazer:\n` +
          `1. Acesse a página de Reservas\n` +
          `2. Cancele as reservas/vendas dos lotes desta quadra\n` +
          `3. Tente excluir a quadra novamente\n\n` +
          `💡 Dica: Você pode identificar os lotes pelos status "Reservado" ou "Vendido"`
        );
      } else if (error.error) {
        alert(`❌ Erro ao excluir quadra\n\n${error.error}`);
      } else {
        alert('❌ Erro ao deletar quadra. Verifique sua conexão e tente novamente.');
      }
    }
  };

  // Funções de validação para exclusão
  const hasReservedOrSoldLotsInBlock = (blockId: string): boolean => {    
    const lotsInBlock = allLotsInMap.filter(lot => String(lot.blockId) === String(blockId));
    const hasReservedOrSold = lotsInBlock.some(lot => 
      lot.status === LotStatus.RESERVED || lot.status === LotStatus.SOLD
    );
    
    return hasReservedOrSold;
  };

  const hasReservedOrSoldLotsInMap = (): boolean => {
    return (lotStats.reserved > 0 || lotStats.sold > 0);
  };

  const handleAddLotToBlock = (blockId: string) => {
    setSelectedBlockForLot(blockId);
    setIsAddingLot(true);
  };

  const handleSaveLot = async (lot: Lot) => {
    try {
      
      if (!lot.lotNumber || lot.lotNumber.trim() === '') {
        alert('❌ Número do lote é obrigatório');
        return;
      }

      if (!lot.size || lot.size <= 0) {
        alert('❌ Informe o tamanho do lote (m²)');
        return;
      }

      if (!lot.price || lot.price <= 0) {
        alert('❌ O preço total do lote deve ser maior que zero');
        return;
      }

      const lotToSave = {
        id: lot.id,
        mapId: mapId,
        blockId: lot.blockId || selectedBlockForLot || null,
        lotNumber: lot.lotNumber,
        status: lot.status,
        price: lot.price,
        pricePerM2: lot.pricePerM2,
        size: lot.size,
        description: lot.description || '',
        features: lot.features || [],
      };

      if (lot.id && lot.id !== '') {
        const response = await axios.patch(`${API_URL}/mapas/lotes/atualizar`, lotToSave, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
      } else {
        const response = await axios.post(`${API_URL}/mapas/lotes/criar`, {
          ...lotToSave,
          id: Date.now().toString(),
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
      }

      // Força refresh apenas dos cards de quadra
      setRefreshTrigger(prev => prev + 1);
      setIsAddingLot(false);
      setSelectedBlockForLot('');
      alert('✅ Lote salvo com sucesso!');
    } catch (error: any) {
      console.error('[MapDetails] ❌ Erro ao salvar lote:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao salvar lote. Tente novamente.';
      alert(`❌ ${errorMessage}`);
    }
  };

  const handleEditLot = async (lot: Lot) => {
    await handleSaveLot(lot);
    // Força refresh dos cards após editar lote
    setRefreshTrigger(prev => prev + 1);
  };

  const handleToggleLotStatus = async (lotId: string, currentStatus: LotStatus) => {
    try {
      // Buscar o lote apenas na quadra selecionada
      const lot = selectedBlockLots.find((l: Lot) => l.id === lotId);

      if (!lot) {
        throw new Error('Lote não encontrado');
      }

      const newStatus = currentStatus === LotStatus.BLOCKED ? LotStatus.AVAILABLE : LotStatus.BLOCKED;

      // Atualizar via API
      await axios.patch(`${API_URL}/mapas/lotes/atualizar`, {
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

      // Força refresh dos cards após alterar status
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Erro ao alterar status do lote:', error);
      throw error;
    }
  };

  const handleDeleteLot = async (lotId: string) => {
    try {
      
      // Buscar o lote apenas na quadra selecionada
      const lot = selectedBlockLots.find((l: Lot) => l.id === lotId);

      if (!lot) {
        throw new Error('Lote não encontrado.');
      }

      // Verificar se o lote está reservado ou vendido
      if (lot.status === LotStatus.RESERVED || lot.status === LotStatus.SOLD) {
        alert(
          `❌ Não é possível excluir este lote\n\n` +
          `O lote está ${lot.status === LotStatus.RESERVED ? 'reservado' : 'vendido'}.\n\n` +
          `📋 O que fazer:\n` +
          `1. Acesse a página de Reservas\n` +
          `2. Cancele a ${lot.status === LotStatus.RESERVED ? 'reserva' : 'venda'}\n` +
          `3. Tente excluir o lote novamente`
        );
        return;
      }

      const response = await axios.delete(`${API_URL}/mapas/lotes/deletar?lotId=${lotId}`, {
        timeout: 10000,
      });

      // Recarregar lotes da quadra selecionada
      if (selectedBlockId) {
        const updatedLots = await loadLotsForBlock(selectedBlockId);
        setSelectedBlockLots(updatedLots);
      }
      
      // Recarregar todos os lotes do mapa para atualizar visualização
      await loadAllLotsInMap();
      
      // Limpar foco se o lote excluído estava focado
      if (focusedLotId === lotId) {
        setFocusedLotId(null);
      }

      // Força refresh dos cards após excluir lote
      setRefreshTrigger(prev => prev + 1);
      alert('✅ Lote excluído com sucesso!');
    } catch (error: any) {
      console.error('[MapDetails] ❌ Erro ao excluir lote:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao excluir lote. Tente novamente.';
      alert(`❌ ${errorMessage}`);
      throw error;
    }
  };

  const saveBoundaryCoordinates = async (coordinates: GeoCoordinate[], address: string) => {
    if (!mapId || !map) return;
    
    try {
      await axios.post('/api/mapas/configurar-area', {
        mapId,
        address,
        boundaryCoordinates: coordinates
      });
      
      alert('✅ Área configurada com sucesso!');
      setIsConfiguringLocation(false);
      
      // Atualizar o estado local do mapa imediatamente
      setMap(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          address,
          boundaryCoordinates: coordinates
        };
      });
      
      // Recarregar dados do mapa para garantir sincronização
      await loadMapData(mapId);
    } catch (error) {
      console.error('Erro ao salvar boundary:', error);
      alert('❌ Erro ao salvar área. Tente novamente.');
    }
  };

  const saveLotCoordinates = async (lotId: string, coordinates: GeoCoordinate[]) => {
    if (!mapId) return;
    
    try {
      const lot = allLotsInMap.find(l => l.id === lotId) || selectedBlockLots.find(l => l.id === lotId);
      if (!lot) return;
      
      await axios.patch('/api/mapas/lotes/atualizar', {
        id: lotId,
        mapId: lot.mapId || mapId,
        blockId: lot.blockId,
        lotNumber: lot.lotNumber,
        coordinates,
        status: lot.status,
        price: lot.price,
        size: lot.size,
        description: lot.description,
        features: lot.features,
      });
      
      alert('✅ Coordenadas do lote salvas com sucesso!');
      setEditingLotPolygon(null);
      setShowLotSelectionModal(false);
      
      // Recarregar lotes da quadra
      if (selectedBlockId) {
        await loadSelectedBlockLots(selectedBlockId);
      }
      
      // Recarregar todos os lotes do mapa
      await loadAllLotsInMap();
    } catch (error) {
      console.error('Erro ao salvar coordenadas do lote:', error);
      alert('❌ Erro ao salvar coordenadas. Tente novamente.');
    }
  };

  const saveBlockCoordinates = async (blockId: string, coordinates: GeoCoordinate[]) => {
    if (!mapId) return;
    
    try {
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      
      await updateBlock({
        ...block,
        coordinates,
      });
      
      alert('✅ Coordenadas da quadra salvas com sucesso!');
      setIsConfiguringBlockArea(false);
      setEditingBlockArea(null);
      
      // Recarregar quadras para atualizar as coordenadas
      await loadBlocks(mapId);
    } catch (error) {
      console.error('Erro ao salvar coordenadas da quadra:', error);
      alert('❌ Erro ao salvar coordenadas. Tente novamente.');
    }
  };

  const handleCreateMap = async () => {
    if (!newMapName.trim()) {
      alert('Por favor, informe o nome do loteamento');
      return;
    }

    setIsSubmittingMap(true);
    try {
      const response = await axios.post('/api/mapas/criar', {
        name: newMapName,
        description: newMapDescription,
        imageUrl: '',
        width: 800,
        height: 600,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const newMapId = response.data.mapId || response.data.id;
      
      alert('✅ Loteamento criado com sucesso!');
      setIsCreatingMap(false);
      setNewMapName('');
      setNewMapDescription('');
      
      // Recarregar lista de mapas
      await loadMapData();
      
      // Redirecionar para o novo mapa
      router.push(`/admin/map-details?mapId=${newMapId}`);
    } catch (error: any) {
      console.error('Erro ao criar mapa:', error);
      alert(error.response?.data?.error || '❌ Erro ao criar loteamento. Tente novamente.');
    } finally {
      setIsSubmittingMap(false);
    }
  };

  const handleDeleteMap = async () => {
    if (!mapId) return;
    
    setIsDeletingMap(true);
    try {
      await axios.delete(`${API_URL}/mapas/deletar?mapId=${mapId}`, {
        timeout: 15000,
      });

      alert('✅ Loteamento excluído com sucesso!');
      setShowDeleteConfirm(false);
      
      // Recarregar lista de mapas
      await loadMapData();
      
      // Redirecionar para o primeiro mapa ou página inicial
      if (allMaps.length > 1) {
        const nextMap = allMaps.find(m => m.id !== mapId);
        if (nextMap) {
          router.push(`/admin/map-details?mapId=${nextMap.id}`);
        } else {
          router.push('/admin/map-details');
        }
      } else {
        router.push('/admin/map-details');
      }
    } catch (error: any) {
      console.error('Erro ao deletar mapa:', error);
      const errorMsg = error.response?.data?.error || '❌ Erro ao excluir loteamento. Tente novamente.';
      alert(errorMsg);
    } finally {
      setIsDeletingMap(false);
    }
  };

  const handleEditMap = async () => {
    if (!mapId || !editMapName.trim()) {
      alert('❌ O nome do loteamento é obrigatório');
      return;
    }
    
    setIsSubmittingMapEdit(true);
    try {
      await axios.put(`${API_URL}/mapas/editar`, {
        mapId,
        name: editMapName.trim(),
        description: editMapDescription.trim()
      });

      alert('✅ Loteamento atualizado com sucesso!');
      setIsEditingMap(false);
      
      // Recarregar dados do mapa
      await loadMapData();
    } catch (error: any) {
      console.error('Erro ao editar mapa:', error);
      const errorMsg = error.response?.data?.error || '❌ Erro ao atualizar loteamento. Tente novamente.';
      alert(errorMsg);
    } finally {
      setIsSubmittingMapEdit(false);
    }
  };

  // Funções para ações em lote
  const handleBulkBlock = async () => {
    if (selectedLots.length === 0) return;
    
    if (!mapId) {
      alert('❌ Erro: ID do mapa não encontrado');
      return;
    }
    
    const availableLots = selectedLots.filter(lot => lot.status === LotStatus.AVAILABLE);
    
    if (availableLots.length === 0) {
      alert('❌ Nenhum lote disponível para bloquear');
      return;
    }

    if (!confirm(`Deseja bloquear ${availableLots.length} lote(s)?`)) return;

    try {      
      await Promise.all(availableLots.map(lot =>
        axios.patch('/api/mapas/lotes/atualizar', {
          id: lot.id,
          mapId: lot.mapId || mapId,
          blockId: lot.blockId,
          lotNumber: lot.lotNumber,
          status: LotStatus.BLOCKED,
          price: lot.price,
          size: lot.size,
          description: lot.description,
          features: lot.features,
        })
      ));

      alert(`✅ ${availableLots.length} lote(s) bloqueado(s) com sucesso!`);
      setSelectedLots([]);
      setMultiSelectMode(false);
      
      // Recarregar lotes da quadra
      if (selectedBlockId) {
        const lots = await loadLotsForBlock(selectedBlockId);
        setSelectedBlockLots(lots);
      }
      
      // Recarregar estatísticas
      loadLotStats();
    } catch (error) {
      console.error('Erro ao bloquear lotes:', error);
      alert('❌ Erro ao bloquear lotes. Tente novamente.');
    }
  };

  const handleBulkUnblock = async () => {
    if (selectedLots.length === 0) return;
    
    if (!mapId) {
      alert('❌ Erro: ID do mapa não encontrado');
      return;
    }
    
    const blockedLots = selectedLots.filter(lot => lot.status === LotStatus.BLOCKED);
    
    if (blockedLots.length === 0) {
      alert('❌ Nenhum lote bloqueado para desbloquear');
      return;
    }

    if (!confirm(`Deseja desbloquear ${blockedLots.length} lote(s)?`)) return;

    try {
      
      await Promise.all(blockedLots.map(lot =>
        axios.patch('/api/mapas/lotes/atualizar', {
          id: lot.id,
          mapId: lot.mapId || mapId,
          blockId: lot.blockId,
          lotNumber: lot.lotNumber,
          status: LotStatus.AVAILABLE,
          price: lot.price,
          size: lot.size,
          description: lot.description,
          features: lot.features,
        })
      ));

      alert(`✅ ${blockedLots.length} lote(s) desbloqueado(s) com sucesso!`);
      setSelectedLots([]);
      setMultiSelectMode(false);
      
      // Recarregar lotes da quadra
      if (selectedBlockId) {
        const lots = await loadLotsForBlock(selectedBlockId);
        setSelectedBlockLots(lots);
      }
      
      // Recarregar estatísticas
      loadLotStats();
    } catch (error) {
      console.error('Erro ao desbloquear lotes:', error);
      alert('❌ Erro ao desbloquear lotes. Tente novamente.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLots.length === 0) return;
    
    if (!mapId) {
      alert('❌ Erro: ID do mapa não encontrado');
      return;
    }
    
    const deletableLots = selectedLots.filter(lot => 
      lot.status !== LotStatus.RESERVED && lot.status !== LotStatus.SOLD
    );
    
    if (deletableLots.length === 0) {
      alert('❌ Nenhum lote pode ser excluído. Lotes reservados ou vendidos não podem ser excluídos.');
      return;
    }

    if (deletableLots.length < selectedLots.length) {
      alert(`⚠️ ${selectedLots.length - deletableLots.length} lote(s) não pode(m) ser excluído(s) por estar(em) reservado(s) ou vendido(s).`);
    }

    if (!confirm(`Deseja EXCLUIR ${deletableLots.length} lote(s)? Esta ação não pode ser desfeita!`)) return;

    try {
      await Promise.all(deletableLots.map(lot =>
        axios.delete(`${API_URL}/mapas/lotes/deletar`, {
          params: {
            lotId: lot.id
          }
        })
      ));

      alert(`✅ ${deletableLots.length} lote(s) excluído(s) com sucesso!`);
      setSelectedLots([]);
      setMultiSelectMode(false);
      
      // Recarregar lotes da quadra
      if (selectedBlockId) {
        const lots = await loadLotsForBlock(selectedBlockId);
        setSelectedBlockLots(lots);
      }
      
      // Recarregar estatísticas
      loadLotStats();
    } catch (error) {
      console.error('Erro ao excluir lotes:', error);
      alert('❌ Erro ao excluir lotes. Tente novamente.');
    }
  };

  // Mostrar tela de "sem mapas" apenas quando não estiver carregando E realmente não houver mapas
  if (!isLoading && !map && allMaps.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-6">Gerenciar Loteamentos</h1>
          
          {allMaps.length === 0 ? (
            <div className="text-center py-12 bg-[var(--card-bg)] rounded-2xl border-2 border-dashed border-[var(--accent)]/40 shadow-[var(--shadow-md)]">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)]/20 rounded-full mb-4 shadow-md">
                <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <p className="text-[var(--foreground)] text-lg font-semibold mb-2">Nenhum loteamento cadastrado</p>
              <p className="text-[var(--foreground)]/80 text-sm font-medium mb-4">Importe ou crie um novo loteamento para começar</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push('/admin/import-map')}
                  className="px-6 py-3 bg-[var(--accent)] text-[#1c1c1c] font-semibold rounded-lg hover:bg-[var(--accent-light)] transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Importar Loteamento
                </button>
                <button
                  onClick={() => setIsCreatingMap(true)}
                  className="px-6 py-3 bg-[var(--primary)] text-white font-semibold rounded-lg hover:bg-[var(--primary-dark)] transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Novo Loteamento
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-[var(--card-bg)] rounded-2xl shadow-[var(--shadow-md)]">
              <p className="text-white font-semibold mb-2">Selecione um loteamento para gerenciar</p>
            </div>
          )}
        </div>

        {/* Modal de Criar Novo Loteamento */}
        {isCreatingMap && (
          <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--card-bg)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Criar Novo Loteamento</h2>
                <button
                  onClick={() => {
                    setIsCreatingMap(false);
                    setNewMapName('');
                    setNewMapDescription('');
                  }}
                  className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
                    Nome do Loteamento *
                  </label>
                  <input
                    type="text"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--foreground)]/40"
                    placeholder="Ex: Chácara Jardim Ypiranga"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={newMapDescription}
                    onChange={(e) => setNewMapDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--foreground)]/40"
                    placeholder="Breve descrição do loteamento"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsCreatingMap(false);
                      setNewMapName('');
                      setNewMapDescription('');
                    }}
                    className="flex-1 px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] font-semibold rounded-lg hover:bg-[var(--border)] transition-colors"
                    disabled={isSubmittingMap}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateMap}
                    disabled={isSubmittingMap || !newMapName.trim()}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmittingMap ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Criando...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Criar Loteamento
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mostrar skeleton enquanto carrega o mapa inicial
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">Gerenciar Loteamentos</h1>
          
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-6">
            {/* Skeleton do Seletor de Mapas */}
            <div className="w-full lg:w-96">
              <div className="h-5 w-40 bg-[var(--surface)] rounded animate-pulse mb-2"></div>
              <div className="h-12 w-full bg-[var(--surface)] rounded-xl animate-pulse"></div>
            </div>
            
            {/* Skeleton dos Botões */}
            <div className="flex flex-col sm:flex-row gap-3 lg:flex-shrink-0 w-full lg:w-auto">
              <div className="h-12 w-full lg:w-44 bg-[var(--primary)]/30 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Skeleton das Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { color: 'from-green-500 to-green-600' },
            { color: 'from-orange-500 to-orange-600' },
            { color: 'from-red-500 to-red-600' },
            { color: 'from-gray-500 to-gray-600' }
          ].map((item, i) => (
            <div key={i} className={`bg-gradient-to-br ${item.color} rounded-2xl p-6 shadow-[var(--shadow-lg)]`}>
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl animate-pulse"></div>
              </div>
              <div className="h-4 w-20 bg-white/20 rounded animate-pulse mb-1"></div>
              <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Skeleton da seção de Quadras */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="h-7 w-32 bg-[var(--surface)] rounded animate-pulse"></div>
            <div className="h-11 w-40 bg-[var(--success)]/30 rounded-xl animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
              <div key={i} className="bg-[var(--surface)] rounded-xl border-2 border-[var(--border)] p-4">
                <div className="h-3 w-16 bg-[var(--border)] rounded animate-pulse mb-2"></div>
                <div className="h-6 w-20 bg-[var(--border)] rounded animate-pulse mb-1"></div>
                <div className="h-3 w-full bg-[var(--border)] rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton do Mapa */}
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden">
          <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] px-6 py-4 flex items-center justify-between">
            <div className="h-6 w-48 bg-white/20 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-white/20 rounded-lg animate-pulse"></div>
          </div>
          <div className="p-6">
            <div className="w-full aspect-video bg-[var(--surface)] rounded-xl animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-6">
      {/* Header com Seletor de Mapas */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">Gerenciar Loteamentos</h1>
        
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-6">
          {/* Seletor de Mapas e Botão Editar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end w-full lg:flex-1">
            <div className="w-full sm:flex-1">
              <label className="block text-sm font-bold text-[var(--foreground)] opacity-80 mb-2">
                Loteamento Selecionado
              </label>
              <select
                value={mapId}
                onChange={(e) => router.push(`/admin/map-details?mapId=${e.target.value}`)}
                className="w-full px-4 py-3 bg-[var(--surface)] text-[var(--foreground)] rounded-xl border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors font-semibold cursor-pointer"
              >
                {allMaps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            
            {mapId && (
              <button
                onClick={() => {
                  // Buscar dados do mapa atual do estado map ou da lista allMaps
                  const currentMap = map || allMaps.find(m => m.id === mapId);
                  setEditMapName(currentMap?.name || '');
                  setEditMapDescription(currentMap?.description || '');
                  setIsEditingMap(true);
                }}
                className="w-full sm:w-auto px-5 py-3 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar Loteamento
              </button>
            )}
          </div>
          
          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-3 lg:flex-shrink-0 w-full lg:w-auto">
            <button
              onClick={() => setIsCreatingMap(true)}
              className="w-full lg:w-auto px-5 py-3 bg-[var(--primary)] text-white font-semibold rounded-xl hover:bg-[var(--primary-dark)] shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Novo Loteamento
            </button>
            {mapId && (
              <button
                onClick={() => {
                  if (hasReservedOrSoldLotsInMap()) {
                    return;
                  }
                  setShowDeleteConfirm(true);
                }}
                disabled={hasReservedOrSoldLotsInMap()}
                style={hasReservedOrSoldLotsInMap() ? { pointerEvents: 'none' } : {}}
                className={`w-full lg:w-auto px-5 py-3 text-white font-semibold rounded-xl shadow-[var(--shadow-md)] transition-all flex items-center justify-center gap-2 ${
                  hasReservedOrSoldLotsInMap() 
                    ? 'bg-gray-400 cursor-not-allowed opacity-60' 
                    : 'bg-red-500 hover:bg-red-600 hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 cursor-pointer'
                }`}
                title={hasReservedOrSoldLotsInMap() ? 'Não é possível excluir o loteamento pois possui lotes reservados ou vendidos' : 'Excluir Loteamento'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Excluir Loteamento
              </button>
            )}
          </div>
        </div>
        
        {map?.description && (
          <p className="text-[var(--foreground)]/70 mt-2">{map.description}</p>
        )}
      </div>

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
          {isLoadingStats ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">
              {lotStats.available}
            </p>
          )}
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
          {isLoadingStats ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">
              {lotStats.reserved}
            </p>
          )}
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
          {isLoadingStats ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">
              {lotStats.sold}
            </p>
          )}
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
          {isLoadingStats ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">
              {lotStats.blocked}
            </p>
          )}
        </div>
      </div>

      {/* Seleção de Quadras com Botões (estilo maps/page.tsx) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-bold text-[var(--foreground)] opacity-80">Selecione uma Quadra</label>
          <button
            onClick={handleAddBlock}
            className="px-4 py-2 bg-[var(--success)] text-white font-semibold rounded-xl hover:bg-green-600 shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] cursor-pointer flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Quadra
          </button>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-[var(--surface)] rounded-xl border-2 border-[var(--border)] p-4">
                <div className="h-3 w-16 bg-[var(--border)] rounded animate-pulse mb-2"></div>
                <div className="h-6 w-20 bg-[var(--border)] rounded animate-pulse mb-1"></div>
                <div className="h-3 w-full bg-[var(--border)] rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : !blocks || blocks.length === 0 ? (
          <div className="text-center py-12 bg-[var(--card-bg)] rounded-2xl border-2 border-dashed border-[var(--accent)]/40 shadow-[var(--shadow-md)]">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)]/20 rounded-full mb-4 shadow-md">
              <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-[var(--foreground)] text-lg font-semibold mb-2">Nenhuma quadra cadastrada</p>
            <p className="text-[var(--foreground)]/80 text-sm font-medium mb-4">Clique em "Adicionar Quadra" acima para começar a organizar seus lotes</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {blocks.map((block) => {
                const isBlockDeletionDisabled = hasReservedOrSoldLotsInBlock(block.id);
                const isFocused = focusedBlockId === block.id;
                
                return (
                <div
                  key={block.id}
                  onClick={() => {
                    setSelectedBlockId(selectedBlockId === block.id ? '' : block.id);
                    setFocusedBlockId(block.id);
                    setFocusedLotId(null);
                  }}
                  className={`p-4 rounded-xl font-semibold transition-all relative group cursor-pointer border-2 ${
                    selectedBlockId === block.id
                      ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg scale-105 border-emerald-500'
                      : isFocused
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg border-purple-500'
                      : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] border-[var(--border)] hover:border-emerald-400 hover:shadow-md'
                  }`}
                >
                  <div className="text-xs mb-1 opacity-70">Quadra</div>
                  <div className="text-lg font-bold">{block.name}</div>
                  {block.description && (
                    <div className="text-xs mt-1 opacity-70 truncate">{block.description}</div>
                  )}
                  
                  {/* Botões de ação no hover e focus (funcionalidades do MapDetails) */}
                  <div className={`absolute top-1 right-1 flex gap-1 transition-opacity ${
                    selectedBlockId === block.id 
                      ? 'opacity-100' 
                      : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!map?.boundaryCoordinates || map.boundaryCoordinates.length === 0) {
                          alert('Por favor, configure a área do loteamento primeiro antes de definir a área da quadra.');
                          return;
                        }
                        if (block.coordinates && block.coordinates.length > 0) {
                          setFocusedBlockId(block.id);
                          setFocusedLotId(null);
                        } else {
                          setEditingBlockArea(block);
                          setIsConfiguringBlockArea(true);
                        }
                      }}
                      className="p-1.5 bg-green-500/80 hover:bg-green-600 rounded-lg backdrop-blur-sm cursor-pointer"
                      title={block.coordinates && block.coordinates.length > 0 ? "Visualizar área da quadra" : "Configurar área da quadra"}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBlock(block);
                        setIsAddingBlock(true);
                      }}
                      className="p-1.5 bg-yellow-500/80 hover:bg-yellow-600 rounded-lg backdrop-blur-sm cursor-pointer"
                      title="Editar quadra"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isBlockDeletionDisabled) {
                          return;
                        }
                        handleDeleteBlock(block.id);
                      }}
                      disabled={isBlockDeletionDisabled}
                      style={isBlockDeletionDisabled ? { pointerEvents: 'none' } : {}}
                      className={`p-1.5 rounded-lg transition-all ${
                        isBlockDeletionDisabled
                          ? 'bg-gray-400/60 cursor-not-allowed opacity-40'
                          : 'bg-red-500/80 hover:bg-red-600 cursor-pointer'
                      }`}
                      title={isBlockDeletionDisabled ? 'Não é possível excluir a quadra pois possui lotes reservados ou vendidos' : 'Excluir quadra'}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
              })}
            </div>
        )}
      </div>

      {/* Visualização dos Lotes da Quadra Selecionada */}
      {selectedBlockId && blocks.find(b => b.id === selectedBlockId) && (
        <div className="mb-8">
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-[var(--shadow-lg)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-[var(--foreground)] opacity-80 flex items-center gap-2">
                <svg className="w-7 h-7 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Lotes - {blocks.find(b => b.id === selectedBlockId)?.name}
              </h2>
              
              <div className="flex items-center gap-3">
                {/* Checkbox para ativar seleção múltipla */}
                {!isLoadingBlockLots && selectedBlockLots.length > 0 && (
                  <label className="flex items-center gap-3 px-4 py-2 bg-[var(--surface)] rounded-xl border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={multiSelectMode}
                      onChange={(e) => {
                        setMultiSelectMode(e.target.checked);
                        if (!e.target.checked) {
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
                
                <button
                  onClick={() => handleAddLotToBlock(selectedBlockId)}
                  className="px-5 py-2.5 bg-[var(--success)] hover:bg-green-600 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar Lote
                </button>
              </div>
            </div>
            <BlockCard
              key={`${selectedBlockId}-${refreshTrigger}`}
              block={blocks.find(b => b.id === selectedBlockId)!}
              mapId={mapId}
              blockLots={selectedBlockLots}
              isLoadingBlockLots={isLoadingBlockLots}
              handleAddLotToBlock={handleAddLotToBlock}
              handleEditLot={handleEditLot}
              handleDeleteLot={handleDeleteLot}
              handleToggleLotStatus={handleToggleLotStatus}
              handleDeleteBlock={handleDeleteBlock}
              setEditingBlock={setEditingBlock}
              setIsAddingBlock={setIsAddingBlock}
              allBlocks={blocks}
              reservations={reservations}
              userRole={user?.role}
              multiSelectMode={multiSelectMode}
              selectedLots={selectedLots}
              onToggleLotSelection={handleToggleLotSelection}
              onSingleLotClick={(lot) => {
                setFocusedLotId(lot.id);
                setFocusedBlockId(null);
              }}
              onDefineArea={(lot) => {
                setFocusedLotId(lot.id);
                setFocusedBlockId(null);
                setEditingLotPolygon(lot);
              }}
            />
          </div>
        </div>
      )}

      {/* Visualização do Mapa no Google Maps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-bold text-[var(--foreground)] opacity-80">Visualização do Mapa</label>
          <button
            onClick={() => setIsConfiguringLocation(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] cursor-pointer flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Configurar Área
          </button>
        </div>
        
        {isLoading ? (
          <div className="bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-2xl p-6">
            <div className="aspect-video bg-[var(--surface)] rounded-xl animate-pulse"></div>
          </div>
        ) : (
          <div className="bg-[var(--card-bg)] border-2 border-[var(--primary)]/30 rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[var(--foreground)] text-lg font-semibold">
                {focusedLotId ? (
                  `Lote ${allLotsInMap.find(l => l.id === focusedLotId)?.lotNumber || ''}`
                ) : focusedBlockId ? (
                  `Quadra ${blocks.find(b => b.id === focusedBlockId)?.name || ''}`
                ) : (
                  'Loteamento Completo'
                )}
              </h3>
              <div className="flex gap-2">
                {(focusedBlockId || focusedLotId) && (
                  <button
                    onClick={() => {
                      setFocusedBlockId(null);
                      setFocusedLotId(null);
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    <span>🔄</span>
                    Ver Tudo
                  </button>
                )}
                {map?.address && (
                  <button
                    onClick={() => {
                      const searchQuery = encodeURIComponent(map.address!);
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
                      window.open(mapsUrl, '_blank');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    <span>📍</span>
                    Abrir no Google Maps
                  </button>
                )}
              </div>
            </div>
            
            {/* Mapa sempre visível */}
            {map?.boundaryCoordinates ? (
              <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--background)] rounded-xl overflow-hidden">
                <PublicMapViewer 
                  address={map?.address}
                  boundaryCoordinates={map?.boundaryCoordinates}
                  blocks={focusedBlockId ? blocks.filter(b => b.id === focusedBlockId) : blocks}
                  lots={focusedLotId ? allLotsInMap.filter(l => l.id === focusedLotId) : focusedBlockId ? allLotsInMap.filter(l => l.blockId === focusedBlockId) : allLotsInMap}
                  focusedBlockId={focusedBlockId}
                  onLotClick={(lot) => {
                    console.log('[MapDetails] Lote clicado no mapa:', lot.lotNumber);
                    setFocusedLotId(lot.id);
                    setFocusedBlockId(null);
                  }}
                  onBlockClick={(block) => {
                    console.log('[MapDetails] Quadra clicada no mapa:', block.name);
                    setFocusedBlockId(block.id);
                    setFocusedLotId(null);
                  }}
                  onBoundaryClick={() => {
                    console.log('[MapDetails] Área do loteamento clicada');
                    setFocusedBlockId(null);
                    setFocusedLotId(null);
                  }}
                  isAdminContext={true}
                />
                {map?.address && (
                  <p className="text-[var(--foreground)]/60 text-xs mt-3 px-4 pb-4 text-center">
                    Endereço: {map.address}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--background)] rounded-xl overflow-hidden p-8 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 mx-auto mb-4 bg-yellow-500/10 rounded-full flex items-center justify-center">
                    <span className="text-4xl">🗺️</span>
                  </div>
                  <h4 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                    Área do Loteamento não definida
                  </h4>
                  <p className="text-[var(--foreground)]/60 text-sm mb-6">
                    Configure a área do loteamento no Google Maps para visualizar a localização e gerenciar quadras e lotes.
                  </p>
                  <button
                    onClick={() => setIsConfiguringLocation(true)}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl flex items-center gap-3 transition-all shadow-lg hover:shadow-xl mx-auto"
                  >
                    <span className="text-xl">📍</span>
                    <span className="font-semibold">Criar Área do Loteamento</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Adicionar/Editar Quadra */}
      {isAddingBlock && editingBlock && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] my-auto overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white p-4 sm:p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">{editingBlock.id ? 'Editar Quadra' : 'Adicionar Quadra'}</h2>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsAddingBlock(false);
                    setEditingBlock(null);
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
            <div className="p-4 sm:p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
                    Nome da Quadra *
                  </label>
                  <input
                    type="text"
                    value={editingBlock.name}
                    onChange={(e) => setEditingBlock({ ...editingBlock, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--foreground)]/40"
                    placeholder="Ex: Quadra A, Quadra 1, Setor Norte"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={editingBlock.description || ''}
                    onChange={(e) => setEditingBlock({ ...editingBlock, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--foreground)]/40"
                    placeholder="Descrição opcional da quadra"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-6">
              <button
                type="button"
                onClick={() => {
                  setIsAddingBlock(false);
                  setEditingBlock(null);
                }}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold text-sm sm:text-base shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveBlock}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--success)] text-white rounded-xl hover:bg-[var(--success)]/90 font-semibold text-sm sm:text-base shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] cursor-pointer"
              >
                {editingBlock.id ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adicionar Lote */}
      {isAddingLot && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] my-auto overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white p-4 sm:p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">Adicionar Lote</h2>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsAddingLot(false);
                    setSelectedBlockForLot('');
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
            <div className="p-4 sm:p-6">
              <LotForm
                blockId={selectedBlockForLot}
                blockName={blocks.find(b => b.id === selectedBlockForLot)?.name || ''}
                onSave={handleSaveLot}
                onCancel={() => {
                  setIsAddingLot(false);
                  setSelectedBlockForLot('');
                }}
                onSubmitChange={(canSubmit, submit) => {
                  setCanSubmitLot(canSubmit);
                  setSubmitLotFn(() => submit);
                }}
              />
            </div>
            <div className="sticky bottom-0 bg-[var(--card-bg)] border-t border-[var(--border)] p-4 sm:p-6 flex flex-col sm:flex-row gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => {
                  setIsAddingLot(false);
                  setSelectedBlockForLot('');
                }}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold text-sm sm:text-base shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (submitLotFn) submitLotFn();
                }}
                disabled={!canSubmitLot}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--success)] text-white rounded-xl hover:bg-[var(--success)]/90 font-semibold text-sm sm:text-base shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] disabled:bg-[var(--foreground)]/20 disabled:cursor-not-allowed cursor-pointer"
              >
                Adicionar Lote
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-md shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Excluir Loteamento</h2>
                  <p className="text-white/80 text-sm">Esta ação não pode ser desfeita</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-[var(--foreground)] mb-2">
                Tem certeza que deseja excluir o loteamento <strong>{map?.name}</strong>?
              </p>
              <p className="text-[var(--foreground)]/70 text-sm">
                Todos os dados relacionados (quadras, lotes disponíveis) serão permanentemente removidos.
              </p>
            </div>

            <div className="flex gap-3 p-6 border-t border-[var(--border)]">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingMap}
                className="flex-1 px-5 py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteMap}
                disabled={isDeletingMap}
                className="flex-1 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-semibold shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isDeletingMap ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Confirmar Exclusão
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Loteamento */}
      {isEditingMap && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-2xl shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Editar Loteamento</h2>
                    <p className="text-white/80 text-sm">Atualize as informações do loteamento</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditingMap(false)}
                  disabled={isSubmittingMapEdit}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
                  Nome do Loteamento *
                </label>
                <input
                  type="text"
                  value={editMapName}
                  onChange={(e) => setEditMapName(e.target.value)}
                  placeholder="Ex: Jardim das Flores"
                  className="w-full px-4 py-3 bg-[var(--surface)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground)]/40 focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={editMapDescription}
                  onChange={(e) => setEditMapDescription(e.target.value)}
                  placeholder="Descrição do loteamento..."
                  rows={4}
                  className="w-full px-4 py-3 bg-[var(--surface)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground)]/40 focus:border-[var(--accent)] focus:outline-none transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-[var(--border)]">
              <button
                onClick={() => setIsEditingMap(false)}
                disabled={isSubmittingMapEdit}
                className="flex-1 px-5 py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditMap}
                disabled={isSubmittingMapEdit || !editMapName.trim()}
                className="flex-1 px-5 py-3 bg-[var(--success)] text-white rounded-xl hover:bg-[var(--success)]/90 font-semibold shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmittingMapEdit ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criar Novo Loteamento */}
      {isCreatingMap && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Criar Novo Loteamento</h2>
                    <p className="text-white/80 text-sm">Preencha as informações do loteamento</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsCreatingMap(false);
                    setNewMapName('');
                    setNewMapDescription('');
                  }}
                  disabled={isSubmittingMap}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
                  Nome do Loteamento *
                </label>
                <input
                  type="text"
                  value={newMapName}
                  onChange={(e) => setNewMapName(e.target.value)}
                  placeholder="Ex: Chácara Jardim Ypiranga"
                  disabled={isSubmittingMap}
                  className="w-full px-4 py-3 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-[var(--foreground)]/40 disabled:opacity-50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={newMapDescription}
                  onChange={(e) => setNewMapDescription(e.target.value)}
                  placeholder="Descreva características do loteamento"
                  disabled={isSubmittingMap}
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-[var(--foreground)]/40 resize-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  setIsCreatingMap(false);
                  setNewMapName('');
                  setNewMapDescription('');
                }}
                disabled={isSubmittingMap}
                className="flex-1 px-5 py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateMap}
                disabled={!newMapName.trim() || isSubmittingMap}
                className="flex-1 px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmittingMap ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Criando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Criar Loteamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Ação Flutuante para Seleção Múltipla */}
      {selectedLots.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 min-w-[300px] sm:min-w-[500px] border-2 border-blue-400/30">
            {/* Contador de Lotes */}
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{selectedLots.length}</span>
              </div>
              <div className="text-white">
                <p className="font-bold text-lg leading-tight">
                  {selectedLots.length === 1 ? '1 Lote' : `${selectedLots.length} Lotes`}
                </p>
                <p className="text-white opacity-80 text-xs">
                  {(() => {
                    const available = selectedLots.filter(l => l.status === LotStatus.AVAILABLE).length;
                    const blocked = selectedLots.filter(l => l.status === LotStatus.BLOCKED).length;
                    const parts = [];
                    if (available > 0) parts.push(`${available} disponível${available > 1 ? 'is' : ''}`);
                    if (blocked > 0) parts.push(`${blocked} bloqueado${blocked > 1 ? 's' : ''}`);
                    return parts.join(', ');
                  })()}
                </p>
              </div>
            </div>

            {/* Separador */}
            <div className="hidden sm:block w-px h-12 bg-white/20"></div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearSelection}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 backdrop-blur-sm border border-white/20 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpar
              </button>

              <button
                onClick={handleBulkBlock}
                disabled={!selectedLots.some(l => l.status === LotStatus.AVAILABLE)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Bloquear
              </button>

              <button
                onClick={handleBulkUnblock}
                disabled={!selectedLots.some(l => l.status === LotStatus.BLOCKED)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Desbloquear
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={!selectedLots.some(l => l.status !== LotStatus.RESERVED && l.status !== LotStatus.SOLD)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configurar Área do Loteamento */}
      {isConfiguringLocation && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Configurar Área do Loteamento</h2>
                    <p className="text-white/80 text-sm">Delimite a área do loteamento no mapa</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsConfiguringLocation(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {isConfiguringLocation && (
                <MapBoundaryEditor
                  key={`boundary-editor-${isConfiguringLocation}`}
                  initialAddress={map?.address}
                  initialBoundary={map?.boundaryCoordinates}
                  onSave={saveBoundaryCoordinates}
                  onCancel={() => setIsConfiguringLocation(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configurar Área da Quadra */}
      {isConfiguringBlockArea && editingBlockArea && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Configurar Área da Quadra {editingBlockArea.name}</h2>
                    <p className="text-white/80 text-sm">Delimite a área da quadra no mapa</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsConfiguringBlockArea(false);
                    setEditingBlockArea(null);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {isConfiguringBlockArea && editingBlockArea && (
                <MapBoundaryEditor
                  key={`block-boundary-editor-${editingBlockArea.id}`}
                  initialAddress={map?.address}
                  initialBoundary={editingBlockArea.coordinates}
                  referenceBoundary={map?.boundaryCoordinates}
                  onSave={(coordinates) => saveBlockCoordinates(editingBlockArea.id, coordinates)}
                  onCancel={() => {
                    setIsConfiguringBlockArea(false);
                    setEditingBlockArea(null);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Lote para Vincular Área */}
      {showLotSelectionModal && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl shadow-md z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Selecione o Lote</h2>
                    <p className="text-white/80 text-sm mt-1">Escolha qual lote deseja vincular a uma área no mapa</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLotSelectionModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
              {allLotsInMap.length > 0 ? (
                <div className="space-y-2">
                  {allLotsInMap.map((lot) => (
                    <button
                      key={lot.id}
                      onClick={async () => {
                        if (!map?.boundaryCoordinates || map.boundaryCoordinates.length === 0) {
                          alert('⚠️ O loteamento não tem área definida. Configure a área primeiro.');
                          return;
                        }
                        
                        const confirmLink = confirm(
                          `Confirma vincular o lote ${lot.lotNumber} à área verde do loteamento?\n\n` +
                          `O lote ficará com as mesmas coordenadas da área verde.`
                        );
                        
                        if (confirmLink) {
                          await saveLotCoordinates(lot.id, map.boundaryCoordinates);
                        }
                      }}
                      className="w-full flex items-center justify-between p-4 bg-[var(--surface)] hover:bg-[var(--surface)]/80 border border-[var(--border)] rounded-xl transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white ${
                          lot.status === 'available' ? 'bg-green-500' :
                          lot.status === 'reserved' ? 'bg-yellow-500' :
                          lot.status === 'sold' ? 'bg-red-500' : 'bg-gray-500'
                        }`}>
                          {lot.lotNumber}
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-[var(--foreground)]">{lot.lotNumber}</div>
                          <div className="text-sm text-[var(--foreground)]/60">
                            {lot.size}m² • R$ {lot.price.toLocaleString('pt-BR')}
                          </div>
                          {lot.coordinates && lot.coordinates.length > 0 && (
                            <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Área já definida
                            </div>
                          )}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-[var(--foreground)]/40 group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-[var(--foreground)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-[var(--foreground)]/60 font-medium mb-2">Nenhum lote cadastrado</p>
                  <p className="text-[var(--foreground)]/40 text-sm">Cadastre lotes primeiro para poder vincular áreas</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-[var(--surface)] px-6 py-4 border-t border-[var(--border)] rounded-b-2xl">
              <button
                onClick={() => setShowLotSelectionModal(false)}
                className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Polígono do Lote */}
      {editingLotPolygon && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Definir Área do Lote {editingLotPolygon.lotNumber}</h2>
                    <p className="text-white/80 text-sm">Desenhe o polígono do lote no mapa</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingLotPolygon(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <LotPolygonEditor
                lot={editingLotPolygon}
                mapBoundary={map?.boundaryCoordinates}
                blockBoundary={editingLotPolygon.blockId ? blocks.find(b => b.id === editingLotPolygon.blockId)?.coordinates : undefined}
                onSave={(coordinates) => saveLotCoordinates(editingLotPolygon.id, coordinates)}
                onCancel={() => setEditingLotPolygon(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de formulário de lote
interface LotFormProps {
  blockId: string;
  blockName: string;
  onSave: (lot: Lot) => void;
  onCancel: () => void;
  onSubmitChange?: (canSubmit: boolean, submit: () => void) => void;
}

function LotForm({ blockId, blockName, onSave, onCancel, onSubmitChange }: LotFormProps) {
  const [lotNumber, setLotNumber] = useState('');
  const [size, setSize] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [priceDisplay, setPriceDisplay] = useState<string>('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<LotStatus>(LotStatus.AVAILABLE);

  const handleSubmit = () => {
    const pricePerM2 = size > 0 ? totalPrice / size : 0;
    
    const lot: Lot = {
      id: '',
      mapId: '',
      blockId,
      lotNumber,
      status,
      price: totalPrice,
      pricePerM2,
      size,
      description,
      features: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSave(lot);
  };

  // Notificar o pai quando o estado mudar
  React.useEffect(() => {
    const canSubmit = !!(lotNumber && size && totalPrice);
    if (onSubmitChange) {
      onSubmitChange(canSubmit, handleSubmit);
    }
  }, [lotNumber, size, totalPrice]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-[var(--primary)]/5 to-[var(--primary-light)]/10 border border-[var(--primary)]/15 rounded-xl p-3">
        <p className="text-sm text-[var(--foreground)]">
          <strong>Quadra:</strong> {blockName || 'Não identificada'}
        </p>
      </div>

      <div>
        <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
          Número do Lote *
        </label>
        <input
          type="text"
          value={lotNumber}
          onChange={(e) => setLotNumber(e.target.value)}
          className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--foreground)]/40"
          placeholder="Ex: 01, A1, etc"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
          Área (m²) *
        </label>
        <input
          type="number"
          value={size || ''}
          onChange={(e) => setSize(parseFloat(e.target.value) || 0)}
          className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--foreground)]/40"
          placeholder="300"
        />
      </div>

      <div>
        <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
          Preço Total (R$) *
        </label>
        <input
          type="text"
          value={priceDisplay}
          onChange={(e) => {
            let value = e.target.value;
            
            // Remove tudo exceto dígitos
            value = value.replace(/\D/g, '');
            
            if (value === '') {
              setPriceDisplay('');
              setTotalPrice(0);
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
            setTotalPrice(numericValue);
          }}
          className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--foreground)]/40"
          placeholder="0,00"
        />
        <p className="text-xs text-[var(--foreground)]/60 mt-1">💡 Preencha manualmente o valor do lote</p>
      </div>

      <div>
        <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as LotStatus)}
          className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] cursor-pointer focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
        >
          <option value={LotStatus.AVAILABLE}>Disponível</option>
          <option value={LotStatus.BLOCKED}>Bloqueado</option>
        </select>
        <p className="text-xs text-[var(--foreground)]/60 mt-1">💡 Para reservar ou vender, use a página de Reservas</p>
      </div>

      <div>
        <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
          Descrição
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--foreground)]/40"
          placeholder="Informações adicionais sobre o lote"
          rows={3}
        />
      </div>
    </div>
  );
}

// Componente de Card de Quadra com carregamento dinâmico de lotes
interface BlockCardProps {
  block: Block;
  mapId: string;
  blockLots: Lot[];
  isLoadingBlockLots: boolean;
  handleAddLotToBlock: (blockId: string) => void;
  handleEditLot: (lot: Lot) => Promise<void>;
  handleDeleteLot: (lotId: string) => Promise<void>;
  handleToggleLotStatus: (lotId: string, currentStatus: LotStatus) => Promise<void>;
  handleDeleteBlock: (blockId: string) => Promise<void>;
  setEditingBlock: (block: Block) => void;
  setIsAddingBlock: (isAdding: boolean) => void;
  allBlocks: Block[];
  reservations: any[];
  userRole?: string;
  multiSelectMode?: boolean;
  selectedLots?: Lot[];
  onToggleLotSelection?: (lot: Lot) => void;
  onSingleLotClick?: (lot: Lot) => void;
  onDefineArea?: (lot: Lot) => void;
}

function BlockCard({
  block,
  mapId,
  blockLots,
  isLoadingBlockLots,
  handleAddLotToBlock,
  handleEditLot,
  handleDeleteLot,
  handleToggleLotStatus,
  handleDeleteBlock,
  setEditingBlock,
  setIsAddingBlock,
  allBlocks,
  reservations,
  userRole,
  multiSelectMode = false,
  selectedLots = [],
  onToggleLotSelection,
  onSingleLotClick,
  onDefineArea,
}: BlockCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Verificar se existem lotes reservados ou vendidos
  const hasReservedOrSoldLots = blockLots.some(
    lot => lot.status === LotStatus.RESERVED || lot.status === LotStatus.SOLD
  );
  const reservedOrSoldCount = blockLots.filter(
    lot => lot.status === LotStatus.RESERVED || lot.status === LotStatus.SOLD
  ).length;

  return (
    <div>
      {/* Aviso de lotes reservados/vendidos */}
      {hasReservedOrSoldLots && (
        <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-bold text-orange-800 text-sm mb-1">⚠️ Quadra com lotes reservados/vendidos</p>
              <p className="text-orange-700 text-sm">
                Esta quadra possui <strong>{reservedOrSoldCount} lote(s)</strong> com reservas ou vendas ativas.
                Para excluir esta quadra, cancele primeiro as reservas/vendas na página de <strong>Reservas</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Lotes da Quadra */}
        {isLoadingBlockLots ? (
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
        ) : blockLots && blockLots.length > 0 ? (
          <LotSelector
            lots={blockLots}
            blocks={allBlocks}
            onLotEdit={handleEditLot}
            onLotDelete={handleDeleteLot}
            onToggleLotStatus={handleToggleLotStatus}
            onSingleLotClick={onSingleLotClick}
            onDefineArea={onDefineArea}
            selectedLotIds={selectedLots.map(l => l.id)}
            allowMultipleSelection={multiSelectMode}
            onMultipleSelect={multiSelectMode && onToggleLotSelection ? (lots) => {
              // Recebe um array com um único lote para fazer toggle
              if (lots.length === 1) {
                onToggleLotSelection(lots[0]);
              }
            } : undefined}
            lotsPerRow={15}
            reservations={reservations}
            userRole={userRole}
            isAdminContext={true}
          />
        ) : (
          <div className="text-center py-8 bg-[var(--card-bg)] rounded-xl border-2 border-dashed border-[var(--accent)]/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-white font-medium mb-2">Nenhum lote cadastrado nesta quadra</p>
          <p className="text-white/70 text-sm mb-4">Clique em "Adicionar Lote" para começar</p>
        </div>
      )}
    </div>
  );
}