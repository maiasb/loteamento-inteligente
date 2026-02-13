'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { GeoCoordinate } from '@/types';
import { getPolygonCenter, rotatePoint, angleTo } from '@/utils/geoCalculations';

interface UseDragRotationOptions {
  /** Referência do mapa Google Maps */
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  /** Referência do polígono (google.maps.Polygon ou null) */
  polygonRef: React.MutableRefObject<google.maps.Polygon | null> | google.maps.Polygon | null;
  /** Coordenadas atuais do polígono */
  coordinates: GeoCoordinate[];
  /** Ref com as coordenadas atuais (para evitar stale closures) */
  coordinatesRef: React.MutableRefObject<GeoCoordinate[]>;
  /** Callback para atualizar coordenadas */
  setCoordinates: (coords: GeoCoordinate[]) => void;
  /** Se true, desabilita a rotação (ex: durante desenho) */
  disabled?: boolean;
}

interface UseDragRotationReturn {
  /** Se está arrastando para rotacionar agora. */
  isDraggingRotation: boolean;
  /** Ângulo acumulado de todas as rotações. */
  currentRotationAngle: number;
  /** Ângulo do drag atual (null quando não arrastando). */
  dragRotationAngle: number | null;
  /** Ref do centro de rotação (para OverlayView). */
  rotationCenterRef: React.MutableRefObject<GeoCoordinate | null>;
  /** Rotaciona o polígono por um ângulo (graus). */
  handleRotatePolygon: (angle: number) => void;
  /** Reseta o ângulo acumulado. */
  resetRotationAngle: () => void;
  /** Define o ângulo de rotação acumulado manualmente. */
  setCurrentRotationAngle: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Hook que encapsula toda a lógica de rotação de polígonos:
 * - Rotação por ângulo programático (handleRotatePolygon)
 * - Alt+drag para rotacionar arrastando no mapa
 * - Tracking do ângulo acumulado
 */
export function useDragRotation({
  mapRef,
  polygonRef,
  coordinates,
  coordinatesRef,
  setCoordinates,
  disabled = false,
}: UseDragRotationOptions): UseDragRotationReturn {
  const [isDraggingRotation, setIsDraggingRotation] = useState(false);
  const [currentRotationAngle, setCurrentRotationAngle] = useState(0);
  const [dragRotationAngle, setDragRotationAngle] = useState<number | null>(null);

  const rotationStartAngleRef = useRef<number>(0);
  const isDraggingRotationRef = useRef(false);
  const rotationBaseCoords = useRef<GeoCoordinate[]>([]);
  const rotationCenterRef = useRef<GeoCoordinate | null>(null);

  // Resolve polygon ref: aceita tanto MutableRefObject quanto instância direta
  const getPolygon = useCallback((): google.maps.Polygon | null => {
    if (!polygonRef) return null;
    if ('current' in polygonRef) return polygonRef.current;
    return polygonRef;
  }, [polygonRef]);

  // Rotação programática (usa ref para evitar stale closure)
  const handleRotatePolygon = useCallback((angle: number) => {
    const currentCoords = coordinatesRef.current;
    if (currentCoords.length === 0) return;
    const center = getPolygonCenter(currentCoords);
    if (!center) return;
    const rotated = currentCoords.map(point => rotatePoint(point, center, angle));
    setCoordinates(rotated);
    coordinatesRef.current = rotated;
    setCurrentRotationAngle(prev => {
      const next = (prev + angle) % 360;
      return next < 0 ? next + 360 : next;
    });
  }, [coordinatesRef, setCoordinates]);

  const resetRotationAngle = useCallback(() => {
    setCurrentRotationAngle(0);
  }, []);

  // Alt+drag rotation effect
  useEffect(() => {
    const poly = getPolygon();
    if (!poly || !mapRef.current || disabled || coordinates.length === 0) return;

    const map = mapRef.current;

    const onMouseDown = (e: google.maps.PolyMouseEvent) => {
      const domEvent = e.domEvent as MouseEvent;
      if (!domEvent.altKey) return;

      e.domEvent.preventDefault();
      e.domEvent.stopPropagation();

      const currentCoords = coordinatesRef.current;
      if (currentCoords.length < 3) return;

      const center = getPolygonCenter(currentCoords);
      if (!center || !e.latLng) return;

      map.setOptions({ draggable: false });
      poly.setEditable(false);
      poly.setDraggable(false);

      const startPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      rotationCenterRef.current = center;
      rotationBaseCoords.current = [...currentCoords];
      rotationStartAngleRef.current = angleTo(center, startPoint);
      isDraggingRotationRef.current = true;
      setIsDraggingRotation(true);
      setDragRotationAngle(0);
    };

    const onMouseMove = (e: google.maps.MapMouseEvent) => {
      if (!isDraggingRotationRef.current || !e.latLng) return;

      const center = rotationCenterRef.current!;
      const currentPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      const currentAngle = angleTo(center, currentPoint);
      let deltaAngle = currentAngle - rotationStartAngleRef.current;

      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;

      const rotated = rotationBaseCoords.current.map(point => rotatePoint(point, center, deltaAngle));
      setCoordinates(rotated);
      coordinatesRef.current = rotated;
      setDragRotationAngle(Math.round(deltaAngle * 10) / 10);
    };

    const onMouseUp = () => {
      if (!isDraggingRotationRef.current) return;

      isDraggingRotationRef.current = false;
      setIsDraggingRotation(false);

      const baseCoords = rotationBaseCoords.current;
      const finalCoords = coordinatesRef.current;
      if (baseCoords.length > 0 && finalCoords.length > 0 && rotationCenterRef.current) {
        const center = rotationCenterRef.current;
        const beforeAngle = angleTo(center, baseCoords[0]);
        const afterAngle = angleTo(center, finalCoords[0]);
        let appliedAngle = afterAngle - beforeAngle;
        if (appliedAngle > 180) appliedAngle -= 360;
        if (appliedAngle < -180) appliedAngle += 360;
        setCurrentRotationAngle(prev => {
          const next = (prev + appliedAngle) % 360;
          return Math.round((next < 0 ? next + 360 : next) * 10) / 10;
        });
      }

      map.setOptions({ draggable: true });
      poly.setEditable(true);
      poly.setDraggable(true);

      setDragRotationAngle(null);
      rotationCenterRef.current = null;
    };

    const mouseDownListener = google.maps.event.addListener(poly, 'mousedown', onMouseDown);
    const mouseMoveListener = google.maps.event.addListener(map, 'mousemove', onMouseMove);
    const mouseUpListener = google.maps.event.addListener(map, 'mouseup', onMouseUp);
    const docMouseUp = () => onMouseUp();
    document.addEventListener('mouseup', docMouseUp);

    return () => {
      google.maps.event.removeListener(mouseDownListener);
      google.maps.event.removeListener(mouseMoveListener);
      google.maps.event.removeListener(mouseUpListener);
      document.removeEventListener('mouseup', docMouseUp);
      if (isDraggingRotationRef.current) {
        isDraggingRotationRef.current = false;
        map.setOptions({ draggable: true });
        poly.setEditable(true);
        poly.setDraggable(true);
      }
    };
  }, [getPolygon, disabled, coordinates.length, coordinatesRef, setCoordinates, mapRef]);

  return {
    isDraggingRotation,
    currentRotationAngle,
    dragRotationAngle,
    rotationCenterRef,
    handleRotatePolygon,
    resetRotationAngle,
    setCurrentRotationAngle,
  };
}
