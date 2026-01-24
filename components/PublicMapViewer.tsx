'use client';

import React, { useEffect, useState } from 'react';
import { GoogleMap, useLoadScript, Polygon } from '@react-google-maps/api';
import { GeoCoordinate, Lot } from '@/types';

interface PublicMapViewerProps {
  address?: string;
  boundaryCoordinates?: GeoCoordinate[];
  lots?: Lot[];
  onLotClick?: (lot: Lot) => void;
  onBoundaryClick?: () => void; // Novo: callback para clicar na área do loteamento
  isAdminContext?: boolean; // Novo: indica se está no contexto admin
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const libraries: ("drawing" | "places")[] = ["drawing", "places"];

const mapContainerStyle = {
  width: '100%',
  height: '500px',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

export default function PublicMapViewer({ address, boundaryCoordinates, lots = [], onLotClick, onBoundaryClick, isAdminContext = false }: PublicMapViewerProps) {
  const [center, setCenter] = useState(defaultCenter);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredLotId, setHoveredLotId] = useState<string | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries as any,
  });

  // Filtrar apenas lotes que têm coordenadas definidas
  const lotsWithCoordinates = lots.filter(lot => lot.coordinates && lot.coordinates.length > 0);

  console.log('[PublicMapViewer] Debug:', {
    totalLots: lots.length,
    lotsWithCoordinates: lotsWithCoordinates.length,
    lotDetails: lots.map(l => ({ 
      id: l.id, 
      number: l.lotNumber, 
      hasCoords: !!(l.coordinates && l.coordinates.length > 0),
      coordsLength: l.coordinates?.length || 0 
    }))
  });

  useEffect(() => {
    if (boundaryCoordinates && boundaryCoordinates.length > 0) {
      // Calcular o centro do polígono
      const latSum = boundaryCoordinates.reduce((sum, coord) => sum + coord.lat, 0);
      const lngSum = boundaryCoordinates.reduce((sum, coord) => sum + coord.lng, 0);
      
      setCenter({
        lat: latSum / boundaryCoordinates.length,
        lng: lngSum / boundaryCoordinates.length,
      });
    }
  }, [boundaryCoordinates]);

  const polygonOptions = {
    fillColor: '#4CAF50',
    fillOpacity: 0.2,
    strokeColor: '#4CAF50',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    clickable: isAdminContext, // Clicável apenas no contexto admin
    zIndex: 1,
  };

  const getLotPolygonOptions = (lot: Lot, isHovered: boolean = false) => {
    // Cores baseadas no status do lote
    const colors: Record<string, { fill: string; stroke: string }> = {
      available: { fill: '#3B82F6', stroke: '#2563EB' }, // Azul
      reserved: { fill: '#F59E0B', stroke: '#D97706' },  // Amarelo/laranja
      sold: { fill: '#EF4444', stroke: '#DC2626' },      // Vermelho
      blocked: { fill: '#6B7280', stroke: '#4B5563' },   // Cinza
    };

    const color = colors[lot.status] || colors.available;

    return {
      fillColor: color.fill,
      fillOpacity: isHovered ? 0.6 : 0.45,
      strokeColor: color.stroke,
      strokeOpacity: 1,
      strokeWeight: isHovered ? 3 : 2,
      clickable: true,
      zIndex: isHovered ? 100 : 10,
      cursor: 'pointer',
    };
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-[500px] bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl flex items-center justify-center p-8">
        <div className="text-center">
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
      </div>
    );
  }

  if (!boundaryCoordinates || boundaryCoordinates.length === 0) {
    return (
      <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center p-8">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg mb-2">
            Área não configurada
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            Configure a área do loteamento para visualizar no mapa
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-[500px] bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl flex items-center justify-center p-8">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-700 dark:text-red-300 font-semibold text-lg mb-2">
            Erro ao carregar Google Maps
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center p-8">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 dark:text-gray-400 font-semibold">
            Carregando mapa...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={17}
        onLoad={() => setMapLoaded(true)}
        options={{
          mapTypeId: 'satellite',
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        {/* Polígono da área do loteamento */}
        {mapLoaded && boundaryCoordinates && boundaryCoordinates.length > 0 && (
          <Polygon
            paths={boundaryCoordinates}
            options={polygonOptions}
            onClick={() => {
              if (isAdminContext && onBoundaryClick) {
                console.log('[PublicMapViewer] Área do loteamento clicada');
                onBoundaryClick();
              }
            }}
          />
        )}

        {/* Polígonos dos lotes */}
        {mapLoaded && lotsWithCoordinates.map((lot) => (
          <Polygon
            key={lot.id}
            paths={lot.coordinates || []}
            options={getLotPolygonOptions(lot, hoveredLotId === lot.id)}
            onClick={() => {
              console.log('[PublicMapViewer] Lote clicado:', lot.lotNumber);
              onLotClick && onLotClick(lot);
            }}
            onMouseOver={() => setHoveredLotId(lot.id)}
            onMouseOut={() => setHoveredLotId(null)}
          />
        ))}
      </GoogleMap>
      
      {/* Aviso quando não há lotes com coordenadas */}
      {mapLoaded && lotsWithCoordinates.length === 0 && lots.length > 0 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 max-w-md">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <div className="font-bold">Nenhum lote com área definida ainda</div>
            <div className="text-xs opacity-90 mt-0.5">{lots.length} lote(s) cadastrado(s) - Defina as áreas para visualizá-los no mapa</div>
          </div>
        </div>
      )}
      {mapLoaded && lotsWithCoordinates.length === 0 && lots.length === 0 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Cadastre lotes e defina suas áreas para visualizá-los aqui
        </div>
      )}
    </div>
  );
}
