'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, useLoadScript, Polygon, OverlayView } from '@react-google-maps/api';
import { GeoCoordinate, Lot } from '@/types';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { getPolygonCenter } from '@/utils/geoCalculations';
import { useDragRotation } from '@/hooks/useDragRotation';
import { useDrawingCursor } from '@/hooks/useDrawingCursor';
import { usePolygonEditor } from '@/hooks/usePolygonEditor';

interface LotPolygonEditorProps {
  lot: Lot;
  mapBoundary?: GeoCoordinate[]; // Área delimitada do loteamento
  blockBoundary?: GeoCoordinate[]; // Área delimitada da quadra
  otherLotsInBlock?: Lot[]; // Outros lotes da mesma quadra
  onSave: (coordinates: GeoCoordinate[]) => Promise<void>;
  onCancel: () => void;
}

const containerStyle = {
  width: '100%',
  height: '600px',
};

const libraries: ("drawing" | "places")[] = ["drawing", "places"];

export default function LotPolygonEditor({ lot, mapBoundary, blockBoundary, otherLotsInBlock = [], onSave, onCancel }: LotPolygonEditorProps) {
  const customAlert = useCustomAlert();
  const [polygon, setPolygon] = useState<google.maps.Polygon | null>(null);
  const [coordinates, setCoordinates] = useState<GeoCoordinate[]>(lot.coordinates || []);
  const [isDrawing, setIsDrawing] = useState(!lot.coordinates || lot.coordinates.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [showReferenceAreas, setShowReferenceAreas] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const coordinatesRef = useRef<GeoCoordinate[]>(lot.coordinates || []);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const drawnOverlaysRef = useRef<google.maps.MVCObject[]>([]);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as any,
  });

  // --- Custom Hooks ---
  const { lineDistances, handleLineDistanceChange } = usePolygonEditor({
    coordinates,
    coordinatesRef,
    setCoordinates,
  });

  const {
    isDraggingRotation,
    currentRotationAngle,
    dragRotationAngle,
    rotationCenterRef,
    handleRotatePolygon,
    resetRotationAngle,
    setCurrentRotationAngle,
  } = useDragRotation({
    mapRef,
    polygonRef: polygon,
    coordinates,
    coordinatesRef,
    setCoordinates,
    disabled: isDrawing,
  });

  useDrawingCursor({
    mapRef,
    isLoaded,
    isDrawing,
  });

  // Manter coordinatesRef sincronizado com o state coordinates
  useEffect(() => {
    coordinatesRef.current = coordinates;
  }, [coordinates]);

  // Criar DrawingManager manualmente para evitar duplicação
  useEffect(() => {
    if (!mapLoaded || !isLoaded || !isDrawing || drawingManagerRef.current) {
      return;
    }

    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
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
      drawnOverlaysRef.current.push(poly);
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
      // Listeners de edição são gerenciados pelo useEffect centralizado
    });

    // Listener para retângulo completo
    google.maps.event.addListener(drawingManager, 'rectanglecomplete', (rectangle: google.maps.Rectangle) => {
      drawnOverlaysRef.current.push(rectangle);
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
        coordinatesRef.current = rectangleCoords;
        setPolygon(poly);
        drawnOverlaysRef.current.push(poly);
        setIsDrawing(false);
        rectangle.setMap(null);
        drawingManager.setDrawingMode(null);
        // Listeners de edição são gerenciados pelo useEffect centralizado
      }
    });

    return () => {
      if (drawingManagerRef.current) {
        google.maps.event.clearInstanceListeners(drawingManagerRef.current);
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
    };
  }, [mapLoaded, isLoaded, isDrawing]);

  // Calcular centro do mapa apenas uma vez (baseado na quadra ou loteamento)
  // useMemo evita recriar o objeto a cada render, o que faria o mapa pular de volta
  const center = useMemo(() => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockBoundary?.length, mapBoundary?.length]);

  const updateCoordinatesFromPolygon = useCallback((poly: google.maps.Polygon) => {
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
    coordinatesRef.current = coords;
  }, []);

  // Re-attach path listeners whenever polygon or coordinates change
  // When setPath() is called (by React <Polygon> or directly), the old MVCArray
  // and its listeners are discarded. This effect ensures listeners are always
  // attached to the current path.
  useEffect(() => {
    if (!polygon) return;

    const path = polygon.getPath();
    if (!path) return;

    const setAtListener = google.maps.event.addListener(path, 'set_at', () => {
      updateCoordinatesFromPolygon(polygon);
    });
    const insertAtListener = google.maps.event.addListener(path, 'insert_at', () => {
      updateCoordinatesFromPolygon(polygon);
    });
    const dragEndListener = google.maps.event.addListener(polygon, 'dragend', () => {
      updateCoordinatesFromPolygon(polygon);
    });

    return () => {
      google.maps.event.removeListener(setAtListener);
      google.maps.event.removeListener(insertAtListener);
      google.maps.event.removeListener(dragEndListener);
    };
  }, [polygon, coordinates, updateCoordinatesFromPolygon]);

  const handleClearDrawing = () => {
    if (polygon) {
      polygon.setMap(null);
      setPolygon(null);
    }
    // Limpar todos os overlays desenhados
    drawnOverlaysRef.current.forEach(overlay => {
      if (overlay && typeof (overlay as any).setMap === 'function') {
        (overlay as any).setMap(null);
      }
    });
    drawnOverlaysRef.current = [];
    
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setMap(null);
      drawingManagerRef.current = null;
    }
    setCoordinates([]);
    coordinatesRef.current = [];
    resetRotationAngle();
    setIsDrawing(true);
  };

  const handleSave = async () => {
    const currentCoords = coordinatesRef.current;
    if (currentCoords.length < 3) {
      customAlert.warning('Você precisa desenhar um polígono com pelo menos 3 pontos!');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(currentCoords);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAndSave = async () => {
    if (!await customAlert.confirm('Tem certeza que deseja limpar a área marcada e salvar sem coordenadas?')) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave([]);
      setCoordinates([]);
      coordinatesRef.current = [];
      if (polygon) {
        polygon.setMap(null);
        setPolygon(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Instruções */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold mb-1">📍 Como delimitar o lote:</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Localize o lote <strong>"{lot.lotNumber}"</strong> na área do mapa</li>
              <li>Clique em <strong>"Iniciar Desenho"</strong></li>
              <li>Clique nos cantos do lote para criar o polígono</li>
              <li>Clique no primeiro ponto novamente para fechar</li>
              <li>Ajuste os pontos arrastando-os se necessário</li>
              <li>Clique em <strong>"Salvar Coordenadas"</strong></li>
            </ol>
          </div>
        </div>
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

      {/* Metragem das Linhas */}
      {coordinates.length >= 2 && lineDistances.length > 0 && (
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-xl p-4">
          <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
                📏 Metragem das Linhas (Editável)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lineDistances.map((distance, index) => (
                  <div key={index} className="bg-white/50 dark:bg-black/20 rounded-lg p-3 border border-blue-500/20">
                    <p className="text-xs text-[var(--foreground)] opacity-60 mb-2">
                      Linha {index + 1} → {index + 2 > coordinates.length ? '1' : index + 2}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        key={`line-${index}-${distance.toFixed(2)}`}
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={distance.toFixed(2)}
                        onBlur={(e) => {
                          const newValue = parseFloat(e.target.value);
                          if (!isNaN(newValue) && newValue > 0) {
                            handleLineDistanceChange(index, newValue);
                          } else {
                            e.target.value = distance.toFixed(2);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const newValue = parseFloat(e.currentTarget.value);
                            if (!isNaN(newValue) && newValue > 0) {
                              handleLineDistanceChange(index, newValue);
                              e.currentTarget.blur();
                            }
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-xs font-medium text-[var(--foreground)] opacity-60">m</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-blue-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--foreground)]">Perímetro Total:</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {lineDistances.reduce((sum, d) => sum + d, 0).toFixed(2)} m
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--foreground)] opacity-60 italic">
                💡 Dica: Digite o valor desejado para ajustar o comprimento da linha mantendo sua direção
              </p>
              <p className="text-xs text-[var(--foreground)] opacity-60 italic">
                🔄 Segure <strong>Alt</strong> e arraste sobre o polígono no mapa para rotacionar livremente
              </p>
            </div>
          )}

        <div className="flex items-center justify-between mb-3">
          <div></div>
          <div className="flex gap-2">
            {(mapBoundary || blockBoundary) && (
              <button
                onClick={() => setShowReferenceAreas(!showReferenceAreas)}
                className="px-4 py-2 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--foreground)]/5 transition-colors text-sm flex items-center gap-2 cursor-pointer"
                title={showReferenceAreas ? "Ocultar áreas de referência" : "Mostrar áreas de referência"}
              >
                {showReferenceAreas ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    Ocultar Áreas
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Mostrar Áreas
                  </>
                )}
              </button>
            )}
            {coordinates.length > 0 && (
              <>
                {/* Controle de Rotação — sempre visível */}
                <div className="flex items-center gap-1 px-2 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <svg className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {[{ a: -90, l: '-90°' }, { a: -45, l: '-45°' }, { a: -1, l: '-1°' }, { a: 1, l: '+1°' }, { a: 45, l: '+45°' }, { a: 90, l: '+90°' }].map(({ a, l }) => (
                    <button
                      key={a}
                      onClick={() => handleRotatePolygon(a)}
                      className="px-1.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 rounded transition-colors cursor-pointer"
                      title={`Rotacionar ${l}`}
                    >
                      {l}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-purple-300 dark:bg-purple-600 mx-0.5" />
                  <input
                    type="number"
                    step="1"
                    placeholder="°"
                    className="w-14 px-1 py-0.5 text-xs text-center font-semibold text-purple-700 dark:text-purple-300 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    title="Digite um ângulo personalizado e pressione Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseFloat(e.currentTarget.value);
                        if (!isNaN(val) && val !== 0) {
                          handleRotatePolygon(val);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  {currentRotationAngle !== 0 && (
                    <button
                      onClick={() => {
                        // Desfazer toda a rotação acumulada
                        handleRotatePolygon(-currentRotationAngle);
                        setCurrentRotationAngle(0);
                      }}
                      className="text-[10px] font-medium text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-200 whitespace-nowrap ml-0.5 underline cursor-pointer"
                      title="Clique para desfazer toda a rotação acumulada"
                    >
                      {currentRotationAngle.toFixed(0)}° ↺
                    </button>
                  )}
                </div>

                <button
                  onClick={handleClearDrawing}
                  className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm"
                >
                  Limpar Área
                </button>
              </>
            )}
          </div>
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
              setMapLoaded(true);
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
            {showReferenceAreas && blockBoundary && blockBoundary.length > 0 ? (
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
            ) : showReferenceAreas && mapBoundary && mapBoundary.length > 0 && (
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

            {/* Mostrar outros lotes da mesma quadra */}
            {showReferenceAreas && otherLotsInBlock && otherLotsInBlock.length > 0 && otherLotsInBlock.map((otherLot) => {
              if (otherLot.id === lot.id || !otherLot.coordinates || otherLot.coordinates.length === 0) {
                return null;
              }
              
              // Cores baseadas no status do lote
              const statusColors: Record<string, { fill: string; stroke: string }> = {
                available: { fill: '#22C55E', stroke: '#16A34A' },  // Verde - Disponível
                reserved: { fill: '#F59E0B', stroke: '#D97706' },   // Amarelo - Reservado
                sold: { fill: '#EF4444', stroke: '#DC2626' },       // Vermelho - Vendido
                blocked: { fill: '#6B7280', stroke: '#4B5563' },    // Cinza - Bloqueado
              };
              
              const color = statusColors[otherLot.status] || statusColors.available;
              const lotCenter = getPolygonCenter(otherLot.coordinates);
              
              return (
                <React.Fragment key={otherLot.id}>
                  <Polygon
                    paths={otherLot.coordinates}
                    options={{
                      fillColor: color.fill,
                      fillOpacity: 0.3,
                      strokeColor: color.stroke,
                      strokeOpacity: 0.7,
                      strokeWeight: 2,
                      clickable: false,
                    }}
                  />
                  {/* Label do lote */}
                  {lotCenter && (
                    <OverlayView
                      position={lotCenter}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          transform: 'translate(-50%, -50%)',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#FFFFFF',
                          textShadow: '1px 1px 3px rgba(0,0,0,0.9)',
                          opacity: 0.85,
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
                          userSelect: 'none'
                        }}
                      >
                        {otherLot.lotNumber}
                      </div>
                    </OverlayView>
                  )}
                </React.Fragment>
              );
            })}

            {/* DrawingManager criado manualmente via useEffect */}

            {/* Mostrar polígono existente do lote */}
            {!isDrawing && coordinates.length > 0 && (
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
                }}
                onUnmount={(poly) => {
                  google.maps.event.clearInstanceListeners(poly);
                }}
              />
            )}

            {/* Indicador visual de rotação durante drag */}
            {isDraggingRotation && dragRotationAngle !== null && rotationCenterRef.current && (
              <OverlayView
                position={rotationCenterRef.current}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div
                  style={{
                    position: 'absolute',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    background: 'rgba(147, 51, 234, 0.85)',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {dragRotationAngle > 0 ? '+' : ''}{dragRotationAngle}°
                </div>
              </OverlayView>
            )}
          </GoogleMap>
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-5 py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        
        {coordinates.length > 0 && (
          <>
            <button
              onClick={handleClearAndSave}
              disabled={isSaving}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title="Excluir área demarcada do lote"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Excluindo...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Excluir Área
                </>
              )}
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving || coordinates.length < 3}
              className="flex-1 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  Salvar Área
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
