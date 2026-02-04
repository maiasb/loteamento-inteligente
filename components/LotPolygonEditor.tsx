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
  const [isDrawing, setIsDrawing] = useState(!lot.coordinates || lot.coordinates.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [lineDistances, setLineDistances] = useState<number[]>([]);
  const [cursorDistance, setCursorDistance] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState<GeoCoordinate | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<GeoCoordinate[]>([]);
  const [showReferenceAreas, setShowReferenceAreas] = useState(true);
  const [isRotatingMode, setIsRotatingMode] = useState(false);
  const [isDraggingRotation, setIsDraggingRotation] = useState(false);
  const [currentRotationAngle, setCurrentRotationAngle] = useState(0);
  const [showSnapGuides, setShowSnapGuides] = useState(false);
  const [snapAngle, setSnapAngle] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const rotationStartPoint = useRef<GeoCoordinate | null>(null);
  const originalCoordinates = useRef<GeoCoordinate[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const distanceLabelRef = useRef<google.maps.Marker | null>(null);
  const tempLineRef = useRef<google.maps.Polyline | null>(null);
  const drawnOverlaysRef = useRef<google.maps.MVCObject[]>([]);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as any,
  });

  // Função para calcular distância entre dois pontos em metros
  const calculateDistance = useCallback((point1: GeoCoordinate, point2: GeoCoordinate): number => {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distância em metros
  }, []);

  // Calcular distâncias das linhas
  const updateLineDistances = useCallback((coords: GeoCoordinate[]) => {
    if (coords.length < 2) {
      setLineDistances([]);
      return;
    }

    const distances: number[] = [];
    for (let i = 0; i < coords.length; i++) {
      const nextIndex = (i + 1) % coords.length;
      const distance = calculateDistance(coords[i], coords[nextIndex]);
      distances.push(distance);
    }
    setLineDistances(distances);
  }, [calculateDistance]);

  // Função para calcular novo ponto baseado em distância e bearing
  const calculateNewPoint = useCallback((startPoint: GeoCoordinate, bearing: number, distance: number): GeoCoordinate => {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = startPoint.lat * Math.PI / 180;
    const λ1 = startPoint.lng * Math.PI / 180;
    const brng = bearing * Math.PI / 180;

    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(distance / R) +
                        Math.cos(φ1) * Math.sin(distance / R) * Math.cos(brng));
    const λ2 = λ1 + Math.atan2(Math.sin(brng) * Math.sin(distance / R) * Math.cos(φ1),
                               Math.cos(distance / R) - Math.sin(φ1) * Math.sin(φ2));

    return {
      lat: φ2 * 180 / Math.PI,
      lng: λ2 * 180 / Math.PI,
    };
  }, []);

  // Função para calcular o bearing (ângulo) entre dois pontos
  const calculateBearing = useCallback((point1: GeoCoordinate, point2: GeoCoordinate): number => {
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return (θ * 180 / Math.PI + 360) % 360; // Normalizar para 0-360
  }, []);

  // Função para ajustar o comprimento de uma linha específica
  const handleLineDistanceChange = useCallback((lineIndex: number, newDistance: number) => {
    if (coordinates.length < 2 || newDistance <= 0) return;

    const startIndex = lineIndex;
    const endIndex = (lineIndex + 1) % coordinates.length;

    const startPoint = coordinates[startIndex];
    const endPoint = coordinates[endIndex];

    // Calcular o bearing (direção) da linha original
    const bearing = calculateBearing(startPoint, endPoint);

    // Calcular o novo ponto final mantendo a mesma direção
    const newEndPoint = calculateNewPoint(startPoint, bearing, newDistance);

    // Criar novo array de coordenadas com o ponto ajustado
    const newCoordinates = [...coordinates];
    newCoordinates[endIndex] = newEndPoint;

    setCoordinates(newCoordinates);

    // Se há um polígono renderizado, atualizar suas coordenadas
    if (polygon) {
      polygon.setPath(newCoordinates);
    }
  }, [coordinates, polygon, calculateBearing, calculateNewPoint]);

  // Atualizar distâncias quando coordenadas mudarem
  useEffect(() => {
    updateLineDistances(coordinates);
  }, [coordinates, updateLineDistances]);

  // Listener para o movimento do mouse durante o desenho
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isDrawing) {
      // Limpar label e linha temporária quando não está desenhando
      if (distanceLabelRef.current) {
        distanceLabelRef.current.setMap(null);
        distanceLabelRef.current = null;
      }
      if (tempLineRef.current) {
        tempLineRef.current.setMap(null);
        tempLineRef.current = null;
      }
      setCursorDistance(null);
      setCursorPosition(null);
      setDrawingPoints([]);
      return;
    }

    const mouseMoveListener = google.maps.event.addListener(
      mapRef.current,
      'mousemove',
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;

        const currentPos: GeoCoordinate = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        };

        setCursorPosition(currentPos);

        // Se já existem pontos desenhados, calcular distância do último ponto
        setDrawingPoints((prevPoints) => {
          if (prevPoints.length > 0) {
            const lastPoint = prevPoints[prevPoints.length - 1];
            const distance = calculateDistance(lastPoint, currentPos);
            setCursorDistance(distance);

            // Criar ou atualizar linha temporária
            if (tempLineRef.current) {
              tempLineRef.current.setPath([lastPoint, currentPos]);
            } else {
              tempLineRef.current = new google.maps.Polyline({
                path: [lastPoint, currentPos],
                strokeColor: '#FF0000',
                strokeOpacity: 0.6,
                strokeWeight: 2,
                map: mapRef.current!,
                zIndex: 1000,
              });
            }

            // Criar ou atualizar marcador com a distância
            const midPoint = {
              lat: (lastPoint.lat + currentPos.lat) / 2,
              lng: (lastPoint.lng + currentPos.lng) / 2,
            };

            if (distanceLabelRef.current) {
              distanceLabelRef.current.setPosition(midPoint);
              distanceLabelRef.current.setLabel({
                text: `${distance.toFixed(2)} m`,
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 'bold',
              });
            } else {
              distanceLabelRef.current = new google.maps.Marker({
                position: midPoint,
                map: mapRef.current!,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 0,
                },
                label: {
                  text: `${distance.toFixed(2)} m`,
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 'bold',
                },
                zIndex: 1001,
              });
            }
          }
          return prevPoints; // Retornar o mesmo array para não causar re-render
        });
      }
    );

    // Listener para cliques (adicionar pontos)
    const clickListener = google.maps.event.addListener(
      mapRef.current,
      'click',
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;

        const newPoint: GeoCoordinate = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        };

        setDrawingPoints((prev) => [...prev, newPoint]);
      }
    );

    return () => {
      google.maps.event.removeListener(mouseMoveListener);
      google.maps.event.removeListener(clickListener);
      if (distanceLabelRef.current) {
        distanceLabelRef.current.setMap(null);
        distanceLabelRef.current = null;
      }
      if (tempLineRef.current) {
        tempLineRef.current.setMap(null);
        tempLineRef.current = null;
      }
    };
  }, [isDrawing, isLoaded, calculateDistance]);

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
        setPolygon(poly);
        drawnOverlaysRef.current.push(poly);
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
  }, [mapLoaded, isLoaded, isDrawing]);

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
    updateLineDistances(coords);
  };

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
    setIsDrawing(true);
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

  // Função para alternar modo de rotação
  const toggleRotationMode = useCallback(() => {
    setIsRotatingMode(!isRotatingMode);
    if (!isRotatingMode) {
      originalCoordinates.current = [...coordinates];
    }
  }, [isRotatingMode, coordinates]);

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

    setIsSaving(true);
    try {
      await onSave(coordinates);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAndSave = async () => {
    if (!confirm('Tem certeza que deseja limpar a área marcada e salvar sem coordenadas?')) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave([]);
      setCoordinates([]);
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
            </div>
          )}

        <div className="flex items-center justify-between mb-3">
          <div></div>
          <div className="flex gap-2">
            {(mapBoundary || blockBoundary) && (
              <button
                onClick={() => setShowReferenceAreas(!showReferenceAreas)}
                className="px-4 py-2 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--foreground)]/5 transition-colors text-sm flex items-center gap-2"
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
                <button
                  onClick={toggleRotationMode}
                  className={`px-4 py-2 border rounded-lg transition-colors text-sm flex items-center gap-2 ${
                    isRotatingMode
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                  }`}
                  title="Ativar modo de rotação"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isRotatingMode ? 'Modo Rotação Ativo' : 'Rotacionar'}
                </button>
                
                {isRotatingMode && (
                  <div className="flex gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <button
                      onClick={() => handleRotatePolygon(90)}
                      className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded transition-colors"
                      title="Rotacionar 90° (Horizontal)"
                    >
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRotatePolygon(-90)}
                      className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded transition-colors"
                      title="Rotacionar -90° (Vertical)"
                    >
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRotatePolygon(45)}
                      className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded transition-colors"
                      title="Rotacionar 45°"
                    >
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRotatePolygon(-45)}
                      className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded transition-colors"
                      title="Rotacionar -45°"
                    >
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                )}
                
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

        {isRotatingMode && (
          <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-purple-700 dark:text-purple-300">
                <p className="font-semibold mb-1">Modo de Rotação Ativo</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Use os botões de rotação rápida (90°, -90°, 45°, -45°)</li>
                  <li>Ou clique no mapa e arraste para rotacionar livremente</li>
                  <li>Clique em "Modo Rotação Ativo" novamente para desativar</li>
                </ul>
              </div>
            </div>
          </div>
        )}

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
                  // Atualizar coordenadas quando o polígono for editado
                  google.maps.event.addListener(poly.getPath(), 'set_at', () => {
                    updateCoordinatesFromPolygon(poly);
                  });
                  google.maps.event.addListener(poly.getPath(), 'insert_at', () => {
                    updateCoordinatesFromPolygon(poly);
                  });
                }}
                onUnmount={(poly) => {
                  google.maps.event.clearInstanceListeners(poly);
                }}
              />
            )}
          </GoogleMap>
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-5 py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        {coordinates.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
