'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, useLoadScript, DrawingManager, Polygon } from '@react-google-maps/api';
import { GeoCoordinate } from '@/types';

interface MapBoundaryEditorProps {
  initialAddress?: string;
  initialBoundary?: GeoCoordinate[];
  referenceBoundary?: GeoCoordinate[]; // Área de referência que deve conter o polígono (ex: área do loteamento para quadras)
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
  onSave,
  onCancel,
}: MapBoundaryEditorProps) {
  const [currentStep, setCurrentStep] = useState<'address' | 'draw'>(initialAddress ? 'draw' : 'address');
  const [searchAddress, setSearchAddress] = useState(initialAddress);
  const [center, setCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(17);
  const [boundary, setBoundary] = useState<GeoCoordinate[]>(initialBoundary);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // useLoadScript para evitar conflitos
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries as any,
  });
  
  // Cleanup ref para evitar memory leaks
  const cleanupRef = useRef<boolean>(false);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

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
      // Limpar referências
      mapRef.current = null;
      geocoderRef.current = null;
    };
  }, []);

  const handleSearchAddress = useCallback(async () => {
    if (!searchAddress.trim()) {
      alert('Por favor, digite um endereço para buscar.');
      return;
    }

    // Verificar se o Google Maps está carregado
    if (!isLoaded) {
      alert('Aguarde o carregamento do Google Maps...');
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
            alert('Endereço não encontrado. Tente outro termo de busca.');
          }
        }
      );
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      alert('Erro ao buscar endereço. Tente novamente.');
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

  const handleSave = useCallback(async () => {
    if (boundary.length < 3) {
      alert('❌ Desenhe um polígono com pelo menos 3 pontos para delimitar a área.');
      return;
    }

    if (!searchAddress.trim()) {
      alert('❌ Informe o endereço do loteamento.');
      return;
    }

    // Validar se está dentro da área de referência (quando fornecida)
    if (referenceBoundary && referenceBoundary.length > 0) {
      const isInside = boundary.every(point => {
        return isPointInPolygon(point, referenceBoundary);
      });

      if (!isInside) {
        alert('❌ A área da quadra deve estar completamente dentro da área do loteamento. Por favor, desenhe novamente.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave(boundary, searchAddress);
    } finally {
      setIsSaving(false);
    }
  }, [boundary, searchAddress, referenceBoundary, onSave]);

  const polygonOptions = {
    fillColor: '#4CAF50',
    fillOpacity: 0.3,
    strokeColor: '#4CAF50',
    strokeOpacity: 1,
    strokeWeight: 2,
    editable: true,
    draggable: true,
  };

  const getDrawingManagerOptions = useCallback(() => {
    if (typeof window !== 'undefined' && window.google) {
      return {
        drawingControl: true,
        drawingControlOptions: {
          position: window.google.maps.ControlPosition.TOP_CENTER,
          drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
        },
        polygonOptions,
      };
    }
    return null;
  }, []);

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
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
              <div>
                <p className="text-blue-900 dark:text-blue-100 font-semibold text-sm mb-1">Como desenhar a área:</p>
                <ol className="text-blue-800 dark:text-blue-200 text-xs space-y-1 list-decimal list-inside">
                  <li>Clique no ícone de polígono no topo do mapa</li>
                  <li>Clique nos pontos para desenhar o perímetro do loteamento</li>
                  <li>Clique no primeiro ponto novamente para fechar o polígono</li>
                  <li>Você pode arrastar os pontos para ajustar depois</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[var(--foreground)] font-semibold">Endereço: {searchAddress}</p>
              {boundary.length > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400">✓ Área delimitada com {boundary.length} pontos</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentStep('address')}
                className="px-4 py-2 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--foreground)]/5 transition-colors text-sm"
              >
                Alterar Endereço
              </button>
              {boundary.length > 0 && (
                <button
                  onClick={handleClearPolygon}
                  className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm"
                >
                  Limpar Área
                </button>
              )}
            </div>
          </div>

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
              }}
            >
              {mapLoaded && boundary.length === 0 && (
                <DrawingManager
                  onPolygonComplete={handlePolygonComplete}
                  options={getDrawingManagerOptions() || undefined}
                />
              )}

              {/* Renderizar área de referência (ex: área do loteamento) */}
              {mapLoaded && referenceBoundary && referenceBoundary.length > 0 && (
                <Polygon
                  paths={referenceBoundary}
                  options={{
                    fillColor: '#2196F3',
                    fillOpacity: 0.1,
                    strokeColor: '#2196F3',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    clickable: false,
                  }}
                />
              )}

              {mapLoaded && boundary.length > 0 && (
                <Polygon
                  paths={boundary}
                  options={polygonOptions}
                  onMouseUp={() => {
                    if (polygonRef.current) {
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
                />
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
          className="flex-1 px-5 py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={boundary.length < 3 || isSaving}
          className="flex-1 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
