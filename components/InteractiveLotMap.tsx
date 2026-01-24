'use client';

import React, { useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Polygon } from '@react-google-maps/api';
import { GeoCoordinate, Lot, LotStatus } from '@/types';

interface InteractiveLotMapProps {
  mapBoundary?: GeoCoordinate[];
  lots: Lot[];
  selectedLots: Lot[];
  onLotClick: (lot: Lot) => void;
  showPrices?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '600px',
};

const libraries: ("drawing" | "places")[] = ["drawing", "places"];

export default function InteractiveLotMap({
  mapBoundary,
  lots,
  selectedLots,
  onLotClick,
  showPrices = true,
}: InteractiveLotMapProps) {
  const [hoveredLot, setHoveredLot] = useState<string | null>(null);

  // Calcular centro do mapa
  const getCenter = () => {
    if (mapBoundary && mapBoundary.length > 0) {
      const latSum = mapBoundary.reduce((sum, coord) => sum + coord.lat, 0);
      const lngSum = mapBoundary.reduce((sum, coord) => sum + coord.lng, 0);
      return {
        lat: latSum / mapBoundary.length,
        lng: lngSum / mapBoundary.length,
      };
    }
    return { lat: -6.064831, lng: -50.045556 };
  };

  const center = getCenter();

  // Filtrar apenas lotes com coordenadas
  const lotsWithCoordinates = lots.filter(lot => lot.coordinates && lot.coordinates.length >= 3);

  // Função para obter cor do lote baseado no status
  const getLotColor = (lot: Lot, isSelected: boolean, isHovered: boolean) => {
    if (isSelected) {
      return {
        fillColor: '#9333EA', // Roxo para selecionado
        fillOpacity: 0.6,
        strokeColor: '#7C3AED',
        strokeWeight: 3,
      };
    }

    if (isHovered) {
      return {
        fillColor: '#60A5FA', // Azul claro hover
        fillOpacity: 0.7,
        strokeColor: '#3B82F6',
        strokeWeight: 3,
      };
    }

    switch (lot.status) {
      case LotStatus.AVAILABLE:
        return {
          fillColor: '#10B981', // Verde
          fillOpacity: 0.5,
          strokeColor: '#059669',
          strokeWeight: 2,
        };
      case LotStatus.RESERVED:
        return {
          fillColor: '#F59E0B', // Amarelo
          fillOpacity: 0.5,
          strokeColor: '#D97706',
          strokeWeight: 2,
        };
      case LotStatus.SOLD:
        return {
          fillColor: '#EF4444', // Vermelho
          fillOpacity: 0.5,
          strokeColor: '#DC2626',
          strokeWeight: 2,
        };
      case LotStatus.BLOCKED:
        return {
          fillColor: '#6B7280', // Cinza
          fillOpacity: 0.5,
          strokeColor: '#4B5563',
          strokeWeight: 2,
        };
      default:
        return {
          fillColor: '#10B981',
          fillOpacity: 0.5,
          strokeColor: '#059669',
          strokeWeight: 2,
        };
    }
  };

  // Obter label do status
  const getStatusLabel = (status: LotStatus) => {
    switch (status) {
      case LotStatus.AVAILABLE:
        return 'Disponível';
      case LotStatus.RESERVED:
        return 'Reservado';
      case LotStatus.SOLD:
        return 'Vendido';
      case LotStatus.BLOCKED:
        return 'Bloqueado';
      default:
        return status;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Legenda */}
      <div className="bg-[var(--card-bg)] rounded-xl p-4 border border-[var(--border)]">
        <h3 className="font-semibold text-[var(--foreground)] mb-3">Legenda:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-green-500"></div>
            <span className="text-sm text-[var(--foreground)]">Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-yellow-500"></div>
            <span className="text-sm text-[var(--foreground)]">Reservado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-500"></div>
            <span className="text-sm text-[var(--foreground)]">Vendido</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-purple-600"></div>
            <span className="text-sm text-[var(--foreground)]">Selecionado</span>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-600">
            {lots.filter(l => l.status === LotStatus.AVAILABLE).length}
          </p>
          <p className="text-sm text-[var(--foreground)]/60">Disponíveis</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-600">{selectedLots.length}</p>
          <p className="text-sm text-[var(--foreground)]/60">Selecionados</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-2xl font-bold text-yellow-600">
            {lots.filter(l => l.status === LotStatus.RESERVED).length}
          </p>
          <p className="text-sm text-[var(--foreground)]/60">Reservados</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-600">{lotsWithCoordinates.length}</p>
          <p className="text-sm text-[var(--foreground)]/60">No Mapa</p>
        </div>
      </div>

      {/* Informação sobre hover */}
      {hoveredLot && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          {(() => {
            const lot = lots.find(l => l.id === hoveredLot);
            if (!lot) return null;
            return (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    Lote {lot.lotNumber} {lot.blockName && `- Quadra ${lot.blockName}`}
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {lot.size}m² • {getStatusLabel(lot.status)}
                    {showPrices && ` • R$ ${lot.price.toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <button
                  onClick={() => onLotClick(lot)}
                  disabled={lot.status !== LotStatus.AVAILABLE}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                >
                  {lot.status === LotStatus.AVAILABLE ? 'Selecionar' : 'Indisponível'}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Mapa Interativo */}
      <div className="bg-white/5 rounded-xl overflow-hidden border-2 border-[var(--border)]">
        <LoadScript
          googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
          libraries={libraries}
        >
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={mapBoundary && mapBoundary.length > 0 ? 17 : 14}
            options={{
              mapTypeId: 'satellite',
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
            }}
          >
            {/* Área do loteamento */}
            {mapBoundary && mapBoundary.length > 0 && (
              <Polygon
                paths={mapBoundary}
                options={{
                  fillColor: '#2196F3',
                  fillOpacity: 0.1,
                  strokeColor: '#1976D2',
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                  clickable: false,
                }}
              />
            )}

            {/* Renderizar cada lote */}
            {lotsWithCoordinates.map((lot) => {
              const isSelected = selectedLots.some(l => l.id === lot.id);
              const isHovered = hoveredLot === lot.id;
              const isClickable = lot.status === LotStatus.AVAILABLE;

              return (
                <Polygon
                  key={lot.id}
                  paths={lot.coordinates!}
                  options={{
                    ...getLotColor(lot, isSelected, isHovered),
                    clickable: isClickable,
                  }}
                  onClick={() => {
                    if (isClickable) {
                      onLotClick(lot);
                    }
                  }}
                  onMouseOver={() => setHoveredLot(lot.id)}
                  onMouseOut={() => setHoveredLot(null)}
                />
              );
            })}
          </GoogleMap>
        </LoadScript>
      </div>

      {/* Aviso se não houver lotes mapeados */}
      {lotsWithCoordinates.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-center">
          <p className="text-yellow-800 dark:text-yellow-200">
            ⚠️ Nenhum lote foi delimitado no mapa ainda. Configure as áreas dos lotes no painel administrativo.
          </p>
        </div>
      )}
    </div>
  );
}
