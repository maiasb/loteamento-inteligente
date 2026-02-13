'use client';

import { useState, useEffect, useCallback } from 'react';
import { GeoCoordinate } from '@/types';
import { calculateLineDistances, calculateBearing, calculateNewPoint } from '@/utils/geoCalculations';

interface UsePolygonEditorOptions {
  /** Coordenadas atuais do polígono. */
  coordinates: GeoCoordinate[];
  /** Ref com as coordenadas atuais (para evitar stale closures). */
  coordinatesRef: React.MutableRefObject<GeoCoordinate[]>;
  /** Callback para atualizar coordenadas. */
  setCoordinates: (coords: GeoCoordinate[]) => void;
}

interface UsePolygonEditorReturn {
  /** Distâncias das arestas do polígono em metros. */
  lineDistances: number[];
  /** Altera o comprimento de uma aresta mantendo a direção. */
  handleLineDistanceChange: (lineIndex: number, newDistance: number) => void;
}

/**
 * Hook que gerencia as metragens das arestas de um polígono
 * e permite editar o comprimento de cada aresta individualmente.
 */
export function usePolygonEditor({
  coordinates,
  coordinatesRef,
  setCoordinates,
}: UsePolygonEditorOptions): UsePolygonEditorReturn {
  const [lineDistances, setLineDistances] = useState<number[]>([]);

  // Recalcular distâncias quando coordenadas mudam
  useEffect(() => {
    setLineDistances(calculateLineDistances(coordinates));
  }, [coordinates]);

  // Ajustar comprimento de uma aresta mantendo a direção
  const handleLineDistanceChange = useCallback((lineIndex: number, newDistance: number) => {
    const currentCoords = coordinatesRef.current;
    if (currentCoords.length < 2 || newDistance <= 0) return;

    const startIndex = lineIndex;
    const endIndex = (lineIndex + 1) % currentCoords.length;

    const startPoint = currentCoords[startIndex];
    const bearing = calculateBearing(startPoint, currentCoords[endIndex]);
    const newEndPoint = calculateNewPoint(startPoint, bearing, newDistance);

    const newCoords = [...currentCoords];
    newCoords[endIndex] = newEndPoint;

    setCoordinates(newCoords);
    coordinatesRef.current = newCoords;
  }, [coordinatesRef, setCoordinates]);

  return {
    lineDistances,
    handleLineDistanceChange,
  };
}
