'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useLoadScript, Polygon, Marker } from '@react-google-maps/api';
import { GeoCoordinate, Lot } from '@/types';

interface LotPolygonEditorProps {
  lot: Lot;
  mapBoundary?: GeoCoordinate[]; // Área delimitada do loteamento
  blockBoundary?: GeoCoordinate[]; // Área delimitada da quadra
  onSave: (coordinates: GeoCoordinate[]) => Promise<void>;
  onCancel: () => void;
}

const containerStyle = {
  width: '100%',
  height: '600px',
};

const libraries: ("drawing" | "places")[] = ["drawing", "places"];

// Função helper para verificar se um ponto está dentro de um polígono
function isPointInPolygon(point: GeoCoordinate, polygon: GeoCoordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    
    const intersect = ((yi > point.lng) !== (yj > point.lng))
        && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function LotPolygonEditor({ lot, mapBoundary, blockBoundary, onSave, onCancel }: LotPolygonEditorProps) {
  const [polygon, setPolygon] = useState<google.maps.Polygon | null>(null);
  const [coordinates, setCoordinates] = useState<GeoCoordinate[]>(lot.coordinates || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as any,
  });

  // Criar DrawingManager manualmente para evitar duplicação
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isDrawing || drawingManagerRef.current) {
      return;
    }

    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.POLYGON,
          google.maps.drawing.OverlayType.RECTANGLE,
        ],
      },
      polygonOptions: {
        fillColor: '#4CAF50',
        fillOpacity: 0.4,
        strokeColor: '#2E7D32',
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
      rectangleOptions: {
        fillColor: '#4CAF50',
        fillOpacity: 0.4,
        strokeColor: '#2E7D32',
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });

    drawingManager.setMap(mapRef.current);
    drawingManagerRef.current = drawingManager;

    // Listener para polígono completo
    google.maps.event.addListener(drawingManager, 'polygoncomplete', (poly: google.maps.Polygon) => {
      const path = poly.getPath();
      const coords: GeoCoordinate[] = [];
      
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coords.push({ lat: point.lat(), lng: point.lng() });
      }

      setCoordinates(coords);
      setPolygon(poly);
      setIsDrawing(false);
      drawingManager.setDrawingMode(null);

      // Fazer o polígono editável e arrastável
      poly.setEditable(true);
      poly.setDraggable(true);

      // Atualizar coordenadas quando o polígono for editado
      google.maps.event.addListener(poly.getPath(), 'set_at', () => {
        updateCoordinatesFromPolygon(poly);
      });
      google.maps.event.addListener(poly.getPath(), 'insert_at', () => {
        updateCoordinatesFromPolygon(poly);
      });
    });

    // Listener para retângulo completo
    google.maps.event.addListener(drawingManager, 'rectanglecomplete', (rectangle: google.maps.Rectangle) => {
      const bounds = rectangle.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const rectangleCoords: GeoCoordinate[] = [
          { lat: ne.lat(), lng: ne.lng() },
          { lat: ne.lat(), lng: sw.lng() },
          { lat: sw.lat(), lng: sw.lng() },
          { lat: sw.lat(), lng: ne.lng() },
        ];
        
        // Criar polígono a partir do retângulo
        const poly = new google.maps.Polygon({
          paths: rectangleCoords,
          fillColor: '#4CAF50',
          fillOpacity: 0.4,
          strokeColor: '#2E7D32',
          strokeWeight: 2,
          editable: true,
          draggable: true,
          map: mapRef.current,
        });

        setCoordinates(rectangleCoords);
        setPolygon(poly);
        setIsDrawing(false);
        rectangle.setMap(null);
        drawingManager.setDrawingMode(null);

        // Atualizar coordenadas quando o polígono for editado
        google.maps.event.addListener(poly.getPath(), 'set_at', () => {
          updateCoordinatesFromPolygon(poly);
        });
        google.maps.event.addListener(poly.getPath(), 'insert_at', () => {
          updateCoordinatesFromPolygon(poly);
        });
      }
    });

    return () => {
      if (drawingManagerRef.current) {
        google.maps.event.clearInstanceListeners(drawingManagerRef.current);
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
    };
  }, [mapRef.current, isLoaded, isDrawing]);

  // Calcular centro do mapa baseado na quadra (prioritário) ou no loteamento
  const getCenter = () => {
    // Prioridade 1: Centro da área da quadra (mais específico)
    if (blockBoundary && blockBoundary.length > 0) {
      const latSum = blockBoundary.reduce((sum, coord) => sum + coord.lat, 0);
      const lngSum = blockBoundary.reduce((sum, coord) => sum + coord.lng, 0);
      return {
        lat: latSum / blockBoundary.length,
        lng: lngSum / blockBoundary.length,
      };
    }
    // Prioridade 2: Centro da área do loteamento
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

  // Função para calcular o centro do polígono
  const getPolygonCenter = useCallback((coords: GeoCoordinate[]) => {
    if (coords.length === 0) return null;
    const latSum = coords.reduce((sum, coord) => sum + coord.lat, 0);
    const lngSum = coords.reduce((sum, coord) => sum + coord.lng, 0);
    return {
      lat: latSum / coords.length,
      lng: lngSum / coords.length,
    };
  }, []);

  // Função para rotacionar um ponto em torno de um centro
  const rotatePoint = useCallback((point: GeoCoordinate, center: GeoCoordinate, angle: number) => {
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point.lat - center.lat;
    const dy = point.lng - center.lng;
    return {
      lat: center.lat + (dx * cos - dy * sin),
      lng: center.lng + (dx * sin + dy * cos),
    };
  }, []);

  // Função para rotacionar o polígono
  const handleRotatePolygon = useCallback((angle: number) => {
    if (coordinates.length === 0) return;
    const center = getPolygonCenter(coordinates);
    if (!center) return;
    const rotated = coordinates.map(point => rotatePoint(point, center, angle));
    setCoordinates(rotated);
    
    // Se há um polígono renderizado, atualizar suas coordenadas
    if (polygon) {
      polygon.setPath(rotated);
    }
  }, [coordinates, polygon, getPolygonCenter, rotatePoint]);

  const handleSave = async () => {
    if (coordinates.length < 3) {
      alert('⚠️ Você precisa desenhar um polígono com pelo menos 3 pontos!');
      return;
    }

    // Validar se está dentro da área da quadra (quando fornecida)
    const referenceBoundary = blockBoundary || mapBoundary;
    if (referenceBoundary && referenceBoundary.length > 0) {
      const isInside = coordinates.every(point => {
        return isPointInPolygon(point, referenceBoundary);
      });

      if (!isInside) {
        const boundaryType = blockBoundary ? 'quadra' : 'loteamento';
        alert(`❌ A área do lote deve estar completamente dentro da área da ${boundaryType}. Por favor, desenhe novamente.`);
        return;
      }
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
              onClick={() => handleRotatePolygon(-15)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              title="Rotacionar -15°"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
              ↶ 15°
            </button>
            <button
              onClick={() => handleRotatePolygon(15)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              title="Rotacionar +15°"
            >
              ↷ 15°
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
            </button>
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
            onLoad={(map) => {
              mapRef.current = map;
              // Ajustar zoom automaticamente para enquadrar a área de referência
              const referenceBoundary = blockBoundary || mapBoundary;
              if (referenceBoundary && referenceBoundary.length > 0) {
                const bounds = new google.maps.LatLngBounds();
                referenceBoundary.forEach(coord => {
                  bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
                });
                map.fitBounds(bounds);
              }
            }}
            options={{
              mapTypeId: 'satellite',
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
            }}
          >
            {/* Mostrar área da quadra (prioridade) ou do loteamento */}
            {blockBoundary && blockBoundary.length > 0 ? (
              <Polygon
                paths={blockBoundary}
                options={{
                  fillColor: '#9C27B0',
                  fillOpacity: 0.15,
                  strokeColor: '#7B1FA2',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  clickable: false,
                }}
              />
            ) : mapBoundary && mapBoundary.length > 0 && (
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

            {/* DrawingManager criado manualmente via useEffect */}

            {/* Mostrar polígono existente do lote */}
            {!isDrawing && coordinates.length > 0 && !polygon && (
              <Polygon
                paths={coordinates}
                options={{
                  fillColor: '#4CAF50',
                  fillOpacity: 0.4,
                  strokeColor: '#2E7D32',
                  strokeWeight: 2,
                  editable: true,
                  draggable: true,
                }}
                onLoad={(poly) => {
                  setPolygon(poly);
                  // Atualizar coordenadas quando o polígono for editado
                  google.maps.event.addListener(poly.getPath(), 'set_at', () => {
                    updateCoordinatesFromPolygon(poly);
                  });
                  google.maps.event.addListener(poly.getPath(), 'insert_at', () => {
                    updateCoordinatesFromPolygon(poly);
                  });
                }}
              />
            )}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}
