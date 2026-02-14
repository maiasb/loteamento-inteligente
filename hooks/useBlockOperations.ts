import { useState, useCallback } from 'react';
import axios from 'axios';
import { Block } from '@/types';

const API_URL = '/api';

export function useBlockOperations() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Carrega todas as quadras de um mapa específico
   */
  const loadBlocks = useCallback(async (mapId: string) => {
    if (!mapId) return;

    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/mapas/quadras`, {
        params: { mapId },
        timeout: 10000,
      });

      const blocksData = response.data || [];
      const formattedBlocks: Block[] = blocksData.map((block: any) => ({
        id: block.id,
        mapId: block.mapId,
        name: block.name,
        description: block.description || '',
        createdAt: new Date(block.createdAt),
        updatedAt: new Date(block.updatedAt),
      }));

      setBlocks(formattedBlocks);
    } catch (error) {
      console.error('[useBlockOperations] ❌ Erro ao carregar quadras:', error);
      setBlocks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Cria uma nova quadra
   */
  const createBlock = useCallback(async (block: Omit<Block, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newBlock = {
        ...block,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await axios.post(`${API_URL}/mapas/quadras/criar`, newBlock, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      await loadBlocks(block.mapId);
    } catch (error) {
      console.error('[useBlockOperations] ❌ Erro ao criar quadra:', error);
      throw error;
    }
  }, [loadBlocks]);

  /**
   * Atualiza uma quadra existente
   */
  const updateBlock = useCallback(async (block: Block) => {
    try {
      const updatedBlock = {
        ...block,
        updatedAt: new Date(),
      };

      await axios.patch(`${API_URL}/mapas/quadras/atualizar`, updatedBlock, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      await loadBlocks(block.mapId);
    } catch (error) {
      console.error('[useBlockOperations] ❌ Erro ao atualizar quadra:', error);
      throw error;
    }
  }, [loadBlocks]);

  /**
   * Deleta uma quadra
   */
  const deleteBlock = useCallback(async (blockId: string, mapId: string) => {
    try {
      await axios.delete(`${API_URL}/mapas/quadras/deletar`, {
        params: { blockId },
        timeout: 10000,
      });

      await loadBlocks(mapId);
    } catch (error: any) {
      console.error('[useBlockOperations] ❌ Erro ao deletar quadra:', error);
      // Repassar mensagem de erro do backend
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  }, [loadBlocks]);

  /**
   * Busca uma quadra pelo ID
   */
  const getBlockById = useCallback((blockId: string): Block | undefined => {
    return blocks.find(block => block.id === blockId);
  }, [blocks]);

  return {
    blocks,
    isLoading,
    loadBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
    getBlockById,
  };
}
