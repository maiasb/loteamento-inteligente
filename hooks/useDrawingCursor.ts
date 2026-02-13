'use client';

import { useState, useRef, useEffect } from 'react';
import { GeoCoordinate } from '@/types';
import { calculateDistance } from '@/utils/geoCalculations';

interface UseDrawingCursorOptions {
  /** Referência do mapa */
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  /** Se o Google Maps está carregado */
  isLoaded: boolean;
  /** Se está no modo de desenho (true = ativo) */
  isDrawing: boolean;
}

interface UseDrawingCursorReturn {
  /** Distância do cursor ao último ponto desenhado. */
  cursorDistance: number | null;
  /** Posição atual do cursor no mapa. */
  cursorPosition: GeoCoordinate | null;
  /** Pontos já desenhados manualmente (cliques). */
  drawingPoints: GeoCoordinate[];
  /** Limpa os pontos e o estado do cursor. */
  clearDrawingState: () => void;
}

/**
 * Hook para rastreamento do cursor e distância durante o desenho de polígonos.
 * Cria uma linha temporária e um label de distância no mapa.
 */
export function useDrawingCursor({
  mapRef,
  isLoaded,
  isDrawing,
}: UseDrawingCursorOptions): UseDrawingCursorReturn {
  const [cursorDistance, setCursorDistance] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState<GeoCoordinate | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<GeoCoordinate[]>([]);

  const distanceLabelRef = useRef<google.maps.Marker | null>(null);
  const tempLineRef = useRef<google.maps.Polyline | null>(null);

  const clearDrawingState = () => {
    setCursorDistance(null);
    setCursorPosition(null);
    setDrawingPoints([]);
  };

  useEffect(() => {
    if (!mapRef.current || !isLoaded || !isDrawing) {
      // Cleanup quando não está desenhando
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

    const map = mapRef.current;

    const mouseMoveListener = google.maps.event.addListener(
      map,
      'mousemove',
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;

        const currentPos: GeoCoordinate = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        };

        setCursorPosition(currentPos);

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
                map,
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
                map,
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
          return prevPoints;
        });
      }
    );

    const clickListener = google.maps.event.addListener(
      map,
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
  }, [isDrawing, isLoaded, mapRef]);

  return {
    cursorDistance,
    cursorPosition,
    drawingPoints,
    clearDrawingState,
  };
}
