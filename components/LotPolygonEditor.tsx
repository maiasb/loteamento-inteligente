'use client';

import React, { useState, useCallback } from 'react';
import { GoogleMap, useLoadScript, DrawingManager, Polygon } from '@react-google-maps/api';
import { GeoCoordinate, Lot } from '@/types';

interface LotPolygonEditorProps {
  lot: Lot;
  mapBoundary?: GeoCoordinate[]; // Área delimitada do loteamento
  onSave: (coordinates: GeoCoordinate[]) => Promise<void>;
  onCancel: () => void;
}

const containerStyle = {
  width: '100%',
  height: '600px',
};

const libraries: ("drawing" | "places")[] = ["drawing", "places"];

export default function LotPolygonEditor({ lot, mapBoundary, onSave, onCancel }: LotPolygonEditorProps) {
  const [polygon, setPolygon] = useState<google.maps.Polygon | null>(null);
  const [coordinates, setCoordinates] = useState<GeoCoordinate[]>(lot.coordinates || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as any,
  });

  // Calcular centro do mapa baseado no boundary do loteamento ou usar padrão
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

  const onPolygonComplete = useCallback((poly: google.maps.Polygon) => {
    const path = poly.getPath();
    const coords: GeoCoordinate[] = [];
    
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coords.push({
        lat: point.lat(),
        lng: point.lng(),
      });
    }

    setCoordinates(coords);
    setPolygon(poly);
    setIsDrawing(false);

    // Fazer o polígono editável
    poly.setEditable(true);
    poly.setOptions({
      fillColor: '#4CAF50',
      fillOpacity: 0.4,
      strokeColor: '#2E7D32',
      strokeWeight: 2,
    });

    // Atualizar coordenadas quando o polígono for editado
    google.maps.event.addListener(poly.getPath(), 'set_at', () => {
      updateCoordinatesFromPolygon(poly);
    });
    google.maps.event.addListener(poly.getPath(), 'insert_at', () => {
      updateCoordinatesFromPolygon(poly);
    });
  }, []);

  const updateCoordinatesFromPolygon = (poly: google.maps.Polygon) => {
    const path = poly.getPath();
    const coords: GeoCoordinate[] = [];
    
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coords.push({
        lat: point.lat(),
        lng: point.lng(),
      });
    }
    
    setCoordinates(coords);
  };

  const handleClearDrawing = () => {
    if (polygon) {
      polygon.setMap(null);
      setPolygon(null);
    }
    setCoordinates([]);
    setIsDrawing(false);
  };

  const handleSave = async () => {
    if (coordinates.length < 3) {
      alert('⚠️ Você precisa desenhar um polígono com pelo menos 3 pontos!');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(coordinates);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Instruções */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          📍 Como delimitar o lote:
        </h3>
        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
          <li>Localize o lote <strong>"{lot.lotNumber}"</strong> na área do mapa</li>
          <li>Clique em <strong>"Iniciar Desenho"</strong></li>
          <li>Clique nos cantos do lote para criar o polígono</li>
          <li>Clique no primeiro ponto novamente para fechar</li>
          <li>Ajuste os pontos arrastando-os se necessário</li>
          <li>Clique em <strong>"Salvar Coordenadas"</strong></li>
        </ol>
      </div>

      {/* Informações do Lote */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--surface)] p-4 rounded-xl">
        <div>
          <p className="text-xs text-[var(--foreground)]/60">Lote</p>
          <p className="font-bold text-[var(--foreground)]">{lot.lotNumber}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--foreground)]/60">Quadra</p>
          <p className="font-bold text-[var(--foreground)]">{lot.blockName || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--foreground)]/60">Tamanho</p>
          <p className="font-bold text-[var(--foreground)]">{lot.size}m²</p>
        </div>
        <div>
          <p className="text-xs text-[var(--foreground)]/60">Status</p>
          <p className="font-bold text-[var(--foreground)]">
            {coordinates.length > 0 ? `${coordinates.length} pontos` : 'Não delimitado'}
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-2">
        {!isDrawing && coordinates.length === 0 && (
          <button
            onClick={() => setIsDrawing(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Iniciar Desenho
          </button>
        )}

        {coordinates.length > 0 && (
          <>
            <button
              onClick={handleClearDrawing}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Limpar Desenho
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || coordinates.length < 3}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Salvar Coordenadas
                </>
              )}
            </button>
          </>
        )}

        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
        >
          Cancelar
        </button>
      </div>

      {/* Mapa do Google */}
      <div className="bg-white/5 rounded-xl overflow-hidden border-2 border-[var(--border)]">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-[600px] bg-gray-100 dark:bg-gray-800">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Carregando mapa...</p>
            </div>
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-center h-[600px] bg-gray-100 dark:bg-gray-800">
            <div className="text-center text-red-600">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>Erro ao carregar o mapa</p>
              <p className="text-sm mt-2">{loadError.message}</p>
            </div>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={18}
            options={{
              mapTypeId: 'satellite',
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
            }}
          >
            {/* Mostrar área do loteamento se existir */}
            {mapBoundary && mapBoundary.length > 0 && (
              <Polygon
                paths={mapBoundary}
                options={{
                  fillColor: '#2196F3',
                  fillOpacity: 0.15,
                  strokeColor: '#1976D2',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  clickable: false,
                }}
              />
            )}

            {/* Drawing Manager para desenhar o polígono do lote */}
            {isDrawing && (
              <DrawingManager
                onPolygonComplete={onPolygonComplete}
                options={{
                  drawingControl: false,
                  drawingMode: google.maps.drawing.OverlayType.POLYGON,
                  polygonOptions: {
                    fillColor: '#4CAF50',
                    fillOpacity: 0.4,
                    strokeColor: '#2E7D32',
                    strokeWeight: 2,
                    editable: false,
                    draggable: false,
                  },
                }}
              />
            )}

            {/* Mostrar polígono existente do lote */}
            {!isDrawing && coordinates.length > 0 && !polygon && (
              <Polygon
                paths={coordinates}
                options={{
                  fillColor: '#4CAF50',
                  fillOpacity: 0.4,
                  strokeColor: '#2E7D32',
                  strokeWeight: 2,
                  editable: false,
                }}
              />
            )}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}
