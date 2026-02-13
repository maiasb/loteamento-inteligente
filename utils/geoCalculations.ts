import { GeoCoordinate } from '@/types';

/**
 * Funções utilitárias de cálculos geográficos.
 * Usadas por MapBoundaryEditor, LotPolygonEditor, PublicMapViewer, useInteractiveMap.
 */

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function calculateDistance(point1: GeoCoordinate, point2: GeoCoordinate): number {
  const R = 6371e3;
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/** Bearing (ângulo de direção em graus, 0–360) entre dois pontos. */
export function calculateBearing(point1: GeoCoordinate, point2: GeoCoordinate): number {
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (θ * 180 / Math.PI + 360) % 360;
}

/** Calcula um novo ponto a partir de um ponto inicial, bearing (graus) e distância (metros). */
export function calculateNewPoint(startPoint: GeoCoordinate, bearing: number, distance: number): GeoCoordinate {
  const R = 6371e3;
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
}

/** Centro geométrico (centróide simples) de um array de coordenadas. */
export function getPolygonCenter(coords: GeoCoordinate[]): GeoCoordinate | null {
  if (coords.length === 0) return null;
  const latSum = coords.reduce((sum, coord) => sum + coord.lat, 0);
  const lngSum = coords.reduce((sum, coord) => sum + coord.lng, 0);
  return {
    lat: latSum / coords.length,
    lng: lngSum / coords.length,
  };
}

/** Rotaciona um ponto em torno de um centro por um ângulo em graus. */
export function rotatePoint(point: GeoCoordinate, center: GeoCoordinate, angle: number): GeoCoordinate {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.lat - center.lat;
  const dy = point.lng - center.lng;
  return {
    lat: center.lat + (dx * cos - dy * sin),
    lng: center.lng + (dx * sin + dy * cos),
  };
}

/** Verifica se um ponto está dentro de um polígono (ray-casting). */
export function isPointInPolygon(point: GeoCoordinate, polygon: GeoCoordinate[]): boolean {
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

/** Ângulo (em graus) de um ponto em relação a um centro (atan2). */
export function angleTo(center: GeoCoordinate, point: GeoCoordinate): number {
  return Math.atan2(point.lng - center.lng, point.lat - center.lat) * (180 / Math.PI);
}

/** Calcula as distâncias (em metros) de cada aresta de um polígono fechado. */
export function calculateLineDistances(coords: GeoCoordinate[]): number[] {
  if (coords.length < 2) return [];
  const distances: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    const nextIndex = (i + 1) % coords.length;
    distances.push(calculateDistance(coords[i], coords[nextIndex]));
  }
  return distances;
}
