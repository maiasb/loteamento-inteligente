import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Map } from '@/types';
import { compressImage, getBase64Size } from '@/lib/imageUtils';

const API_URL = '/api';

type MapApiResponse = {
  mapId?: string;
  id?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  width?: number;
  height?: number;
  createdAt?: string;
  updatedAt?: string;
  lots?: unknown[];
};

export function useMapOperations() {
  const [maps, setMaps] = useState<Map[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMaps = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/mapas`);
      const mapsData = response.data;

      // Verifica se mapsData é um array válido
      if (!Array.isArray(mapsData)) {
        console.warn('API retornou dados inválidos ou sem mapas:', mapsData);
        setMaps([]);
        return;
      }

      const processedMaps = mapsData.map((mapData: MapApiResponse) => ({
        id: mapData.mapId || mapData.id || '',
        name: mapData.name || `Mapa ${mapData.mapId || mapData.id}`,
        description: mapData.description || '',
        imageUrl: mapData.imageUrl || '',
        imageType: 'image' as const,
        width: mapData.width || 800,
        height: mapData.height || 600,
        createdAt: mapData.createdAt ? new Date(mapData.createdAt) : new Date(),
        updatedAt: mapData.updatedAt ? new Date(mapData.updatedAt) : new Date(),
      }));

      setMaps(processedMaps);
    } catch (error) {
      console.error('Erro ao buscar mapas:', error);
      setMaps([]);
      alert('Erro ao carregar mapas. Verifique se a API está rodando.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  const createMap = useCallback(
    async (mapData: { name: string; description: string; imageUrl: string }) => {
      try {
        const response = await axios.post(`${API_URL}/mapas/criar`, mapData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
        await loadMaps();
        return response.data;
      } catch (error) {
        console.error('Erro ao criar mapa:', error);
        throw error;
      }
    },
    [loadMaps]
  );

  const deleteMapById = useCallback(
    async (id: string) => {
      try {
        await axios.delete(`${API_URL}/mapas/deletar`, {
          params: { mapId: id },
          timeout: 10000,
        });
        await loadMaps();
      } catch (error) {
        console.error('Erro ao deletar mapa:', error);
        // Repassar mensagem de erro do backend
        if (axios.isAxiosError(error) && error.response?.data) {
          throw error.response.data;
        }
        throw error;
      }
    },
    [loadMaps]
  );

  const processFileUpload = useCallback(
    async (file: File, editingMap: Partial<Map> | null): Promise<void> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;

          try {
            if (file.type.startsWith('image/')) {
              const compressedDataUrl = await compressImage(dataUrl, 1920, 1080, 0.7);
              const size = getBase64Size(compressedDataUrl);

              if (size > 10) {
                alert(
                  'Imagem muito grande! Por favor, use uma imagem menor ou de menor qualidade (máximo 10MB).'
                );
                reject(new Error('Imagem muito grande'));
                return;
              }

              const img = new Image();
              img.onload = async () => {
                try {
                  const mapData = {
                    name: editingMap?.name || file.name,
                    description: editingMap?.description || '',
                    imageUrl: compressedDataUrl,
                  };

                  await createMap(mapData);
                  resolve();
                } catch (error) {
                  console.error('Erro ao salvar mapa:', error);
                  alert(
                    error instanceof Error
                      ? error.message
                      : 'Erro ao salvar mapa. Tente com uma imagem menor.'
                  );
                  reject(error);
                }
              };
              img.src = compressedDataUrl;
            } else if (file.type === 'application/pdf') {
              const size = getBase64Size(dataUrl);

              if (size > 50) {
                alert('PDF muito grande! Por favor, use um arquivo menor (máximo 50MB).');
                reject(new Error('PDF muito grande'));
                return;
              }

              try {
                const mapData = {
                  name: editingMap?.name || file.name,
                  description: editingMap?.description || '',
                  imageUrl: dataUrl,
                };

                await createMap(mapData);
                resolve();
              } catch (error) {
                console.error('Erro ao salvar PDF:', error);
                alert(error instanceof Error ? error.message : 'Erro ao salvar PDF.');
                reject(error);
              }
            }
          } catch (error) {
            console.error('Erro ao processar arquivo:', error);
            alert('Erro ao processar arquivo. Por favor, tente novamente com um arquivo menor.');
            reject(error);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [createMap]
  );

  return {
    maps,
    isLoading,
    loadMaps,
    createMap,
    deleteMapById,
    processFileUpload,
  };
}
