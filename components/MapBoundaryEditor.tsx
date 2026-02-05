'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, useLoadScript, DrawingManager, Polygon, Marker } from '@react-google-maps/api';
import { GeoCoordinate } from '@/types';
import { useCustomAlert } from '@/hooks/useCustomAlert';

interface MapBoundaryEditorProps {
  initialAddress?: string;
  initialBoundary?: GeoCoordinate[];
  referenceBoundary?: GeoCoordinate[]; // Área de referência principal (ex: área do loteamento para quadras)
  existingAreas?: Array<{ id: string; name: string; coordinates: GeoCoordinate[] }>; // Áreas existentes para mostrar como referência (ex: outras quadras)
  allowAddressChange?: boolean; // Se permite alterar o endereço (false para quadras e lotes)
  onSave: (coordinates: GeoCoordinate[], address: string) => void;
  onCancel: () => void;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const libraries: ("drawing" | "places")[] = ["drawing", "places"];

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const defaultCenter = {
  lat: -6.0649,
  lng: -50.0389,
};

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

export default function MapBoundaryEditor({
  initialAddress = '',
  initialBoundary = [],
  referenceBoundary,
  existingAreas = [],
  allowAddressChange = true,
  onSave,
  onCancel,
}: MapBoundaryEditorProps) {
  const customAlert = useCustomAlert();
  const [currentStep, setCurrentStep] = useState<'address' | 'draw'>(initialAddress ? 'draw' : 'address');
  const [searchAddress, setSearchAddress] = useState(initialAddress);
  const [center, setCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(17);
  const [boundary, setBoundary] = useState<GeoCoordinate[]>(initialBoundary);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showReferenceAreas, setShowReferenceAreas] = useState(true); // Controla visibilidade das áreas de referência
  const [isRotatingMode, setIsRotatingMode] = useState(false);
  const [isDraggingRotation, setIsDraggingRotation] = useState(false);
  const [currentRotationAngle, setCurrentRotationAngle] = useState(0);
  const [showSnapGuides, setShowSnapGuides] = useState(false);
  const [snapAngle, setSnapAngle] = useState<number | null>(null);
  const [lineDistances, setLineDistances] = useState<number[]>([]);
  const [cursorDistance, setCursorDistance] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState<GeoCoordinate | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<GeoCoordinate[]>([]);
  const rotationStartPoint = useRef<GeoCoordinate | null>(null);
  const originalBoundary = useRef<GeoCoordinate[]>([]);
  const draggedMarkerIndex = useRef<number>(-1);
  const distanceLabelRef = useRef<google.maps.Marker | null>(null);
  const tempLineRef = useRef<google.maps.Polyline | null>(null);
  
  // useLoadScript para evitar conflitos
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries as any,
  });
  
  // Cleanup ref para evitar memory leaks
  const cleanupRef = useRef<boolean>(false);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

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
    if (boundary.length < 2 || newDistance <= 0) return;

    const startIndex = lineIndex;
    const endIndex = (lineIndex + 1) % boundary.length;

    const startPoint = boundary[startIndex];
    const endPoint = boundary[endIndex];

    // Calcular o bearing (direção) da linha original
    const bearing = calculateBearing(startPoint, endPoint);

    // Calcular o novo ponto final mantendo a mesma direção
    const newEndPoint = calculateNewPoint(startPoint, bearing, newDistance);

    // Criar novo array de coordenadas com o ponto ajustado
    const newBoundary = [...boundary];
    newBoundary[endIndex] = newEndPoint;

    setBoundary(newBoundary);

    // Se há um polígono renderizado, atualizar suas coordenadas
    if (polygonRef.current) {
      polygonRef.current.setPath(newBoundary);
    }
  }, [boundary, calculateBearing, calculateNewPoint]);

  // Atualizar distâncias quando boundary mudar
  useEffect(() => {
    updateLineDistances(boundary);
  }, [boundary, updateLineDistances]);

  // Listener para o movimento do mouse durante o desenho
  useEffect(() => {
    if (!mapRef.current || !isLoaded || boundary.length > 0) {
      // Limpar label e linha temporária quando não está desenhando ou já tem polígono
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

    // Listener para cliques (adicionar pontos) - captura durante o desenho manual
    const clickListener = google.maps.event.addListener(
      mapRef.current,
      'click',
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng || boundary.length > 0) return;

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
  }, [boundary.length, isLoaded, calculateDistance]);

  // Calcular centro baseado no boundary inicial ou na área de referência (usando useMemo para evitar loops)
  const calculatedCenter = useMemo(() => {
    if (initialBoundary && initialBoundary.length > 0) {
      // Prioridade 1: Centro do boundary inicial (quando está editando uma área existente)
      const latSum = initialBoundary.reduce((sum, coord) => sum + coord.lat, 0);
      const lngSum = initialBoundary.reduce((sum, coord) => sum + coord.lng, 0);
      return {
        lat: latSum / initialBoundary.length,
        lng: lngSum / initialBoundary.length,
      };
    } else if (referenceBoundary && referenceBoundary.length > 0) {
      // Prioridade 2: Centro da área de referência (quando está criando uma nova área dentro de outra)
      const latSum = referenceBoundary.reduce((sum, coord) => sum + coord.lat, 0);
      const lngSum = referenceBoundary.reduce((sum, coord) => sum + coord.lng, 0);
      return {
        lat: latSum / referenceBoundary.length,
        lng: lngSum / referenceBoundary.length,
      };
    }
    return defaultCenter;
  }, [initialBoundary?.length, referenceBoundary?.length]);

  // Atualizar centro apenas quando o cálculo mudar
  useEffect(() => {
    setCenter(calculatedCenter);
  }, [calculatedCenter]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      cleanupRef.current = true;
      // Limpar polígono
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
      // Limpar DrawingManager
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
      // Limpar referências
      mapRef.current = null;
      geocoderRef.current = null;
    };
  }, []);

  // Criar DrawingManager manualmente para evitar duplicação
  useEffect(() => {
    if (!mapRef.current || !isLoaded || boundary.length > 0 || drawingManagerRef.current) {
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
        fillOpacity: 0.3,
        strokeColor: '#4CAF50',
        strokeOpacity: 1,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
      rectangleOptions: {
        fillColor: '#4CAF50',
        fillOpacity: 0.3,
        strokeColor: '#4CAF50',
        strokeOpacity: 1,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });

    drawingManager.setMap(mapRef.current);
    drawingManagerRef.current = drawingManager;

    // Listener para polígono completo
    google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      const coordinates: GeoCoordinate[] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coordinates.push({ lat: point.lat(), lng: point.lng() });
      }
      setBoundary(coordinates);
      polygon.setMap(null);
      drawingManager.setDrawingMode(null);
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
        setBoundary(rectangleCoords);
        rectangle.setMap(null);
        drawingManager.setDrawingMode(null);
      }
    });

    return () => {
      if (drawingManagerRef.current) {
        google.maps.event.clearInstanceListeners(drawingManagerRef.current);
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
    };
  }, [mapRef.current, isLoaded, boundary.length]);

  const handleSearchAddress = useCallback(async () => {
    if (!searchAddress.trim()) {
      customAlert.error('Por favor, digite um endereço para buscar.');
      return;
    }

    // Verificar se o Google Maps está carregado
    if (!isLoaded) {
      customAlert.info('Aguarde o carregamento do Google Maps...');
      return;
    }

    setIsSearching(true);

    try {
      // Inicializar geocoder se necessário
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }

      // Fazer busca com geocoder
      geocoderRef.current.geocode(
        { address: searchAddress },
        (results, status) => {
          setIsSearching(false);

          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            const newCenter = {
              lat: location.lat(),
              lng: location.lng(),
            };

            setCenter(newCenter);
            setSearchAddress(results[0].formatted_address);
            setCurrentStep('draw');

            if (mapRef.current) {
              mapRef.current.panTo(newCenter);
              mapRef.current.setZoom(17);
            }
          } else {
            customAlert.warning('Endereço não encontrado. Tente outro termo de busca.');
          }
        }
      );
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      customAlert.error('Erro ao buscar endereço. Tente novamente.');
      setIsSearching(false);
    }
  }, [searchAddress, isLoaded]);

  const handlePolygonComplete = useCallback((polygon: google.maps.Polygon) => {
    const path = polygon.getPath();
    const coordinates: GeoCoordinate[] = [];

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coordinates.push({
        lat: point.lat(),
        lng: point.lng(),
      });
    }

    setBoundary(coordinates);

    // Remove o polígono antigo se existir
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }

    // Guarda referência do novo polígono
    polygonRef.current = polygon;
  }, []);

  const handleClearPolygon = useCallback(() => {
    setBoundary([]);
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
  }, []);

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
    if (boundary.length === 0) return;
    const center = getPolygonCenter(boundary);
    if (!center) return;
    const rotated = boundary.map(point => rotatePoint(point, center, angle));
    setBoundary(rotated);
  }, [boundary, getPolygonCenter, rotatePoint]);

  // Função para calcular ângulo entre dois pontos
  const calculateAngle = useCallback((center: GeoCoordinate, point: GeoCoordinate) => {
    const dx = point.lng - center.lng;
    const dy = point.lat - center.lat;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }, []);

  // Função para normalizar ângulo entre 0 e 360
  const normalizeAngle = (angle: number): number => {
    let normalized = angle % 360;
    if (normalized < 0) normalized += 360;
    return normalized;
  };

  // Função para encontrar o ângulo snap mais próximo (0°, 90°, 180°, 270°)
  const findSnapAngle = (angle: number, threshold: number = 5): number | null => {
    const normalized = normalizeAngle(angle);
    const snapAngles = [0, 90, 180, 270];
    
    for (const snapAngle of snapAngles) {
      const diff = Math.abs(normalized - snapAngle);
      if (diff <= threshold || diff >= (360 - threshold)) {
        return snapAngle;
      }
    }
    return null;
  };

  // Ativar modo de rotação
  const toggleRotationMode = useCallback(() => {
    if (!isRotatingMode && boundary.length > 0) {
      originalBoundary.current = [...boundary];
    }
    setIsRotatingMode(!isRotatingMode);
  }, [isRotatingMode, boundary]);

  // Aplicar rotação ao arrastar
  const handleRotationDrag = useCallback((currentPoint: GeoCoordinate) => {
    if (!isDraggingRotation || originalBoundary.current.length === 0 || !rotationStartPoint.current) return;
    
    const center = getPolygonCenter(originalBoundary.current);
    if (!center) return;

    const startAngle = calculateAngle(center, rotationStartPoint.current);
    const currentAngle = calculateAngle(center, currentPoint);
    let angleDiff = startAngle - currentAngle;

    // Detectar snap angle
    const snapResult = findSnapAngle(angleDiff, 5);
    
    if (snapResult !== null) {
      // Aplicar snap
      angleDiff = snapResult;
      setShowSnapGuides(true);
      setSnapAngle(snapResult);
    } else {
      setShowSnapGuides(false);
      setSnapAngle(null);
    }

    setCurrentRotationAngle(normalizeAngle(angleDiff));

    const rotated = originalBoundary.current.map(p => rotatePoint(p, center, angleDiff));
    setBoundary(rotated);
  }, [isDraggingRotation, getPolygonCenter, calculateAngle, rotatePoint]);

  // Adicionar listeners de mouse para rotação
  useEffect(() => {
    if (!mapRef.current || !isDraggingRotation) return;

    const handleMouseMove = (e: google.maps.MapMouseEvent) => {
      if (e.latLng && isDraggingRotation) {
        handleRotationDrag({
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        });
      }
    };

    const listener = mapRef.current.addListener('mousemove', handleMouseMove);

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [isDraggingRotation, handleRotationDrag]);

  // Listener separado para mouseup (finalizar rotação) - global para capturar em qualquer lugar
  useEffect(() => {
    if (!isDraggingRotation) return;

    const handleMouseUp = () => {
      setIsDraggingRotation(false);
      rotationStartPoint.current = null;
      draggedMarkerIndex.current = -1;
      setShowSnapGuides(false);
      setSnapAngle(null);
    };

    // Adicionar listener no document para capturar mouseup em qualquer lugar
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingRotation]);

  const handleSave = useCallback(async () => {
    if (boundary.length < 3) {
      customAlert.error('Desenhe um polígono com pelo menos 3 pontos para delimitar a área.');
      return;
    }

    if (!searchAddress.trim()) {
      customAlert.error('Informe o endereço do loteamento.');
      return;
    }

    // Validação removida - permitir que lotes ultrapassem a delimitação da quadra

    setIsSaving(true);
    try {
      await onSave(boundary, searchAddress);
    } finally {
      setIsSaving(false);
    }
  }, [boundary, searchAddress, onSave]);

  const handleClearAndSave = useCallback(async () => {
    if (!searchAddress.trim()) {
      customAlert.error('Informe o endereço mesmo ao salvar sem coordenadas.');
      return;
    }

    if (!await customAlert.confirm('Tem certeza que deseja limpar a área marcada e salvar sem coordenadas?')) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave([], searchAddress);
      setBoundary([]);
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    } finally {
      setIsSaving(false);
    }
  }, [searchAddress, onSave]);

  const polygonOptions = {
    fillColor: '#4CAF50',
    fillOpacity: 0.3,
    strokeColor: '#4CAF50',
    strokeOpacity: 1,
    strokeWeight: 2,
    editable: true,
    draggable: true,
  };

  const drawingManagerOptions = useMemo(() => {
    if (typeof window !== 'undefined' && window.google) {
      return {
        drawingControl: true,
        drawingControlOptions: {
          position: window.google.maps.ControlPosition.TOP_CENTER,
          drawingModes: [
            window.google.maps.drawing.OverlayType.POLYGON,
            window.google.maps.drawing.OverlayType.RECTANGLE,
          ],
        },
        drawingMode: null,
        polygonOptions,
        rectangleOptions: polygonOptions,
      };
    }
    return null;
  }, [isLoaded]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-8 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-red-700 dark:text-red-300 font-semibold text-lg mb-2">
          Google Maps API Key não configurada
        </p>
        <p className="text-red-600 dark:text-red-400 text-sm">
          Configure a chave da API no arquivo .env.local
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-8 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-red-700 dark:text-red-300 font-semibold text-lg mb-2">
          Erro ao carregar Google Maps
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-[var(--surface)] rounded-xl p-8 text-center">
        <svg className="animate-spin h-12 w-12 mx-auto mb-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-[var(--foreground)] font-semibold">
          Carregando Google Maps...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Etapa 1: Buscar Endereço */}
      {currentStep === 'address' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[var(--foreground)] text-sm font-semibold mb-2">
                Endereço do Loteamento
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && isLoaded && handleSearchAddress()}
                  placeholder="Digite o endereço (ex: Rua Principal, Cidade - Estado)"
                  className="flex-1 px-4 py-3 bg-[var(--surface)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!isLoaded}
                />
                <button
                  onClick={handleSearchAddress}
                  disabled={!isLoaded || isSearching || !searchAddress.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSearching ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Buscando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {isLoaded ? 'Buscar' : 'Carregando...'}
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-[var(--foreground)]/60 mt-2">
              💡 Digite o endereço completo para melhor precisão
            </p>
          </div>
        </div>
      )}

      {/* Etapa 2: Desenhar Polígono */}
      {currentStep === 'draw' && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold mb-1">Como desenhar a área:</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Clique no ícone de polígono no topo do mapa</li>
                  <li>Clique nos pontos para desenhar o perímetro do loteamento</li>
                  <li>Clique no primeiro ponto novamente para fechar o polígono</li>
                  <li>Você pode arrastar os pontos para ajustar depois</li>
                </ol>
                
                {(referenceBoundary || existingAreas.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                    <p className="font-semibold mb-2">Legenda das áreas:</p>
                    <div className="space-y-1.5">
                      {referenceBoundary && (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2" style={{ borderColor: '#2196F3', backgroundColor: 'rgba(33, 150, 243, 0.1)' }}></div>
                          <span>Área do loteamento</span>
                        </div>
                      )}
                      {existingAreas.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2" style={{ borderColor: '#FF8C00', backgroundColor: 'rgba(255, 165, 0, 0.15)' }}></div>
                          <span>Outras quadras já cadastradas ({existingAreas.length})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2" style={{ borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.3)' }}></div>
                        <span>Sua área (nova ou editando)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[var(--foreground)] font-semibold">Endereço: {searchAddress}</p>
              {boundary.length > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400">✓ Área delimitada com {boundary.length} pontos</p>
              )}
              {isRotatingMode && isDraggingRotation && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Ângulo: {Math.round(currentRotationAngle)}°
                  </p>
                  {showSnapGuides && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-semibold">
                      SNAP {snapAngle}°
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {(referenceBoundary || existingAreas.length > 0) && (
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
              {allowAddressChange && (
                <button
                  onClick={() => setCurrentStep('address')}
                  className="px-4 py-2 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--foreground)]/5 transition-colors text-sm cursor-pointer"
                >
                  Alterar Endereço
                </button>
              )}
              {boundary.length > 0 && (
                <>
                  <button
                    onClick={toggleRotationMode}
                    className={`px-4 py-2 border rounded-lg transition-colors text-sm flex items-center gap-2 cursor-pointer ${
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
                  
                  {boundary.length > 0 && (
                    <button
                      onClick={handleClearPolygon}
                      className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm cursor-pointer"
                    >
                      Limpar Área
                    </button>
                  )}
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
                    <li>Clique em qualquer ponto da área e arraste para rotacionar</li>
                    <li>Linhas verdes aparecem quando próximo a 0°, 90°, 180° ou 270° (snap automático)</li>
                    <li>Use os botões acima para rotações rápidas (90°, 45°, etc)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Metragem das Linhas */}
          {boundary.length >= 2 && lineDistances.length > 0 && (
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
                      Linha {index + 1} → {index + 2 > boundary.length ? '1' : index + 2}
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

          <div className="rounded-xl overflow-hidden border-2 border-[var(--border)]">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={zoom}
              onLoad={(map) => {
                mapRef.current = map;
                setMapLoaded(true);
                
                // Ajustar zoom automaticamente para enquadrar a área de referência
                if (referenceBoundary && referenceBoundary.length > 0 && !initialBoundary.length) {
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
                zoomControl: true,
                draggable: !isRotatingMode, // Desabilitar arrastar o mapa quando em modo de rotação
                gestureHandling: 'cooperative', // Requer Ctrl+scroll para zoom
              }}
            >
              {/* DrawingManager criado manualmente via useEffect */}

              {/* Renderizar área de referência principal (ex: área do loteamento) */}
              {mapLoaded && showReferenceAreas && referenceBoundary && referenceBoundary.length > 0 && (
                <Polygon
                  paths={referenceBoundary}
                  options={{
                    fillColor: '#2196F3',
                    fillOpacity: 0.1,
                    strokeColor: '#2196F3',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    clickable: false,
                    zIndex: 1,
                  }}
                />
              )}

              {/* Renderizar áreas existentes (ex: outras quadras) */}
              {mapLoaded && showReferenceAreas && existingAreas.map((area) => (
                <Polygon
                  key={area.id}
                  paths={area.coordinates}
                  options={{
                    fillColor: '#FFA500',
                    fillOpacity: 0.15,
                    strokeColor: '#FF8C00',
                    strokeOpacity: 0.7,
                    strokeWeight: 2,
                    clickable: false,
                    zIndex: 2,
                  }}
                />
              ))}

              {mapLoaded && boundary.length > 0 && (
                <>
                  {/* Linhas guia de snap quando rotacionando */}
                  {showSnapGuides && snapAngle !== null && mapRef.current && (() => {
                    const center = getPolygonCenter(boundary);
                    if (!center) return null;
                    
                    const bounds = mapRef.current.getBounds();
                    if (!bounds) return null;
                    
                    const ne = bounds.getNorthEast();
                    const sw = bounds.getSouthWest();
                    const latSpan = ne.lat() - sw.lat();
                    const lngSpan = ne.lng() - sw.lng();
                    const extension = Math.max(latSpan, lngSpan) * 0.5;
                    
                    // Calcular linhas baseadas no ângulo snap
                    const lines: GeoCoordinate[][] = [];
                    
                    if (snapAngle === 0 || snapAngle === 180) {
                      // Linha horizontal
                      lines.push([
                        { lat: center.lat, lng: center.lng - extension },
                        { lat: center.lat, lng: center.lng + extension }
                      ]);
                    }
                    
                    if (snapAngle === 90 || snapAngle === 270) {
                      // Linha vertical
                      lines.push([
                        { lat: center.lat - extension, lng: center.lng },
                        { lat: center.lat + extension, lng: center.lng }
                      ]);
                    }
                    
                    return lines.map((line, idx) => (
                      <Polygon
                        key={`snap-guide-${idx}`}
                        paths={line}
                        options={{
                          strokeColor: '#00FF00',
                          strokeOpacity: 0.8,
                          strokeWeight: 2,
                          fillColor: 'transparent',
                          clickable: false,
                          zIndex: 999,
                        }}
                      />
                    ));
                  })()}
                  
                  <Polygon
                    paths={boundary}
                    options={{
                      ...polygonOptions,
                      editable: !isRotatingMode,
                      draggable: !isRotatingMode,
                    }}
                    onMouseUp={() => {
                      if (!isRotatingMode && polygonRef.current) {
                        const path = polygonRef.current.getPath();
                        const newCoordinates: GeoCoordinate[] = [];
                        for (let i = 0; i < path.getLength(); i++) {
                          const point = path.getAt(i);
                          newCoordinates.push({
                            lat: point.lat(),
                            lng: point.lng(),
                          });
                        }
                        setBoundary(newCoordinates);
                      }
                    }}
                    onDragEnd={() => {
                      if (!isRotatingMode && polygonRef.current) {
                        const path = polygonRef.current.getPath();
                        const newCoordinates: GeoCoordinate[] = [];
                        for (let i = 0; i < path.getLength(); i++) {
                          const point = path.getAt(i);
                          newCoordinates.push({
                            lat: point.lat(),
                            lng: point.lng(),
                          });
                        }
                        setBoundary(newCoordinates);
                      }
                    }}
                    onLoad={(poly) => {
                      polygonRef.current = poly;
                    }}
                  />
                  
                  {/* Marcadores de rotação nos cantos */}
                  {isRotatingMode && boundary.map((point, index) => (
                    <Marker
                      key={`rotation-marker-${index}`}
                      position={point}
                      draggable={false}
                      onMouseDown={() => {
                        if (!isDraggingRotation) {
                          setIsDraggingRotation(true);
                          originalBoundary.current = [...boundary];
                          rotationStartPoint.current = { ...boundary[index] };
                          draggedMarkerIndex.current = index;
                        }
                      }}
                      icon={{
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: '#9333EA',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                      }}
                      options={{
                        cursor: 'grab'
                      }}
                    />
                  ))}
                </>
              )}
            </GoogleMap>
          </div>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-5 py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={boundary.length < 3 || isSaving}
          className="flex-1 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSaving ? (
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
              Salvar Área
            </>
          )}
        </button>
      </div>
      </div>
  );
}
