'use client';

import React, { useEffect, useState } from 'react';
import { GoogleMap, useLoadScript, Polygon } from '@react-google-maps/api';
import { GeoCoordinate } from '@/types';

interface PublicMapViewerProps {
  address?: string;
  boundaryCoordinates?: GeoCoordinate[];
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

export default function PublicMapViewer({ address, boundaryCoordinates }: PublicMapViewerProps) {
  const [center, setCenter] = useState(defaultCenter);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries as any,
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
    fillOpacity: 0.3,
    strokeColor: '#4CAF50',
    strokeOpacity: 1,
    strokeWeight: 2,
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
    <div className="w-full h-[500px] rounded-xl overflow-hidden">
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
        {mapLoaded && boundaryCoordinates && boundaryCoordinates.length > 0 && (
          <Polygon
            paths={boundaryCoordinates}
            options={polygonOptions}
          />
        )}
      </GoogleMap>
    </div>
  );
}
