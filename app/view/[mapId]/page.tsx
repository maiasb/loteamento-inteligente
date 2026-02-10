'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ViewOnlyLotMap from '@/components/ViewOnlyLotMap';
import { Block, Lot, GeoCoordinate } from '@/types';

// Forçar essa página a ser apenas client-side (sem SSG/SSR)
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface MapData {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  boundaryCoordinates: GeoCoordinate[] | null;
}

interface ViewData {
  map: MapData;
  blocks: Block[];
  lots: Lot[];
}

export default function ViewMapPage() {
  const params = useParams();
  const router = useRouter();
  const mapId = params?.mapId as string;

  const [viewData, setViewData] = useState<ViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapId) {
      setError('ID do mapa não fornecido');
      setLoading(false);
      return;
    }

    const fetchViewData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/mapas/visualizacao?mapId=${mapId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Mapa não encontrado');
          } else {
            setError('Erro ao carregar dados do mapa');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setViewData(data);
      } catch (err) {
        console.error('[ViewMapPage] Erro ao buscar dados:', err);
        setError('Erro ao carregar dados do mapa');
      } finally {
        setLoading(false);
      }
    };

    fetchViewData();
  }, [mapId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <svg
            className="animate-spin h-16 w-16 mx-auto mb-4 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
          >
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
          <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Carregando mapa...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md p-8">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-500"
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            O mapa solicitado não está disponível ou não foi encontrado.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!viewData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-xl text-gray-700 dark:text-gray-300">
            Nenhum dado disponível
          </p>
        </div>
      </div>
    );
  }

  return (
    <ViewOnlyLotMap
      mapName={viewData.map.name}
      address={viewData.map.address || undefined}
      boundaryCoordinates={viewData.map.boundaryCoordinates || undefined}
      blocks={viewData.blocks}
      lots={viewData.lots}
    />
  );
}
