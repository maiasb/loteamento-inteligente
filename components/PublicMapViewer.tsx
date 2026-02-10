'use client';

import React, { useEffect, useState } from 'react';
import { GoogleMap, useLoadScript, Polygon, OverlayView } from '@react-google-maps/api';
import { GeoCoordinate, Lot, Block } from '@/types';

interface PublicMapViewerProps {
  address?: string;
  boundaryCoordinates?: GeoCoordinate[];
  blocks?: Block[]; // Novo: quadras com coordenadas
  lots?: Lot[];
  onLotClick?: (lot: Lot) => void;
  onBlockClick?: (block: Block) => void; // Novo: callback para clicar em quadra
  onBoundaryClick?: () => void; // Novo: callback para clicar na área do loteamento
  isAdminContext?: boolean; // Novo: indica se está no contexto admin
  selectedLotIds?: string[]; // Novo: IDs dos lotes selecionados
  focusedBlockId?: string | null; // ID da quadra focada
  focusedLotId?: string | null; // ID do lote focado
  showAreas?: boolean; // Controla visibilidade das áreas (controlado externamente)
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const libraries: ("drawing" | "places")[] = ["drawing", "places"];

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

export default function PublicMapViewer({ 
  address, 
  boundaryCoordinates, 
  blocks = [], 
  lots = [], 
  onLotClick, 
  onBlockClick, 
  onBoundaryClick, 
  isAdminContext = false, 
  selectedLotIds = [],
  focusedBlockId = null,
  focusedLotId = null,
  showAreas = true
}: PublicMapViewerProps) {
  const [center, setCenter] = useState(defaultCenter);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Função para calcular o centroide de um polígono usando área ponderada
  const getPolygonCenter = (coordinates: GeoCoordinate[]) => {
    if (!coordinates || coordinates.length === 0) return null;
    
    let area = 0;
    let centroidLat = 0;
    let centroidLng = 0;
    
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length;
      const xi = coordinates[i].lat;
      const yi = coordinates[i].lng;
      const xj = coordinates[j].lat;
      const yj = coordinates[j].lng;
      
      const cross = xi * yj - xj * yi;
      area += cross;
      centroidLat += (xi + xj) * cross;
      centroidLng += (yi + yj) * cross;
    }
    
    area /= 2;
    
    if (area === 0) {
      // Fallback para média simples se área for zero
      let totalLat = 0;
      let totalLng = 0;
      coordinates.forEach(coord => {
        totalLat += coord.lat;
        totalLng += coord.lng;
      });
      return {
        lat: totalLat / coordinates.length,
        lng: totalLng / coordinates.length
      };
    }
    
    centroidLat /= (6 * area);
    centroidLng /= (6 * area);
    
    return {
      lat: centroidLat,
      lng: centroidLng
    };
  };
  const [hoveredLotId, setHoveredLotId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries as any,
  });

  // Filtrar apenas lotes que têm coordenadas definidas
  const lotsWithCoordinates = lots.filter(lot => lot.coordinates && lot.coordinates.length > 0);
  
  // Filtrar apenas quadras que têm coordenadas definidas
  const blocksWithCoordinates = blocks.filter(block => block.coordinates && block.coordinates.length > 0);

  console.log('[PublicMapViewer] Debug completo:', {
    totalBlocks: blocks.length,
    blocksWithCoordinates: blocksWithCoordinates.length,
    totalLots: lots.length,
    lotsWithCoordinates: lotsWithCoordinates.length,
    allBlocksData: blocks.map(b => ({ 
      id: b.id, 
      name: b.name, 
      hasCoords: !!(b.coordinates && b.coordinates.length > 0),
      coordsLength: b.coordinates?.length || 0,
      coordinates: b.coordinates || null
    })),
    blockDetails: blocks.map(b => ({ 
      id: b.id, 
      name: b.name, 
      hasCoords: !!(b.coordinates && b.coordinates.length > 0),
      coordsLength: b.coordinates?.length || 0 
    })),
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
    fillColor: '#10B981', // Verde esmeralda - Loteamento
    fillOpacity: 0.25,
    strokeColor: '#059669',
    strokeOpacity: 0.9,
    strokeWeight: 3,
    clickable: isAdminContext, // Clicável apenas no contexto admin
    zIndex: 1,
  };

  const getLotPolygonOptions = (lot: Lot, isHovered: boolean = false, isFocused: boolean = false) => {
    const isSelected = selectedLotIds.includes(lot.id);
    
    // Cores bem definidas baseadas no status do lote
    const colors: Record<string, { fill: string; stroke: string }> = {
      available: { fill: '#22C55E', stroke: '#16A34A' },  // Verde - Disponível
      reserved: { fill: '#F59E0B', stroke: '#D97706' },   // Amarelo - Reservado
      sold: { fill: '#EF4444', stroke: '#DC2626' },       // Vermelho - Vendido
      blocked: { fill: '#6B7280', stroke: '#4B5563' },    // Cinza - Bloqueado
    };

    const color = colors[lot.status] || colors.available;

    return {
      fillColor: isSelected ? '#3B82F6' : color.fill, // Azul para selecionado
      fillOpacity: isSelected ? 0.7 : (isFocused ? 0.8 : (isHovered ? 0.7 : 0.5)),
      strokeColor: isSelected ? '#2563EB' : (isFocused ? color.stroke : color.stroke),
      strokeOpacity: 1,
      strokeWeight: isSelected ? 4 : (isFocused ? 4 : (isHovered ? 3 : 2.5)),
      clickable: true,
      zIndex: isSelected ? 200 : (isFocused ? 150 : (isHovered ? 100 : 10)),
      cursor: 'pointer',
    };
  };
  
  const getBlockPolygonOptions = (block: Block, isHovered: boolean = false, isFocused: boolean = false) => {
    return {
      fillColor: '#A855F7', // Roxo/Púrpura - Quadra
      fillOpacity: isFocused ? 0.5 : (isHovered ? 0.35 : 0.2),
      strokeColor: '#9333EA',
      strokeOpacity: 0.9,
      strokeWeight: isFocused ? 4 : (isHovered ? 3 : 2.5),
      clickable: true, // Sempre clicável se houver callback
      zIndex: isFocused ? 8 : 5, // Sempre abaixo dos lotes (que começam em 10)
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
    <div className="w-full h-full rounded-xl overflow-hidden relative">
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
          gestureHandling: 'cooperative', // Requer Ctrl+scroll para zoom
        }}
      >
        {/* Polígono da área do loteamento */}
        {mapLoaded && showAreas && boundaryCoordinates && boundaryCoordinates.length > 0 && (
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
        
        {/* Polígonos das quadras */}
        {mapLoaded && showAreas && blocksWithCoordinates.map((block) => (
          <React.Fragment key={`block-${block.id}`}>
            <Polygon
              paths={block.coordinates || []}
              options={getBlockPolygonOptions(block, hoveredBlockId === block.id, focusedBlockId === block.id)}
              onClick={() => {
                if (onBlockClick) {
                  console.log('[PublicMapViewer] Quadra clicada:', block.name);
                  onBlockClick(block);
                }
              }}
              onMouseOver={() => setHoveredBlockId(block.id)}
              onMouseOut={() => setHoveredBlockId(null)}
            />
          </React.Fragment>
        ))}

        {/* Polígonos dos lotes */}
        {mapLoaded && showAreas && lotsWithCoordinates.map((lot) => (
          <React.Fragment key={lot.id}>
            <Polygon
              paths={lot.coordinates || []}
              options={getLotPolygonOptions(lot, hoveredLotId === lot.id, focusedLotId === lot.id)}
              onClick={() => {
                console.log('[PublicMapViewer] Lote clicado:', lot.lotNumber);
                onLotClick && onLotClick(lot);
              }}
              onMouseOver={() => setHoveredLotId(lot.id)}
              onMouseOut={() => setHoveredLotId(null)}
            />
          </React.Fragment>
        ))}

        {/* Tooltip de hover para quadras */}
        {hoveredBlockId && (() => {
          const block = blocksWithCoordinates.find(b => b.id === hoveredBlockId);
          if (!block) return null;
          const blockCenter = getPolygonCenter(block.coordinates || []);
          if (!blockCenter) return null;
          return (
            <OverlayView
              position={blockCenter}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                style={{
                  position: 'absolute',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  border: '2px solid rgba(147, 51, 234, 0.6)'
                }}
              >
                QUADRA {block.name}
              </div>
            </OverlayView>
          );
        })()}

        {/* Tooltip de hover para lotes */}
        {hoveredLotId && (() => {
          const lot = lotsWithCoordinates.find(l => l.id === hoveredLotId);
          if (!lot) return null;
          const lotCenter = getPolygonCenter(lot.coordinates || []);
          if (!lotCenter) return null;
          return (
            <OverlayView
              position={lotCenter}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                style={{
                  position: 'absolute',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  border: '2px solid rgba(147, 51, 234, 0.6)'
                }}
              >
                QUADRA {lot.blockName} &gt; LOTE {lot.lotNumber}
              </div>
            </OverlayView>
          );
        })()}
      </GoogleMap>
    </div>
  );
}
