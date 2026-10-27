'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Map } from '@/types/Map';
import { Block } from '@/types/Block';
import { Lot } from '@/types/Lot';
import { LotStatus } from '@/types/LotStatus';
import { OverlayConfig } from '@/types/OverlayConfig';
import { MapApiItem } from '@/types/MapApiItem';
import { ReservationSummary } from '@/types/ReservationSummary';
import { useBlockOperations } from '@/hooks/useBlockOperations';
import LotSelector from '@/components/LotSelector';
import PublicMapViewer from '@/components/PublicMapViewer';
import SVGOverlayEditor from '@/components/SVGOverlayEditor';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomAlert } from '@/hooks/useCustomAlert';

const API_URL = '/api';

/** Mensagem de erro devolvida pela API (campo error) ou o texto padrão. */
const apiErrorMessage = (error: unknown, fallback: string): string =>
  (axios.isAxiosError(error) && error.response?.data?.error) || fallback;

export default function MapDetails() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapId = searchParams.get('mapId') || '';
  const { user } = useAuth();
  const customAlert = useCustomAlert();

  const [map, setMap] = useState<Map | null>(null);
  const [allMaps, setAllMaps] = useState<Map[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger para forçar refresh dos cards

  // Estados para estatísticas
  const [lotStats, setLotStats] = useState({
    available: 0,
    reserved: 0,
    sold: 0,
    blocked: 0,
  });

  // Estados para modais
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [isAddingLot, setIsAddingLot] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [selectedBlockForLot, setSelectedBlockForLot] = useState<string>('');
  const [canSubmitLot, setCanSubmitLot] = useState(false);
  const [submitLotFn, setSubmitLotFn] = useState<(() => void) | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [selectedBlockLots, setSelectedBlockLots] = useState<Lot[]>([]); // Lotes da quadra selecionada
  const [isLoadingBlockLots, setIsLoadingBlockLots] = useState(false);
  const [allLotsInMap, setAllLotsInMap] = useState<Lot[]>([]); // Todos os lotes do mapa para validação

  // Estados para seleção múltipla de lotes
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedLots, setSelectedLots] = useState<Lot[]>([]);
  const [multiSelectAction, setMultiSelectAction] = useState<'delete' | 'block' | 'unblock' | null>(
    null
  );

  // Estados para seleção múltipla de quadras
  const [blockSelectAction, setBlockSelectAction] = useState<'delete' | 'block' | 'unblock' | null>(
    null
  );
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);

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

  // Estado para configurar overlay SVG
  const [isConfiguringOverlay, setIsConfiguringOverlay] = useState(false);

  // Estados para posicionamento de lotes no mapa
  const [isPlacingLot, setIsPlacingLot] = useState(false); // Modo de posicionar lote
  const [placingLotId, setPlacingLotId] = useState<string | null>(null); // ID do lote sendo posicionado

  // Estados para visibilidade dos elementos do mapa
  const [showOverlay, setShowOverlay] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);

  // Estados para posicionamento sequencial de lotes
  const [isSequentialPlacing, setIsSequentialPlacing] = useState(false);
  const [sequentialQueue, setSequentialQueue] = useState<string[]>([]); // IDs dos lotes na fila
  const [sequentialCurrentIndex, setSequentialCurrentIndex] = useState(0); // Índice atual na fila
  const [sequentialBlockName, setSequentialBlockName] = useState<string>(''); // Nome da quadra em sequência

  // Refs para manter valores atualizados dentro de closures async
  const isSequentialPlacingRef = useRef(false);
  const sequentialQueueRef = useRef<string[]>([]);

  // Sincronizar refs com o estado
  useEffect(() => {
    isSequentialPlacingRef.current = isSequentialPlacing;
  }, [isSequentialPlacing]);
  useEffect(() => {
    sequentialQueueRef.current = sequentialQueue;
  }, [sequentialQueue]);

  // Estados para controlar visualização filtrada no mapa principal

  const { blocks, loadBlocks, createBlock, updateBlock, deleteBlock } = useBlockOperations();

  // Função para alternar seleção de lote
  const handleToggleLotSelection = (lot: Lot) => {
    setSelectedLots((prev) => {
      const isSelected = prev.some((l) => l.id === lot.id);
      if (isSelected) {
        return prev.filter((l) => l.id !== lot.id);
      } else {
        return [...prev, lot];
      }
    });
  };

  // Função para limpar seleção
  const handleClearSelection = () => {
    setSelectedLots([]);
  };

  const clearActiveOperations = () => {
    setSelectedLots([]);
    setMultiSelectAction(null);
    setMultiSelectMode(false);
    setSelectedBlockIds([]);
    setBlockSelectAction(null);
  };

  // Limpar seleção ao mudar de quadra ou desativar multi-select
  useEffect(() => {
    if (!multiSelectMode) {
      setSelectedLots([]);
    }
  }, [multiSelectMode]);

  useEffect(() => {
    if (!multiSelectMode) {
      setSelectedLots([]);
    }
  }, [selectedBlockId, multiSelectMode]);

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
  const loadLotsForBlock = useCallback(
    async (blockId: string) => {
      if (!mapId) return [];

      try {
        const response = await axios.get(`${API_URL}/mapas/lotes`, {
          params: { mapId, blockId },
          timeout: 30000,
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
    },
    [mapId]
  );

  // Função para carregar lotes apenas da quadra selecionada
  const loadSelectedBlockLots = useCallback(
    async (blockId: string) => {
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
    },
    [mapId, loadLotsForBlock]
  );

  // Função para carregar todos os lotes do mapa (para validação de exclusão)
  const loadAllLotsInMap = useCallback(async () => {
    if (!mapId) return;

    try {
      const response = await axios.get(`${API_URL}/mapas/lotes`, {
        params: { mapId },
        timeout: 30000,
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
        timeout: 30000,
      });

      if (response.data) {
        setLotStats({
          available: response.data.available || 0,
          reserved: response.data.reserved || 0,
          sold: response.data.sold || 0,
          blocked: response.data.blocked || 0,
        });
      }
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao carregar stats dos lotes:', error);
      // Se falhar, reseta para 0
      setLotStats({
        available: 0,
        reserved: 0,
        sold: 0,
        blocked: 0,
      });
    } finally {
      setIsLoadingStats(false);
    }
  }, [mapId]);

  // loadMapImage REMOVIDO - imageUrl já vem na resposta de /api/mapas (loadMapData)

  const loadMapData = useCallback(
    async (currentMapId?: string) => {
      const targetMapId = currentMapId || mapId;
      try {
        // Buscar mapas completos
        const response = await axios.get(`${API_URL}/mapas`, {
          timeout: 30000,
        });

        const mapsData = response.data;
        const formattedMaps: Map[] = mapsData.map((m: MapApiItem & { image_url?: string }) => ({
          id: m.mapId || m.id,
          name: m.name || `Mapa ${m.mapId || m.id}`,
          description: m.description || '',
          imageUrl: m.imageUrl || m.image_url || '',
          imageType: 'image',
          width: m.width || 800,
          height: m.height || 600,
          address: m.address || '',
          overlayConfig: m.overlayConfig || null,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
        }));

        setAllMaps(formattedMaps);

        // Se tem mapId, buscar o mapa específico
        if (targetMapId) {
          const data = mapsData.find(
            (m: MapApiItem) => m.mapId === targetMapId || m.id === targetMapId
          );

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
              overlayConfig: data.overlayConfig || null,
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
            router.push(`/map-details?mapId=${firstMap.id}`);
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
    },
    [mapId, router]
  );

  // Flag para controlar se já inicializou
  const hasInitialized = useRef(false);
  const previousMapIdRef = useRef<string>(mapId || '');

  // Carregar dados iniciais apenas uma vez quando o componente montar
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initializeData = async () => {
      await loadMapData(mapId);

      // Após carregar mapas, se tem mapId, carregar dados específicos
      if (mapId && mapId.trim() !== '') {
        loadBlocks(mapId);
        loadLotStats();
        loadAllLotsInMap();
      }
    };

    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detectar mudança de mapId (quando usuário troca de mapa via seletor)
  // NÃO roda na montagem inicial — isso é feito pelo useEffect acima
  useEffect(() => {
    if (!hasInitialized.current) return;
    // Só executar quando mapId realmente mudou (não na montagem)
    if (previousMapIdRef.current === mapId) return;

    const prevId = previousMapIdRef.current;
    previousMapIdRef.current = mapId;

    // Limpar estado anterior se houve mapa antes
    if (prevId) {
      setSelectedBlockLots([]);
      setSelectedBlockId('');
      setReservations([]);
    }

    // Carregar dados do novo mapa
    if (mapId && mapId.trim() !== '') {
      const selectedMap = allMaps.find((m) => m.id === mapId);
      if (selectedMap) {
        setMap(selectedMap);
      }

      loadBlocks(mapId);
      loadLotStats();
      loadAllLotsInMap();
    }
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
    clearActiveOperations();
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
      customAlert.error('Nome da quadra é obrigatório');
      return;
    }

    try {
      if (editingBlock.id) {
        await updateBlock(editingBlock);
        customAlert.success('Quadra atualizada com sucesso!');
      } else {
        await createBlock({
          mapId: editingBlock.mapId,
          name: editingBlock.name,
          description: editingBlock.description,
        });
        customAlert.success('Quadra criada com sucesso!');
      }
      setIsAddingBlock(false);
      setEditingBlock(null);
    } catch (error) {
      console.error('Erro ao salvar quadra:', error);
      customAlert.error('Erro ao salvar quadra. Tente novamente.');
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      // Busca lotes da quadra para informar o usuário
      const lotsInBlock = await loadLotsForBlock(blockId);

      const message =
        lotsInBlock.length > 0
          ? `Esta quadra possui ${lotsInBlock.length} lote(s) cadastrado(s) que serão excluídos.\n\nTem certeza que deseja continuar?`
          : 'Tem certeza que deseja excluir esta quadra?';

      if (await customAlert.confirm(message)) {
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

        customAlert.success('Quadra excluída com sucesso!');
      }
    } catch (thrown) {
      console.error('Erro ao deletar quadra:', thrown);
      const error = thrown as { error?: string; count?: number };

      // Tratar erro de lotes reservados/vendidos
      if (error.error && error.count) {
        customAlert.error(
          `Não é possível excluir esta quadra\n\n` +
            `Existem ${error.count} lote(s) com reservas ou vendas ativas.\n\n` +
            `📋 O que fazer:\n` +
            `1. Acesse a página de Reservas\n` +
            `2. Cancele as reservas/vendas dos lotes desta quadra\n` +
            `3. Tente excluir a quadra novamente\n\n` +
            `💡 Dica: Você pode identificar os lotes pelos status "Reservado" ou "Vendido"`
        );
      } else if (error.error) {
        customAlert.error(`Erro ao excluir quadra\n\n${error.error}`);
      } else {
        customAlert.error('Erro ao deletar quadra. Verifique sua conexão e tente novamente.');
      }
    }
  };

  // Funções de validação para exclusão
  const hasReservedOrSoldLotsInBlock = (blockId: string): boolean => {
    const lotsInBlock = allLotsInMap.filter((lot) => String(lot.blockId) === String(blockId));
    const hasReservedOrSold = lotsInBlock.some(
      (lot) => lot.status === LotStatus.RESERVED || lot.status === LotStatus.SOLD
    );

    return hasReservedOrSold;
  };

  // Funções para seleção múltipla de quadras
  const handleToggleBlockSelection = (blockId: string) => {
    const id = String(blockId);
    setSelectedBlockIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      return [...prev, id];
    });
  };

  const handleClearBlockSelection = () => {
    setSelectedBlockIds([]);
    setBlockSelectAction(null);
  };

  const handleBulkBlockDelete = async () => {
    if (selectedBlockIds.length === 0) return;

    // Verificar quais podem ser excluídas
    const deletable = selectedBlockIds.filter((id) => !hasReservedOrSoldLotsInBlock(id));
    const notDeletable = selectedBlockIds.filter((id) => hasReservedOrSoldLotsInBlock(id));

    if (deletable.length === 0) {
      customAlert.error(
        'Nenhuma quadra selecionada pode ser excluída. Todas possuem lotes reservados ou vendidos.'
      );
      return;
    }

    if (notDeletable.length > 0) {
      const names = notDeletable
        .map((id) => blocks.find((b) => String(b.id) === id)?.name || '?')
        .join(', ');
      customAlert.warning(
        `Quadra(s) ${names} não pode(m) ser excluída(s) por possuir lotes reservados/vendidos. Será(o) ignorada(s).`
      );
    }

    const totalLots = deletable.reduce((acc, id) => {
      return acc + allLotsInMap.filter((l) => String(l.blockId) === id).length;
    }, 0);

    const blockNames = deletable
      .map((id) => blocks.find((b) => String(b.id) === id)?.name || '?')
      .join(', ');
    const msg =
      totalLots > 0
        ? `Deseja EXCLUIR ${deletable.length} quadra(s) (${blockNames}) e seus ${totalLots} lote(s)? Esta ação não pode ser desfeita!`
        : `Deseja EXCLUIR ${deletable.length} quadra(s) (${blockNames})? Esta ação não pode ser desfeita!`;

    if (!(await customAlert.confirm(msg))) return;

    try {
      for (const blockId of deletable) {
        await deleteBlock(blockId, mapId);
      }

      await loadBlocks(mapId);
      await loadAllLotsInMap();
      loadLotStats();

      if (selectedBlockId && deletable.includes(selectedBlockId)) {
        setSelectedBlockId('');
        setSelectedBlockLots([]);
      }

      handleClearBlockSelection();
      customAlert.success(`${deletable.length} quadra(s) excluída(s) com sucesso!`);
    } catch (error) {
      console.error('Erro ao excluir quadras:', error);
      customAlert.error('Erro ao excluir quadras. Tente novamente.');
    }
  };

  const handleBulkBlockToggleAll = async () => {
    if (selectedBlockIds.length === 0) return;

    if (!mapId) {
      customAlert.error('Erro: ID do mapa não encontrado');
      return;
    }

    // Recarregar allLotsInMap para garantir dados atualizados
    await loadAllLotsInMap();

    // Pegar todos os lotes das quadras selecionadas (exceto reservados/vendidos)
    // Buscar diretamente da API para evitar problemas de estado stale
    let freshLots: Lot[] = [];
    try {
      const response = await axios.get(`${API_URL}/mapas/lotes`, {
        params: { mapId },
        timeout: 30000,
      });
      if (response.data && Array.isArray(response.data)) {
        if (response.data.length > 0 && response.data[0].lots) {
          freshLots = response.data[0].lots;
        } else {
          freshLots = response.data;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar lotes frescos:', error);
      freshLots = allLotsInMap;
    }

    const lotsToToggle = freshLots.filter((lot) => {
      if (!selectedBlockIds.includes(String(lot.blockId))) return false;
      if (blockSelectAction === 'block') return lot.status === LotStatus.AVAILABLE;
      if (blockSelectAction === 'unblock') return lot.status === LotStatus.BLOCKED;
      return lot.status === LotStatus.AVAILABLE || lot.status === LotStatus.BLOCKED;
    });

    console.log('DEBUG handleBulkBlockToggleAll:', {
      selectedBlockIds,
      blockSelectAction,
      freshLotsCount: freshLots.length,
      freshLotsBlockIds: [...new Set(freshLots.map((l) => `${l.blockId} (${typeof l.blockId})`))],
      freshLotsStatuses: [...new Set(freshLots.map((l) => l.status))],
      lotsToToggleCount: lotsToToggle.length,
    });

    if (lotsToToggle.length === 0) {
      const msg =
        blockSelectAction === 'block'
          ? 'Nenhum lote disponível para bloquear nas quadras selecionadas.'
          : blockSelectAction === 'unblock'
            ? 'Nenhum lote bloqueado para desbloquear nas quadras selecionadas.'
            : 'Nenhum lote disponível ou bloqueado para alterar nas quadras selecionadas.';
      customAlert.warning(msg);
      return;
    }

    const toBlock =
      blockSelectAction !== 'unblock'
        ? lotsToToggle.filter((l) => l.status === LotStatus.AVAILABLE)
        : [];
    const toUnblock =
      blockSelectAction !== 'block'
        ? lotsToToggle.filter((l) => l.status === LotStatus.BLOCKED)
        : [];

    const parts = [];
    if (toBlock.length > 0) parts.push(`bloquear ${toBlock.length}`);
    if (toUnblock.length > 0) parts.push(`desbloquear ${toUnblock.length}`);

    if (
      !(await customAlert.confirm(
        `Deseja ${parts.join(' e ')} lote(s) nas ${selectedBlockIds.length} quadra(s) selecionada(s)?`
      ))
    )
      return;

    try {
      await Promise.all([
        ...toBlock.map((lot) =>
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
        ),
        ...toUnblock.map((lot) =>
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
        ),
      ]);

      const msgs = [];
      if (toBlock.length > 0) msgs.push(`${toBlock.length} bloqueado(s)`);
      if (toUnblock.length > 0) msgs.push(`${toUnblock.length} desbloqueado(s)`);
      customAlert.success(`Lotes atualizados: ${msgs.join(', ')}!`);

      handleClearBlockSelection();

      // Recarregar dados
      if (selectedBlockId) {
        const lots = await loadLotsForBlock(selectedBlockId);
        setSelectedBlockLots(lots);
      }
      await loadAllLotsInMap();
      loadLotStats();
    } catch (error) {
      console.error('Erro ao alterar lotes das quadras:', error);
      customAlert.error('Erro ao alterar lotes. Tente novamente.');
    }
  };

  const handleToggleSingleBlockLots = async (blockId: string) => {
    if (!mapId) {
      customAlert.error('Erro: ID do mapa não encontrado');
      return;
    }

    const lotsInBlock = allLotsInMap.filter((l) => String(l.blockId) === String(blockId));
    const toBlock = lotsInBlock.filter((l) => l.status === LotStatus.AVAILABLE);
    const toUnblock = lotsInBlock.filter((l) => l.status === LotStatus.BLOCKED);

    if (toBlock.length === 0 && toUnblock.length === 0) {
      customAlert.warning('Nenhum lote disponível ou bloqueado para alterar nesta quadra.');
      return;
    }

    const parts = [];
    if (toBlock.length > 0) parts.push(`bloquear ${toBlock.length}`);
    if (toUnblock.length > 0) parts.push(`desbloquear ${toUnblock.length}`);
    const blockName = blocks.find((b) => String(b.id) === String(blockId))?.name ?? blockId;

    if (!(await customAlert.confirm(`Deseja ${parts.join(' e ')} lote(s) na quadra ${blockName}?`)))
      return;

    try {
      await Promise.all([
        ...toBlock.map((lot) =>
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
        ),
        ...toUnblock.map((lot) =>
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
        ),
      ]);

      const msgs = [];
      if (toBlock.length > 0) msgs.push(`${toBlock.length} bloqueado(s)`);
      if (toUnblock.length > 0) msgs.push(`${toUnblock.length} desbloqueado(s)`);
      customAlert.success(`Quadra ${blockName}: ${msgs.join(', ')}!`);

      if (selectedBlockId === blockId) {
        const lots = await loadLotsForBlock(blockId);
        setSelectedBlockLots(lots);
      }
      await loadAllLotsInMap();
      loadLotStats();
    } catch (error) {
      console.error('Erro ao alterar lotes da quadra:', error);
      customAlert.error('Erro ao alterar lotes. Tente novamente.');
    }
  };

  const hasReservedOrSoldLotsInMap = (): boolean => {
    return lotStats.reserved > 0 || lotStats.sold > 0;
  };

  const handleAddLotToBlock = (blockId: string) => {
    clearActiveOperations();
    setSelectedBlockForLot(blockId);
    setIsAddingLot(true);
  };

  const handleSaveLot = async (lot: Lot) => {
    try {
      if (!lot.lotNumber || lot.lotNumber.trim() === '') {
        customAlert.error('Número do lote é obrigatório');
        return;
      }

      if (!lot.size || lot.size <= 0) {
        customAlert.error('Informe o tamanho do lote (m²)');
        return;
      }

      if (!lot.price || lot.price <= 0) {
        customAlert.error('O preço total do lote deve ser maior que zero');
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
        lat: lot.lat,
        lng: lot.lng,
      };

      if (lot.id && lot.id !== '') {
        await axios.patch(`${API_URL}/mapas/lotes/atualizar`, lotToSave, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        });
      } else {
        await axios.post(
          `${API_URL}/mapas/lotes/criar`,
          {
            ...lotToSave,
            id: Date.now().toString(),
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          }
        );
      }

      // Força refresh apenas dos cards de quadra
      setRefreshTrigger((prev) => prev + 1);
      setIsAddingLot(false);
      setSelectedBlockForLot('');
      customAlert.success('Lote salvo com sucesso!');
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao salvar lote:', error);
      const errorMessage = apiErrorMessage(error, 'Erro ao salvar lote. Tente novamente.');
      customAlert.error(errorMessage);
    }
  };

  const handleEditLot = async (lot: Lot) => {
    await handleSaveLot(lot);
    // Força refresh dos cards após editar lote
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handler para posicionar lote no mapa (clique no mapa)
  const handleMapClickForPlacement = async (lat: number, lng: number) => {
    if (!placingLotId) return;

    try {
      // Buscar o lote nos dados locais (usar String() para garantir comparação correta de tipos)
      const lot =
        allLotsInMap.find((l) => String(l.id) === String(placingLotId)) ||
        selectedBlockLots.find((l) => String(l.id) === String(placingLotId));
      if (!lot) {
        customAlert.error('Lote não encontrado');
        setIsPlacingLot(false);
        setPlacingLotId(null);
        return;
      }

      // Atualizar via API
      await axios.patch(
        `${API_URL}/mapas/lotes/atualizar`,
        {
          id: lot.id,
          mapId: lot.mapId,
          lat,
          lng,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );

      // Atualizar estado local
      setAllLotsInMap((prev) =>
        prev.map((l) => (String(l.id) === String(placingLotId) ? { ...l, lat, lng } : l))
      );
      setSelectedBlockLots((prev) =>
        prev.map((l) => (String(l.id) === String(placingLotId) ? { ...l, lat, lng } : l))
      );

      customAlert.success(`Lote ${lot.lotNumber} posicionado!`);

      // Se estiver em modo sequencial, avançar para o próximo lote na fila
      // Usa refs para evitar problema de stale closure em callback async
      if (isSequentialPlacingRef.current && sequentialQueueRef.current.length > 0) {
        const currentIdx = sequentialQueueRef.current.findIndex(
          (id) => String(id) === String(placingLotId)
        );
        const nextIdx = currentIdx + 1;

        if (nextIdx < sequentialQueueRef.current.length) {
          const nextLotId = sequentialQueueRef.current[nextIdx];
          setSequentialCurrentIndex(nextIdx);
          setPlacingLotId(nextLotId);
          // isPlacingLot permanece true
        } else {
          // Fila acabou
          setIsPlacingLot(false);
          setPlacingLotId(null);
          setIsSequentialPlacing(false);
          setSequentialQueue([]);
          setSequentialCurrentIndex(0);
          setSequentialBlockName('');
        }
      } else {
        setIsPlacingLot(false);
        setPlacingLotId(null);
      }
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao posicionar lote:', error);
      customAlert.error('Erro ao posicionar lote no mapa');
    }
  };

  // Handler para iniciar posicionamento de um lote
  const startPlacingLot = (lotId: string) => {
    setPlacingLotId(lotId);
    setIsPlacingLot(true);
  };

  // Handler para cancelar posicionamento (individual ou sequencial)
  const cancelPlacingLot = () => {
    setIsPlacingLot(false);
    setPlacingLotId(null);
    setIsSequentialPlacing(false);
    setSequentialQueue([]);
    setSequentialCurrentIndex(0);
    setSequentialBlockName('');
  };

  // Handler para iniciar posicionamento sequencial de todos os lotes disponíveis de uma quadra
  const startSequentialPlacing = (blockId: string, lotsFromBlock?: Lot[]) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    // Usar lotes passados diretamente (do BlockCard) ou buscar de allLotsInMap como fallback
    const sourceLots = lotsFromBlock || allLotsInMap;

    // Filtrar lotes da quadra que ainda não possuem marcação no mapa
    const availableLots = sourceLots
      .filter((l) => String(l.blockId) === String(blockId) && (l.lat == null || l.lng == null))
      .sort((a, b) => {
        const numA = parseInt(a.lotNumber) || 0;
        const numB = parseInt(b.lotNumber) || 0;
        return numA - numB;
      });

    if (availableLots.length === 0) {
      customAlert.info('Todos os lotes desta quadra já estão posicionados no mapa.');
      return;
    }

    const lotIds = availableLots.map((l) => l.id);
    setSequentialQueue(lotIds);
    setSequentialCurrentIndex(0);
    setSequentialBlockName(block.name);
    setIsSequentialPlacing(true);
    setPlacingLotId(lotIds[0]);
    setIsPlacingLot(true);
  };

  // Handler para remover a posição de um lote do mapa
  const handleRemoveLotPosition = async (lot: Lot) => {
    try {
      await axios.patch(
        `${API_URL}/mapas/lotes/atualizar`,
        {
          id: lot.id,
          mapId: lot.mapId,
          lat: null,
          lng: null,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );

      // Atualizar estado local
      setAllLotsInMap((prev) =>
        prev.map((l) => (l.id === lot.id ? { ...l, lat: undefined, lng: undefined } : l))
      );
      setSelectedBlockLots((prev) =>
        prev.map((l) => (l.id === lot.id ? { ...l, lat: undefined, lng: undefined } : l))
      );

      customAlert.success(`Marcação do lote ${lot.lotNumber} removida do mapa`);
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao remover posição do lote:', error);
      customAlert.error('Erro ao remover marcação do lote');
    }
  };

  const handleToggleLotStatus = async (lotId: string, currentStatus: LotStatus) => {
    try {
      // Buscar o lote apenas na quadra selecionada
      const lot = selectedBlockLots.find((l: Lot) => l.id === lotId);

      if (!lot) {
        throw new Error('Lote não encontrado');
      }

      const newStatus =
        currentStatus === LotStatus.BLOCKED ? LotStatus.AVAILABLE : LotStatus.BLOCKED;

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
      setRefreshTrigger((prev) => prev + 1);
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
        customAlert.error(
          `Não é possível excluir este lote\n\n` +
            `O lote está ${lot.status === LotStatus.RESERVED ? 'reservado' : 'vendido'}.\n\n` +
            `📋 O que fazer:\n` +
            `Só reservas e vendas ativas impedem a exclusão. Reservas canceladas não impedem.\n\n` +
            `1. Acesse a página de Reservas\n` +
            `2. Cancele a ${lot.status === LotStatus.RESERVED ? 'reserva' : 'venda'}\n` +
            `3. Tente excluir o lote novamente`
        );
        return;
      }

      await axios.delete(`${API_URL}/mapas/lotes/deletar?lotId=${lotId}`, {
        timeout: 30000,
      });

      // Recarregar lotes da quadra selecionada
      if (selectedBlockId) {
        const updatedLots = await loadLotsForBlock(selectedBlockId);
        setSelectedBlockLots(updatedLots);
      }

      // Recarregar todos os lotes do mapa para atualizar visualização
      await loadAllLotsInMap();

      // Força refresh dos cards após excluir lote
      setRefreshTrigger((prev) => prev + 1);
      customAlert.success('Lote excluído com sucesso!');
    } catch (error) {
      console.error('[MapDetails] ❌ Erro ao excluir lote:', error);
      const errorMessage = apiErrorMessage(error, 'Erro ao excluir lote. Tente novamente.');
      customAlert.error(errorMessage);
      throw error;
    }
  };

  const saveOverlayConfig = async (overlayConfig: OverlayConfig | null) => {
    if (!mapId || !map) return;

    try {
      let configToSave = overlayConfig;

      // Se o overlay tem imageUrl como data URL (base64), fazer upload para Cloudinary primeiro
      if (configToSave && configToSave.imageUrl && configToSave.imageUrl.startsWith('data:')) {
        const uploadResponse = await axios.post('/api/mapas/upload-svg', {
          dataUrl: configToSave.imageUrl,
          mapId,
        });

        if (uploadResponse.data?.url) {
          // Substituir data URL pela URL do Cloudinary
          configToSave = {
            ...configToSave,
            imageUrl: uploadResponse.data.url,
          };
        } else {
          throw new Error('Falha ao obter URL do upload');
        }
      }

      await axios.post('/api/mapas/configurar-overlay', {
        mapId,
        overlayConfig: configToSave,
      });

      customAlert.success(
        configToSave ? 'Overlay configurado com sucesso!' : 'Overlay removido com sucesso!'
      );
      setIsConfiguringOverlay(false);

      setMap((prev) => {
        if (!prev) return prev;
        return { ...prev, overlayConfig: configToSave };
      });

      await loadMapData(mapId);
    } catch (error) {
      console.error('Erro ao salvar overlay:', error);
      customAlert.error('Erro ao salvar overlay. Tente novamente.');
    }
  };

  const handleCreateMap = async () => {
    if (!newMapName.trim()) {
      customAlert.error('Por favor, informe o nome do loteamento');
      return;
    }

    setIsSubmittingMap(true);
    try {
      const response = await axios.post(
        '/api/mapas/criar',
        {
          name: newMapName,
          description: newMapDescription,
          imageUrl: '',
          width: 800,
          height: 600,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const newMapId = response.data.mapId || response.data.id;

      customAlert.success('Loteamento criado com sucesso!');
      setIsCreatingMap(false);
      setNewMapName('');
      setNewMapDescription('');

      // Recarregar lista de mapas
      await loadMapData();

      // Redirecionar para o novo mapa
      router.push(`/map-details?mapId=${newMapId}`);
    } catch (error) {
      console.error('Erro ao criar mapa:', error);
      customAlert.error(apiErrorMessage(error, 'Erro ao criar loteamento. Tente novamente.'));
    } finally {
      setIsSubmittingMap(false);
    }
  };

  const handleDeleteMap = async () => {
    if (!mapId) return;

    setIsDeletingMap(true);
    try {
      await axios.delete(`${API_URL}/mapas/deletar?mapId=${mapId}`, {
        timeout: 30000,
      });

      customAlert.success('Loteamento excluído com sucesso!');
      setShowDeleteConfirm(false);

      // Recarregar lista de mapas
      await loadMapData();

      // Redirecionar para o primeiro mapa ou página inicial
      if (allMaps.length > 1) {
        const nextMap = allMaps.find((m) => m.id !== mapId);
        if (nextMap) {
          router.push(`/map-details?mapId=${nextMap.id}`);
        } else {
          router.push('/map-details');
        }
      } else {
        router.push('/map-details');
      }
    } catch (error) {
      console.error('Erro ao deletar mapa:', error);
      const errorMsg = apiErrorMessage(error, 'Erro ao excluir loteamento. Tente novamente.');
      customAlert.error(errorMsg);
    } finally {
      setIsDeletingMap(false);
    }
  };

  const handleEditMap = async () => {
    if (!mapId || !editMapName.trim()) {
      customAlert.error('O nome do loteamento é obrigatório');
      return;
    }

    setIsSubmittingMapEdit(true);
    try {
      await axios.put(`${API_URL}/mapas/editar`, {
        mapId,
        name: editMapName.trim(),
        description: editMapDescription.trim(),
      });

      customAlert.success('Loteamento atualizado com sucesso!');
      setIsEditingMap(false);

      // Recarregar dados do mapa
      await loadMapData();
    } catch (error) {
      console.error('Erro ao editar mapa:', error);
      const errorMsg = apiErrorMessage(error, 'Erro ao atualizar loteamento. Tente novamente.');
      customAlert.error(errorMsg);
    } finally {
      setIsSubmittingMapEdit(false);
    }
  };

  // Funções para ações em lote
  const handleBulkBlockToggle = async () => {
    if (selectedLots.length === 0) return;

    if (!mapId) {
      customAlert.error('Erro: ID do mapa não encontrado');
      return;
    }

    const lotsToBlock =
      multiSelectAction !== 'unblock'
        ? selectedLots.filter((lot) => lot.status === LotStatus.AVAILABLE)
        : [];
    const lotsToUnblock =
      multiSelectAction !== 'block'
        ? selectedLots.filter((lot) => lot.status === LotStatus.BLOCKED)
        : [];

    if (lotsToBlock.length === 0 && lotsToUnblock.length === 0) {
      const msg =
        multiSelectAction === 'block'
          ? 'Nenhum lote disponível selecionado para bloquear'
          : multiSelectAction === 'unblock'
            ? 'Nenhum lote bloqueado selecionado para desbloquear'
            : 'Nenhum lote disponível ou bloqueado para alterar';
      customAlert.warning(msg);
      return;
    }

    const parts = [];
    if (lotsToBlock.length > 0) parts.push(`bloquear ${lotsToBlock.length}`);
    if (lotsToUnblock.length > 0) parts.push(`desbloquear ${lotsToUnblock.length}`);
    if (!(await customAlert.confirm(`Deseja ${parts.join(' e ')} lote(s)?`))) return;

    try {
      await Promise.all([
        ...lotsToBlock.map((lot) =>
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
        ),
        ...lotsToUnblock.map((lot) =>
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
        ),
      ]);

      const msgs = [];
      if (lotsToBlock.length > 0) msgs.push(`${lotsToBlock.length} bloqueado(s)`);
      if (lotsToUnblock.length > 0) msgs.push(`${lotsToUnblock.length} desbloqueado(s)`);
      customAlert.success(`Lotes atualizados: ${msgs.join(', ')}!`);
      setSelectedLots([]);
      setMultiSelectMode(false);
      setMultiSelectAction(null);

      // Recarregar lotes da quadra atual
      if (selectedBlockId) {
        const lots = await loadLotsForBlock(selectedBlockId);
        setSelectedBlockLots(lots);
      }

      // Recarregar todos os lotes do mapa
      await loadAllLotsInMap();

      // Recarregar estatísticas
      loadLotStats();
    } catch (error) {
      console.error('Erro ao alterar lotes:', error);
      customAlert.error('Erro ao alterar lotes. Tente novamente.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLots.length === 0) return;

    if (!mapId) {
      customAlert.error('Erro: ID do mapa não encontrado');
      return;
    }

    const deletableLots = selectedLots.filter(
      (lot) => lot.status !== LotStatus.RESERVED && lot.status !== LotStatus.SOLD
    );

    if (deletableLots.length === 0) {
      customAlert.error(
        'Nenhum lote pode ser excluído. Lotes reservados ou vendidos não podem ser excluídos.'
      );
      return;
    }

    if (deletableLots.length < selectedLots.length) {
      customAlert.warning(
        `${selectedLots.length - deletableLots.length} lote(s) não pode(m) ser excluído(s) por estar(em) reservado(s) ou vendido(s).`
      );
    }

    if (
      !(await customAlert.confirm(
        `Deseja EXCLUIR ${deletableLots.length} lote(s)? Esta ação não pode ser desfeita!`
      ))
    )
      return;

    try {
      await Promise.all(
        deletableLots.map((lot) =>
          axios.delete(`${API_URL}/mapas/lotes/deletar`, {
            params: {
              lotId: lot.id,
            },
          })
        )
      );

      customAlert.success(`${deletableLots.length} lote(s) excluído(s) com sucesso!`);
      setSelectedLots([]);
      setMultiSelectMode(false);
      setMultiSelectAction(null);

      // Recarregar lotes da quadra atual
      if (selectedBlockId) {
        const lots = await loadLotsForBlock(selectedBlockId);
        setSelectedBlockLots(lots);
      }

      // Recarregar todos os lotes do mapa
      await loadAllLotsInMap();

      // Recarregar estatísticas
      loadLotStats();
    } catch (error) {
      console.error('Erro ao excluir lotes:', error);
      customAlert.error('Erro ao excluir lotes. Tente novamente.');
    }
  };

  // Mostrar tela de "sem mapas" apenas quando não estiver carregando E realmente não houver mapas
  if (!isLoading && !map && allMaps.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-6">
            Gerenciar Loteamentos
          </h1>

          {allMaps.length === 0 ? (
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
                Importe ou crie um novo loteamento para começar
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push('/import-map')}
                  className="px-6 py-3 bg-[var(--accent)] text-[#1c1c1c] font-semibold rounded-lg hover:bg-[var(--accent-light)] transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Importar Loteamento
                </button>
                <button
                  onClick={() => {
                    clearActiveOperations();
                    setIsCreatingMap(true);
                  }}
                  className="px-6 py-3 bg-[var(--primary)] text-white font-semibold rounded-lg hover:bg-[var(--primary-dark)] transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Novo Loteamento
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-[var(--card-bg)] rounded-2xl shadow-[var(--shadow-md)]">
              <p className="text-white font-semibold mb-2">
                Selecione um loteamento para gerenciar
              </p>
            </div>
          )}
        </div>

        {/* Modal de Criar Novo Loteamento */}
        {isCreatingMap && (
          <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div
              className="bg-[var(--card-bg)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-md p-6 animate-in zoom-in-95 duration-200"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmittingMap && newMapName.trim()) {
                  e.preventDefault();
                  handleCreateMap();
                }
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-[var(--foreground)]">
                  Criar Novo Loteamento
                </h2>
                <button
                  onClick={() => {
                    setIsCreatingMap(false);
                    setNewMapName('');
                    setNewMapDescription('');
                  }}
                  className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
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
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">
            Gerenciar Loteamentos
          </h1>

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
            { color: 'from-gray-500 to-gray-600' },
          ].map((item, i) => (
            <div
              key={i}
              className={`bg-gradient-to-br ${item.color} rounded-2xl p-6 shadow-[var(--shadow-lg)]`}
            >
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div
                key={i}
                className="bg-[var(--surface)] rounded-xl border-2 border-[var(--border)] p-4"
              >
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

        {/* Botão Novo Loteamento - Separado */}
        <div className="mb-4">
          <button
            onClick={() => {
              clearActiveOperations();
              setIsCreatingMap(true);
            }}
            className="w-full lg:w-auto px-6 py-3.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white font-bold rounded-xl hover:from-[var(--primary-dark)] hover:to-[var(--primary)] shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-3 border-2 border-[var(--primary)]/30"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Criar Novo Loteamento</span>
          </button>
        </div>

        {/* Gerenciar Loteamento Atual */}
        <div className="bg-[var(--surface)]/50 border-2 border-[var(--border)] rounded-xl p-4 mb-6">
          <h3 className="text-sm font-bold text-[var(--foreground)]/70 uppercase tracking-wide mb-3">
            Gerenciar Loteamento Atual
          </h3>
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            {/* Seletor de Mapas e Botão Editar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end w-full lg:flex-1">
              <div className="w-full sm:flex-1">
                <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-2">
                  Loteamento Selecionado
                </label>
                <select
                  value={mapId}
                  onChange={(e) => router.push(`/map-details?mapId=${e.target.value}`)}
                  className="w-full px-4 py-3 bg-[var(--card-bg)] text-[var(--foreground)] rounded-xl border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors font-semibold cursor-pointer"
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
                    clearActiveOperations();
                    // Buscar dados do mapa atual do estado map ou da lista allMaps
                    const currentMap = map || allMaps.find((m) => m.id === mapId);
                    setEditMapName(currentMap?.name || '');
                    setEditMapDescription(currentMap?.description || '');
                    setIsEditingMap(true);
                  }}
                  className="w-full sm:w-auto px-5 py-3 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Editar Loteamento
                </button>
              )}
            </div>

            {/* Botão Excluir */}
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
                className={`w-full lg:w-auto px-5 py-3 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                  hasReservedOrSoldLotsInMap()
                    ? 'bg-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-red-500 hover:bg-red-600 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
                }`}
                title={
                  hasReservedOrSoldLotsInMap()
                    ? 'Não é possível excluir o loteamento pois possui lotes reservados ou vendidos'
                    : 'Excluir Loteamento'
                }
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Excluir Loteamento
              </button>
            )}
          </div>

          {map?.description && (
            <p className="text-[var(--foreground)]/70 mt-3 text-sm">{map.description}</p>
          )}
        </div>
      </div>

      {/* Estatísticas de Status dos Lotes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <p className="text-white text-sm font-medium mb-1">Disponível</p>
          {isLoadingStats ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{lotStats.available}</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-white text-sm font-medium mb-1">Reservado</p>
          {isLoadingStats ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{lotStats.reserved}</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
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
          <p className="text-white text-sm font-medium mb-1">Vendido</p>
          {isLoadingStats ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{lotStats.sold}</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
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
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </div>
          </div>
          <p className="text-white text-sm font-medium mb-1">Bloqueado</p>
          {isLoadingStats ? (
            <div className="h-10 w-16 bg-white/20 rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-white text-4xl font-bold">{lotStats.blocked}</p>
          )}
        </div>
      </div>

      {/* Seleção de Quadras com Botões (estilo maps/page.tsx) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-bold text-[var(--foreground)] opacity-80">
            Selecione uma Quadra
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddBlock}
              className="px-4 py-2 bg-[var(--success)] text-white font-semibold rounded-xl hover:bg-green-600 shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] cursor-pointer flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Adicionar Quadra
            </button>

            {blocks && blocks.length > 0 && (
              <>
                <button
                  onClick={() => {
                    if (blockSelectAction === 'delete') {
                      handleClearBlockSelection();
                    } else {
                      // Desativar qualquer operação de lote ativa
                      setMultiSelectAction(null);
                      setMultiSelectMode(false);
                      handleClearSelection();
                      // Ativar seleção de quadras para exclusão
                      setBlockSelectAction('delete');
                      setSelectedBlockIds([]);
                    }
                  }}
                  className={`px-4 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-sm ${
                    blockSelectAction === 'delete'
                      ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-lg'
                      : 'bg-red-500/30 border-2 border-red-400/60 text-red-200 hover:bg-red-500/45 hover:border-red-300/70'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Excluir
                </button>

                <button
                  onClick={() => {
                    if (blockSelectAction === 'block') {
                      handleClearBlockSelection();
                    } else {
                      setMultiSelectAction(null);
                      setMultiSelectMode(false);
                      handleClearSelection();
                      setBlockSelectAction('block');
                      setSelectedBlockIds([]);
                    }
                  }}
                  className={`px-4 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-sm ${
                    blockSelectAction === 'block'
                      ? 'bg-gray-600 text-white ring-2 ring-gray-400 shadow-lg'
                      : 'bg-gray-500/30 border-2 border-gray-400/60 text-gray-200 hover:bg-gray-500/45 hover:border-gray-300/70'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  Bloquear
                </button>

                <button
                  onClick={() => {
                    if (blockSelectAction === 'unblock') {
                      handleClearBlockSelection();
                    } else {
                      setMultiSelectAction(null);
                      setMultiSelectMode(false);
                      handleClearSelection();
                      setBlockSelectAction('unblock');
                      setSelectedBlockIds([]);
                    }
                  }}
                  className={`px-4 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-sm ${
                    blockSelectAction === 'unblock'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg'
                      : 'bg-blue-500/20 border-2 border-blue-400/50 text-blue-200 hover:bg-blue-500/35 hover:border-blue-300/70'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  Desbloquear
                </button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-[var(--surface)] rounded-xl border-2 border-[var(--border)] p-4"
              >
                <div className="h-3 w-16 bg-[var(--border)] rounded animate-pulse mb-2"></div>
                <div className="h-6 w-20 bg-[var(--border)] rounded animate-pulse mb-1"></div>
                <div className="h-3 w-full bg-[var(--border)] rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : !blocks || blocks.length === 0 ? (
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <p className="text-[var(--foreground)] text-lg font-semibold mb-2">
              Nenhuma quadra cadastrada
            </p>
            <p className="text-[var(--foreground)]/80 text-sm font-medium mb-4">
              Clique em &quot;Adicionar Quadra&quot; acima para começar a organizar seus lotes
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {blocks.map((block) => {
              const isBlockDeletionDisabled = hasReservedOrSoldLotsInBlock(block.id);
              const isBlockSelected = selectedBlockIds.includes(String(block.id));
              const lotsInThisBlock = allLotsInMap.filter(
                (l) => String(l.blockId) === String(block.id)
              );
              const blockableCount = lotsInThisBlock.filter(
                (l) => l.status === LotStatus.AVAILABLE
              ).length;
              const unblocableCount = lotsInThisBlock.filter(
                (l) => l.status === LotStatus.BLOCKED
              ).length;

              return (
                <div
                  key={block.id}
                  onClick={() => {
                    if (blockSelectAction) {
                      // Em modo de seleção de quadras
                      if (blockSelectAction === 'delete' && isBlockDeletionDisabled) {
                        customAlert.warning(
                          `Quadra ${block.name} possui lotes reservados/vendidos e não pode ser excluída.`
                        );
                        return;
                      }
                      handleToggleBlockSelection(block.id);
                      return;
                    }
                    // Comportamento normal
                    if (selectedBlockId !== block.id) {
                      setSelectedBlockId(block.id);
                    }
                  }}
                  className={`p-4 rounded-xl font-semibold transition-all relative group cursor-pointer border-2 ${
                    blockSelectAction
                      ? isBlockSelected
                        ? blockSelectAction === 'delete'
                          ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-md border-red-500 ring-2 ring-red-500/60'
                          : 'bg-[var(--surface)] text-[var(--foreground)] shadow-md border-gray-400 ring-2 ring-gray-400/60'
                        : blockSelectAction === 'delete' && isBlockDeletionDisabled
                          ? 'bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] opacity-40 cursor-not-allowed'
                          : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] border-[var(--border)] hover:border-gray-400 hover:shadow-md'
                      : selectedBlockId === block.id
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg scale-105 border-emerald-500'
                        : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] border-[var(--border)] hover:border-emerald-400 hover:shadow-md'
                  }`}
                >
                  <div className="text-xs mb-1 opacity-70">Quadra</div>
                  <div className="text-lg font-bold">{block.name}</div>
                  {block.description && (
                    <div className="text-xs mt-1 opacity-70 truncate">{block.description}</div>
                  )}

                  {/* Indicador de seleção para operações em lote de quadras */}
                  {blockSelectAction &&
                    !(blockSelectAction === 'delete' && isBlockDeletionDisabled) &&
                    (isBlockSelected ? (
                      blockSelectAction === 'delete' ? (
                        <div className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-red-500 flex items-center justify-center shadow-md">
                          <svg
                            className="w-3.5 h-3.5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </div>
                      ) : blockSelectAction === 'block' ? (
                        <div className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-gray-600 flex items-center justify-center shadow-md">
                          <svg
                            className="w-3.5 h-3.5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center shadow-md">
                          <svg
                            className="w-3.5 h-3.5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                            />
                          </svg>
                        </div>
                      )
                    ) : (
                      <div className="absolute top-1 right-1 w-6 h-6 rounded-lg border-2 border-[var(--border)] bg-[var(--surface-hover)]" />
                    ))}

                  {/* Botões de ação no hover e focus (funcionalidades do MapDetails) */}
                  {!blockSelectAction && (
                    <div
                      className={`absolute top-1 right-1 flex gap-1 transition-opacity ${
                        selectedBlockId === block.id
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBlock(block);
                          setIsAddingBlock(true);
                        }}
                        className="p-1.5 bg-yellow-500/80 hover:bg-yellow-600 rounded-lg backdrop-blur-sm cursor-pointer"
                        title="Editar quadra"
                      >
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (blockableCount === 0 && unblocableCount === 0) return;
                          handleToggleSingleBlockLots(String(block.id));
                        }}
                        disabled={blockableCount === 0 && unblocableCount === 0}
                        style={
                          blockableCount === 0 && unblocableCount === 0
                            ? { pointerEvents: 'none' }
                            : {}
                        }
                        className={`p-1.5 rounded-lg transition-all ${
                          blockableCount === 0 && unblocableCount === 0
                            ? 'bg-gray-400/60 cursor-not-allowed opacity-40'
                            : 'bg-gray-600/80 hover:bg-gray-700 cursor-pointer'
                        }`}
                        title={
                          blockableCount === 0 && unblocableCount === 0
                            ? 'Nenhum lote disponível ou bloqueado nesta quadra'
                            : blockableCount > 0 && unblocableCount > 0
                              ? `Bloquear ${blockableCount} e desbloquear ${unblocableCount} lote(s)`
                              : blockableCount > 0
                                ? `Bloquear ${blockableCount} lote(s) disponível(is)`
                                : `Desbloquear ${unblocableCount} lote(s) bloqueado(s)`
                        }
                      >
                        {blockableCount > 0 ? (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                            />
                          </svg>
                        )}
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
                        title={
                          isBlockDeletionDisabled
                            ? 'Não é possível excluir a quadra pois possui lotes reservados ou vendidos'
                            : 'Excluir quadra'
                        }
                      >
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visualização dos Lotes da Quadra Selecionada */}
      {selectedBlockId && blocks.find((b) => b.id === selectedBlockId) && (
        <div className="mb-8">
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-[var(--shadow-lg)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-[var(--foreground)] opacity-80 flex items-center gap-2">
                <svg
                  className="w-7 h-7 text-[var(--accent)]"
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
                Lotes - {blocks.find((b) => b.id === selectedBlockId)?.name}
              </h2>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAddLotToBlock(selectedBlockId)}
                  className="px-5 py-2.5 bg-[var(--success)] hover:bg-green-600 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Adicionar Lote
                </button>

                {!isLoadingBlockLots && selectedBlockLots.length > 0 && (
                  <>
                    <button
                      onClick={() => {
                        if (multiSelectAction === 'delete') {
                          setMultiSelectAction(null);
                          setMultiSelectMode(false);
                          handleClearSelection();
                        } else {
                          // Desativar qualquer operação de quadra ativa
                          handleClearBlockSelection();
                          // Ativar seleção de lotes para exclusão
                          setMultiSelectAction('delete');
                          setMultiSelectMode(true);
                          handleClearSelection();
                        }
                      }}
                      className={`px-4 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-sm ${
                        multiSelectAction === 'delete'
                          ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-lg'
                          : 'bg-red-500/30 border-2 border-red-400/60 text-red-200 hover:bg-red-500/45 hover:border-red-300/70'
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Excluir
                    </button>

                    <button
                      onClick={() => {
                        if (multiSelectAction === 'block') {
                          setMultiSelectAction(null);
                          setMultiSelectMode(false);
                          handleClearSelection();
                        } else {
                          handleClearBlockSelection();
                          setMultiSelectAction('block');
                          setMultiSelectMode(true);
                          handleClearSelection();
                        }
                      }}
                      className={`px-4 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-sm ${
                        multiSelectAction === 'block'
                          ? 'bg-gray-600 text-white ring-2 ring-gray-400 shadow-lg'
                          : 'bg-gray-500/30 border-2 border-gray-400/60 text-gray-200 hover:bg-gray-500/45 hover:border-gray-300/70'
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                      Bloquear
                    </button>

                    <button
                      onClick={() => {
                        if (multiSelectAction === 'unblock') {
                          setMultiSelectAction(null);
                          setMultiSelectMode(false);
                          handleClearSelection();
                        } else {
                          handleClearBlockSelection();
                          setMultiSelectAction('unblock');
                          setMultiSelectMode(true);
                          handleClearSelection();
                        }
                      }}
                      className={`px-4 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-sm ${
                        multiSelectAction === 'unblock'
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg'
                          : 'bg-blue-500/20 border-2 border-blue-400/50 text-blue-200 hover:bg-blue-500/35 hover:border-blue-300/70'
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                      Desbloquear
                    </button>
                  </>
                )}
              </div>
            </div>
            <BlockCard
              key={`${selectedBlockId}-${refreshTrigger}`}
              block={blocks.find((b) => b.id === selectedBlockId)!}
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
              onPlaceLot={(lot) => startPlacingLot(lot.id)}
              onRemoveLotPosition={handleRemoveLotPosition}
              onStartSequentialPlacing={startSequentialPlacing}
              isSequentialPlacing={isSequentialPlacing}
              multiSelectAction={multiSelectAction}
            />
          </div>
        </div>
      )}

      {/* Visualização do Mapa no Google Maps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-bold text-[var(--foreground)] opacity-80">
            Visualização do Mapa
          </label>
          <button
            onClick={() => {
              clearActiveOperations();
              setIsConfiguringOverlay(true);
            }}
            className={`px-4 py-2 text-white font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-2 text-sm ${
              map?.overlayConfig
                ? 'bg-cyan-500 hover:bg-cyan-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {map?.overlayConfig ? 'Editar SVG' : 'Editar SVG'}
          </button>
        </div>

        {/* Controles de posicionamento dos lotes */}
        <div className="mb-3 flex flex-wrap items-center gap-4 bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
          {isPlacingLot ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={cancelPlacingLot}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {isSequentialPlacing ? 'Parar Sequência' : 'Cancelar Posicionamento'}
              </button>
              {isSequentialPlacing && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg">
                  <svg
                    className="w-4 h-4 text-blue-400 animate-pulse"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="text-xs font-bold text-blue-300">
                    Sequencial: {sequentialBlockName}
                  </span>
                  <span className="text-xs text-blue-200">
                    {(() => {
                      const lot = allLotsInMap.find((l) => l.id === placingLotId);
                      return lot ? `Lote ${lot.lotNumber}` : '';
                    })()}{' '}
                    ({sequentialCurrentIndex + 1}/{sequentialQueue.length})
                  </span>
                  {/* Barra de progresso */}
                  <div className="w-20 h-1.5 bg-blue-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all duration-300"
                      style={{
                        width: `${(sequentialCurrentIndex / sequentialQueue.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {!isSequentialPlacing && placingLotId && (
                <span className="text-xs text-[var(--foreground)] opacity-70">
                  {(() => {
                    const lot = allLotsInMap.find((l) => l.id === placingLotId);
                    return lot ? `Posicionando Lote ${lot.lotNumber}` : '';
                  })()}
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-[var(--foreground)] opacity-50">
              Clique em &quot;Posicionar&quot; em um lote para colocá-lo no mapa
            </div>
          )}

          <div className="ml-auto text-xs text-[var(--foreground)] opacity-60">
            {allLotsInMap.filter((l) => l.lat != null && l.lng != null).length} /{' '}
            {allLotsInMap.length} lotes posicionados
          </div>
        </div>

        {isLoading ? (
          <div className="bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-2xl p-6">
            <div className="aspect-video bg-[var(--surface)] rounded-xl animate-pulse"></div>
          </div>
        ) : (
          <div className="bg-[var(--card-bg)] border-2 border-[var(--primary)]/30 rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-2 flex-wrap items-center">
                <h3 className="text-[var(--foreground)] text-lg font-semibold mr-2">
                  Loteamento Completo
                </h3>
                {/* Toggles de visibilidade */}
                {map?.overlayConfig && (
                  <button
                    onClick={() => setShowOverlay((prev) => !prev)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all cursor-pointer border ${
                      showOverlay
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] opacity-50 hover:opacity-80'
                    }`}
                    title={showOverlay ? 'Ocultar SVG' : 'Exibir SVG'}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {showOverlay ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-4.35-4.35"
                        />
                      )}
                    </svg>
                    {showOverlay ? 'Ocultar SVG' : 'Exibir SVG'}
                  </button>
                )}
                <button
                  onClick={() => setShowMarkers((prev) => !prev)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all cursor-pointer border ${
                    showMarkers
                      ? 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] opacity-50 hover:opacity-80'
                  }`}
                  title={showMarkers ? 'Ocultar marcações' : 'Exibir marcações'}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {showMarkers ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-4.35-4.35"
                      />
                    )}
                  </svg>
                  {showMarkers ? 'Ocultar Marcações' : 'Exibir Marcações'}
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Botão de marcação múltipla sequencial */}
                {selectedBlockId &&
                  (() => {
                    const unpositionedCount = selectedBlockLots.filter(
                      (l) => l.lat == null || l.lng == null
                    ).length;
                    if (unpositionedCount === 0) return null;
                    return (
                      <button
                        onClick={() => {
                          clearActiveOperations();
                          startSequentialPlacing(selectedBlockId, selectedBlockLots);
                        }}
                        disabled={isSequentialPlacing}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                          isSequentialPlacing
                            ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                        }`}
                        title={`Posicionar ${unpositionedCount} lotes sequencialmente no mapa`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        Marcação Múltipla ({unpositionedCount})
                      </button>
                    );
                  })()}
                {map?.overlayConfig && map.overlayConfig.bounds && (
                  <button
                    onClick={() => {
                      const bounds = map.overlayConfig!.bounds;
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
                {/* Botão para visualização pública */}
                <button
                  onClick={() => window.open(`/view/${mapId}`, '_blank')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm cursor-pointer"
                  title="Abrir mapa de visualização pública"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Mapa de Visualização
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--background)] rounded-xl overflow-hidden h-[600px]">
              <PublicMapViewer
                address={map?.address}
                blocks={blocks}
                lots={allLotsInMap}
                overlayConfig={map?.overlayConfig}
                placingMode={isPlacingLot}
                onMapClick={handleMapClickForPlacement}
                showOverlay={showOverlay}
                showMarkers={showMarkers}
                placingLotLabel={
                  placingLotId
                    ? (() => {
                        const lot = allLotsInMap.find((l) => l.id === placingLotId);
                        if (!lot) return undefined;
                        if (isSequentialPlacing) {
                          return `Lote ${lot.lotNumber} (${sequentialCurrentIndex + 1}/${sequentialQueue.length}) - ${sequentialBlockName}`;
                        }
                        return `Lote ${lot.lotNumber}`;
                      })()
                    : undefined
                }
              />
              {map?.address && (
                <p className="text-[var(--foreground)]/60 text-xs mt-3 px-4 pb-4 text-center">
                  Endereço: {map.address}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Adicionar/Editar Quadra */}
      {isAddingBlock && editingBlock && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div
            className="bg-[var(--card-bg)] rounded-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] my-auto overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editingBlock.name.trim()) {
                e.preventDefault();
                handleSaveBlock();
              }
            }}
          >
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white p-4 sm:p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg
                      className="w-5 h-5 sm:w-7 sm:h-7"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">
                      {editingBlock.id ? 'Editar Quadra' : 'Adicionar Quadra'}
                    </h2>
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
                    onChange={(e) =>
                      setEditingBlock({ ...editingBlock, description: e.target.value })
                    }
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
          <div
            className="bg-[var(--card-bg)] rounded-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] my-auto overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmitLot && submitLotFn) {
                e.preventDefault();
                submitLotFn();
              }
            }}
          >
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white p-4 sm:p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg
                      className="w-5 h-5 sm:w-7 sm:h-7 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
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
            <div className="p-4 sm:p-6">
              <LotForm
                blockId={selectedBlockForLot}
                blockName={blocks.find((b) => b.id === selectedBlockForLot)?.name || ''}
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
                  <svg
                    className="w-7 h-7 text-white"
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
                Todos os dados relacionados (quadras, lotes disponíveis) serão permanentemente
                removidos.
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
                    Excluindo...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
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
                    <svg
                      className="w-7 h-7 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
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
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
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
      {multiSelectAction && selectedLots.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
          <div
            className={`rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 min-w-[300px] sm:min-w-[400px] border-2 ${
              multiSelectAction === 'delete'
                ? 'bg-gradient-to-r from-red-600 to-red-700 border-red-400/30'
                : multiSelectAction === 'unblock'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-400/30'
                  : 'bg-gradient-to-r from-gray-600 to-gray-700 border-gray-400/30'
            }`}
          >
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
                  {multiSelectAction === 'delete'
                    ? (() => {
                        const blockGroups = selectedLots.reduce(
                          (acc, lot) => {
                            const block = blocks.find((b) => b.id === lot.blockId);
                            const name = block?.name || 'Desconhecida';
                            acc[name] = (acc[name] || 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>
                        );
                        const groupTexts = Object.entries(blockGroups).map(
                          ([name, count]) => `${name}: ${count}`
                        );
                        return groupTexts.length > 1
                          ? groupTexts.join(' | ')
                          : 'selecionado(s) para exclusão';
                      })()
                    : multiSelectAction === 'block'
                      ? (() => {
                          const count = selectedLots.filter(
                            (l) => l.status === LotStatus.AVAILABLE
                          ).length;
                          return `${count} lote(s) a bloquear`;
                        })()
                      : (() => {
                          const count = selectedLots.filter(
                            (l) => l.status === LotStatus.BLOCKED
                          ).length;
                          return `${count} lote(s) a desbloquear`;
                        })()}
                </p>
              </div>
            </div>

            {/* Separador */}
            <div className="hidden sm:block w-px h-12 bg-white/20"></div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  handleClearSelection();
                  setMultiSelectAction(null);
                  setMultiSelectMode(false);
                }}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 backdrop-blur-sm border border-white/20 text-sm cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancelar
              </button>

              {multiSelectAction === 'delete' && (
                <button
                  onClick={handleBulkDelete}
                  disabled={
                    !selectedLots.some(
                      (l) => l.status !== LotStatus.RESERVED && l.status !== LotStatus.SOLD
                    )
                  }
                  className="px-4 py-2 bg-white hover:bg-red-100 text-red-700 rounded-xl font-bold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Confirmar Exclusão
                </button>
              )}

              {(multiSelectAction === 'block' || multiSelectAction === 'unblock') && (
                <button
                  onClick={handleBulkBlockToggle}
                  disabled={
                    !selectedLots.some((l) =>
                      multiSelectAction === 'block'
                        ? l.status === LotStatus.AVAILABLE
                        : l.status === LotStatus.BLOCKED
                    )
                  }
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {multiSelectAction === 'block' ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    )}
                  </svg>
                  {multiSelectAction === 'block' ? 'Confirmar Bloqueio' : 'Confirmar Desbloqueio'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra de Ação Flutuante para Seleção Múltipla de Quadras */}
      {blockSelectAction && selectedBlockIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
          <div
            className={`rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 min-w-[300px] sm:min-w-[400px] border-2 ${
              blockSelectAction === 'delete'
                ? 'bg-gradient-to-r from-red-600 to-red-700 border-red-400/30'
                : blockSelectAction === 'unblock'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-400/30'
                  : 'bg-gradient-to-r from-gray-600 to-gray-700 border-gray-400/30'
            }`}
          >
            {/* Contador de Quadras */}
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{selectedBlockIds.length}</span>
              </div>
              <div className="text-white">
                <p className="font-bold text-lg leading-tight">
                  {selectedBlockIds.length === 1
                    ? '1 Quadra'
                    : `${selectedBlockIds.length} Quadras`}
                </p>
                <p className="text-white opacity-80 text-xs">
                  {blockSelectAction === 'delete'
                    ? selectedBlockIds
                        .map((id) => blocks.find((b) => b.id === id)?.name || '?')
                        .join(', ')
                    : (() => {
                        const allLots = allLotsInMap.filter((l) =>
                          selectedBlockIds.includes(String(l.blockId))
                        );
                        if (blockSelectAction === 'block') {
                          const count = allLots.filter(
                            (l) => l.status === LotStatus.AVAILABLE
                          ).length;
                          return `${count} lote(s) a bloquear`;
                        }
                        const count = allLots.filter((l) => l.status === LotStatus.BLOCKED).length;
                        return `${count} lote(s) a desbloquear`;
                      })()}
                </p>
              </div>
            </div>

            {/* Separador */}
            <div className="hidden sm:block w-px h-12 bg-white/20"></div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearBlockSelection}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 backdrop-blur-sm border border-white/20 text-sm cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancelar
              </button>

              {blockSelectAction === 'delete' && (
                <button
                  onClick={handleBulkBlockDelete}
                  className="px-4 py-2 bg-white hover:bg-red-100 text-red-700 rounded-xl font-bold transition-all duration-200 flex items-center gap-2 text-sm cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Confirmar Exclusão
                </button>
              )}

              {(blockSelectAction === 'block' || blockSelectAction === 'unblock') && (
                <button
                  onClick={handleBulkBlockToggleAll}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-all duration-200 flex items-center gap-2 text-sm cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {blockSelectAction === 'block' ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    )}
                  </svg>
                  {blockSelectAction === 'block' ? 'Confirmar Bloqueio' : 'Confirmar Desbloqueio'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configurar Overlay SVG */}
      {isConfiguringOverlay && (
        <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)]">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Overlay SVG sobre o Mapa</h2>
                    <p className="text-white/80 text-sm">
                      Sobreponha uma imagem do loteamento sobre o Google Maps
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsConfiguringOverlay(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
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

            <div className="p-6">
              <SVGOverlayEditor
                key={`overlay-editor-${isConfiguringOverlay}`}
                initialOverlay={map?.overlayConfig}
                onSave={saveOverlayConfig}
                onCancel={() => setIsConfiguringOverlay(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de formulário de lote
type LotFormProps = {
  blockId: string;
  blockName: string;
  onSave: (lot: Lot) => void;
  onCancel: () => void;
  onSubmitChange?: (canSubmit: boolean, submit: () => void) => void;
};

function LotForm({ blockId, blockName, onSave, onSubmitChange }: LotFormProps) {
  const [lotNumber, setLotNumber] = useState('');
  const [size, setSize] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [priceDisplay, setPriceDisplay] = useState<string>('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<LotStatus>(LotStatus.AVAILABLE);

  // Os callbacks do pai são inline; guardá-los em ref evita notificar o pai a cada render dele
  const onSaveRef = useRef(onSave);
  const onSubmitChangeRef = useRef(onSubmitChange);
  useEffect(() => {
    onSaveRef.current = onSave;
    onSubmitChangeRef.current = onSubmitChange;
  });

  const handleSubmit = useCallback(() => {
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

    onSaveRef.current(lot);
  }, [blockId, lotNumber, status, totalPrice, size, description]);

  // Notificar o pai quando o estado mudar
  useEffect(() => {
    const canSubmit = !!(lotNumber && size && totalPrice);
    onSubmitChangeRef.current?.(canSubmit, handleSubmit);
  }, [lotNumber, size, totalPrice, handleSubmit]);

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
        <p className="text-xs text-[var(--foreground)]/60 mt-1">
          💡 Preencha manualmente o valor do lote
        </p>
      </div>

      <div>
        <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as LotStatus)}
          className="w-full px-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] cursor-pointer focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
        >
          <option value={LotStatus.AVAILABLE}>Disponível</option>
          <option value={LotStatus.BLOCKED}>Bloqueado</option>
        </select>
        <p className="text-xs text-[var(--foreground)]/60 mt-1">
          💡 Para reservar ou vender, use a página de Reservas
        </p>
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
type BlockCardProps = {
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
  reservations: ReservationSummary[];
  userRole?: string;
  multiSelectMode?: boolean;
  selectedLots?: Lot[];
  onToggleLotSelection?: (lot: Lot) => void;
  onSingleLotClick?: (lot: Lot) => void;
  onPlaceLot?: (lot: Lot) => void;
  onRemoveLotPosition?: (lot: Lot) => void;
  onStartSequentialPlacing?: (blockId: string, lots?: Lot[]) => void;
  isSequentialPlacing?: boolean;
  multiSelectAction?: 'delete' | 'block' | 'unblock' | null;
};

function BlockCard({
  blockLots,
  isLoadingBlockLots,
  handleEditLot,
  handleDeleteLot,
  handleToggleLotStatus,
  allBlocks,
  reservations,
  userRole,
  multiSelectMode = false,
  selectedLots = [],
  onToggleLotSelection,
  onSingleLotClick,
  onPlaceLot,
  onRemoveLotPosition,
  multiSelectAction = null,
}: BlockCardProps) {
  // Verificar se existem lotes reservados ou vendidos
  const hasReservedOrSoldLots = blockLots.some(
    (lot) => lot.status === LotStatus.RESERVED || lot.status === LotStatus.SOLD
  );
  const reservedOrSoldCount = blockLots.filter(
    (lot) => lot.status === LotStatus.RESERVED || lot.status === LotStatus.SOLD
  ).length;

  return (
    <div>
      {/* Aviso de lotes reservados/vendidos */}
      {hasReservedOrSoldLots && (
        <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0"
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
              <p className="font-bold text-orange-800 text-sm mb-1">
                ⚠️ Quadra com lotes reservados/vendidos
              </p>
              <p className="text-orange-700 text-sm">
                Esta quadra possui <strong>{reservedOrSoldCount} lote(s)</strong> com reservas ou
                vendas ativas. Para excluir esta quadra, cancele primeiro as reservas/vendas na
                página de <strong>Reservas</strong>.
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
          selectedLotIds={selectedLots.map((l) => l.id)}
          allowMultipleSelection={multiSelectMode}
          onMultipleSelect={
            multiSelectMode && onToggleLotSelection
              ? (lots) => {
                  // Recebe um array com um único lote para fazer toggle
                  if (lots.length === 1) {
                    onToggleLotSelection(lots[0]);
                  }
                }
              : undefined
          }
          lotsPerRow={15}
          reservations={reservations}
          userRole={userRole}
          isAdminContext={true}
          onPlaceLot={onPlaceLot}
          onRemoveLotPosition={onRemoveLotPosition}
          multiSelectAction={multiSelectAction}
        />
      ) : (
        <div className="text-center py-8 bg-[var(--card-bg)] rounded-xl border-2 border-dashed border-[var(--accent)]/40">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-[var(--accent)]"
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
          <p className="text-white font-medium mb-2">Nenhum lote cadastrado nesta quadra</p>
          <p className="text-white/70 text-sm mb-4">
            Clique em &quot;Adicionar Lote&quot; para começar
          </p>
        </div>
      )}
    </div>
  );
}
