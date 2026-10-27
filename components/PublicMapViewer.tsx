'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import { Lot, Block, LotStatus, OverlayConfig } from '@/types';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';

interface PublicMapViewerProps {
  address?: string;
  blocks?: Block[];
  lots?: Lot[];
  onLotClick?: (lot: Lot) => void;
  onBlockClick?: (block: Block) => void;
  overlayConfig?: OverlayConfig | null;
  onMapClick?: (lat: number, lng: number) => void; // Para posicionar lotes no mapa
  placingMode?: boolean; // Indica se está em modo de posicionamento de lote
  placingLotLabel?: string; // Label do lote sendo posicionado (ex: "Lote 5 (3/10)")
  showOverlay?: boolean; // Controla visibilidade do overlay SVG
  showMarkers?: boolean; // Controla visibilidade das marcações dos lotes
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

// Calcula o tamanho do círculo do lote baseado no zoom do mapa
function getCircleSizeFromZoom(zoom: number): number {
  // Zoom 15 => ~12px, zoom 17 => ~24px, zoom 19 => ~48px, zoom 21 => ~96px
  // Escala exponencial: dobra a cada 2 níveis de zoom
  const base = 6;
  const size = base * Math.pow(2, (zoom - 14) / 2);
  return Math.max(8, Math.min(size, 120));
}

export default function PublicMapViewer({
  lots = [],
  onLotClick,
  overlayConfig = null,
  onMapClick,
  placingMode = false,
  placingLotLabel,
  showOverlay = true,
  showMarkers = true,
}: PublicMapViewerProps) {
  const [center, setCenter] = useState(defaultCenter);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [, setHoveredLotId] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const overlayDivRef = useRef<HTMLDivElement | null>(null);
  const lotOverlaysRef = useRef<google.maps.OverlayView[]>([]);
  const hoveredLotIdRef = useRef<string | null>(null);
  // Ref para controlar se o idle inicial já foi processado
  const idleInitializedRef = useRef(false);
  // Ref para acompanhar o valor atual de showMarkers sem incluir nas deps do effect de criação
  const showMarkersRef = useRef(showMarkers);
  useEffect(() => {
    showMarkersRef.current = showMarkers;
  }, [showMarkers]);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Função para obter cor do status
  const getStatusColor = useCallback((status: LotStatus) => {
    switch (status) {
      case LotStatus.AVAILABLE:
        return { bg: '#22c55e', border: '#16a34a' }; // green
      case LotStatus.RESERVED:
        return { bg: '#eab308', border: '#ca8a04' }; // yellow
      case LotStatus.SOLD:
        return { bg: '#ef4444', border: '#dc2626' }; // red
      case LotStatus.BLOCKED:
        return { bg: '#6366f1', border: '#4f46e5' }; // indigo (especial)
      default:
        return { bg: '#9ca3af', border: '#6b7280' }; // gray
    }
  }, []);

  // Handler para clique no mapa (posicionar lote)
  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (placingMode && onMapClick && e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    },
    [placingMode, onMapClick]
  );

  // Calcular centro a partir dos bounds do overlay
  useEffect(() => {
    if (overlayConfig?.bounds) {
      setCenter({
        lat: (overlayConfig.bounds.north + overlayConfig.bounds.south) / 2,
        lng: (overlayConfig.bounds.east + overlayConfig.bounds.west) / 2,
      });
    }
  }, [overlayConfig]);

  // Gerenciar overlay SVG/imagem nativamente via google.maps.OverlayView
  // Isso evita o "flash" causado pelo OverlayView do React criando novos bounds a cada render
  useEffect(() => {
    if (!mapRef.current || !overlayConfig?.imageUrl || !overlayConfig?.bounds) {
      // Remover overlay existente se config foi removida
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
        overlayDivRef.current = null;
      }
      return;
    }

    const map = mapRef.current;
    const config = overlayConfig;
    const sw = new google.maps.LatLng(config.bounds.south, config.bounds.west);
    const ne = new google.maps.LatLng(config.bounds.north, config.bounds.east);
    const bounds = new google.maps.LatLngBounds(sw, ne);

    // Se já existe um overlay, removê-lo antes de criar um novo
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
      overlayDivRef.current = null;
    }

    class ImageOverlay extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;

      onAdd() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.pointerEvents = 'none';

        const img = document.createElement('img');
        img.src = config.imageUrl!;
        img.alt = 'Overlay do loteamento';
        img.draggable = false;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'fill';
        img.style.display = 'block';

        div.appendChild(img);

        div.style.opacity = String(config.opacity ?? 0.6);
        if (config.rotation) {
          div.style.transform = `rotate(${config.rotation}deg)`;
        }

        this.div = div;
        overlayDivRef.current = div;

        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(div);
      }

      draw() {
        if (!this.div) return;
        const projection = this.getProjection();
        if (!projection) return;

        const swPixel = projection.fromLatLngToDivPixel(bounds.getSouthWest());
        const nePixel = projection.fromLatLngToDivPixel(bounds.getNorthEast());

        if (!swPixel || !nePixel) return;

        this.div.style.left = swPixel.x + 'px';
        this.div.style.top = nePixel.y + 'px';
        this.div.style.width = nePixel.x - swPixel.x + 'px';
        this.div.style.height = swPixel.y - nePixel.y + 'px';
      }

      onRemove() {
        if (this.div?.parentNode) {
          this.div.parentNode.removeChild(this.div);
        }
        this.div = null;
      }
    }

    const overlay = new ImageOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
      overlayDivRef.current = null;
    };
  }, [mapLoaded, overlayConfig]);

  // Alternar visibilidade do overlay SVG
  useEffect(() => {
    if (overlayDivRef.current) {
      overlayDivRef.current.style.display = showOverlay ? '' : 'none';
    }
  }, [showOverlay]);

  // Filtrar lotes que têm coordenadas (lat/lng)
  const lotsWithPosition = lots.filter(
    (lot) => lot.lat !== undefined && lot.lat !== null && lot.lng !== undefined && lot.lng !== null
  );
  const lotsKey = lotsWithPosition
    .map((l) => `${l.id}-${l.lat}-${l.lng}-${l.status}-${l.lotNumber}`)
    .join(',');

  // Gerenciar círculos dos lotes nativamente via google.maps.OverlayView
  useEffect(() => {
    // Limpar overlays anteriores
    lotOverlaysRef.current.forEach((o) => o.setMap(null));
    lotOverlaysRef.current = [];

    if (!mapRef.current || !mapLoaded || lotsWithPosition.length === 0) return;

    const map = mapRef.current;

    lotsWithPosition.forEach((lot) => {
      const position = new google.maps.LatLng(lot.lat!, lot.lng!);

      class LotCircleOverlay extends google.maps.OverlayView {
        private div: HTMLDivElement | null = null;

        onAdd() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.cursor = onLotClick ? 'pointer' : 'default';
          div.style.userSelect = 'none';
          div.style.zIndex = '10';

          // Atualizar visuais
          this.updateVisuals(div, false);

          div.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onLotClick) onLotClick(lot);
          });

          div.addEventListener('mouseenter', () => {
            hoveredLotIdRef.current = lot.id;
            setHoveredLotId(lot.id);
            this.updateVisuals(div, true);
            div.style.zIndex = '100';
          });

          div.addEventListener('mouseleave', () => {
            hoveredLotIdRef.current = null;
            setHoveredLotId(null);
            this.updateVisuals(div, false);
            div.style.zIndex = '10';
          });

          const statusText =
            lot.status === LotStatus.AVAILABLE
              ? 'Disponível'
              : lot.status === LotStatus.RESERVED
                ? 'Reservado'
                : lot.status === LotStatus.SOLD
                  ? 'Vendido'
                  : 'Bloqueado';
          div.title = `Lote ${lot.lotNumber}${lot.blockName ? ` - Quadra ${lot.blockName}` : ''} (${statusText})`;

          this.div = div;
          const panes = this.getPanes();
          panes?.overlayMouseTarget.appendChild(div);
        }

        updateVisuals(div: HTMLDivElement, hovered: boolean) {
          const colors = getStatusColor(lot.status);
          const zoom = map.getZoom() || 17;
          const baseSize = getCircleSizeFromZoom(zoom);
          const size = hovered ? baseSize + 6 : baseSize;
          const fontSize = Math.max(8, Math.round(baseSize * 0.4));

          div.style.width = size + 'px';
          div.style.height = size + 'px';
          div.style.marginLeft = -size / 2 + 'px';
          div.style.marginTop = -size / 2 + 'px';
          div.style.borderRadius = '50%';
          div.style.backgroundColor = colors.bg;
          div.style.border = `2.5px solid ${colors.border}`;
          div.style.display = 'flex';
          div.style.alignItems = 'center';
          div.style.justifyContent = 'center';
          div.style.transition =
            'width 0.15s ease, height 0.15s ease, margin 0.15s ease, box-shadow 0.15s ease';
          div.style.boxShadow = hovered
            ? `0 0 12px 3px ${colors.bg}88, 0 2px 8px rgba(0,0,0,0.4)`
            : '0 1px 4px rgba(0,0,0,0.4)';

          // Atualizar ou criar o span interno
          let span = div.querySelector('span') as HTMLSpanElement;
          if (!span) {
            span = document.createElement('span');
            div.appendChild(span);
          }
          span.textContent = lot.lotNumber;
          span.style.color = '#fff';
          span.style.fontWeight = '800';
          span.style.fontSize = fontSize + 'px';
          span.style.lineHeight = '1';
          span.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
          span.style.letterSpacing = '-0.5px';
        }

        draw() {
          if (!this.div) return;
          const projection = this.getProjection();
          if (!projection) return;

          const point = projection.fromLatLngToDivPixel(position);
          if (!point) return;

          this.div.style.left = point.x + 'px';
          this.div.style.top = point.y + 'px';

          // Atualizar tamanho com base no zoom atual
          const isHovered = hoveredLotIdRef.current === lot.id;
          this.updateVisuals(this.div, isHovered);
        }

        onRemove() {
          if (this.div?.parentNode) {
            this.div.parentNode.removeChild(this.div);
          }
          this.div = null;
        }
      }

      const overlay = new LotCircleOverlay();
      // Usar o valor atual de showMarkers para a visibilidade inicial
      overlay.setMap(showMarkersRef.current ? map : null);
      lotOverlaysRef.current.push(overlay);
    });

    return () => {
      lotOverlaysRef.current.forEach((o) => o.setMap(null));
      lotOverlaysRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, lotsKey, onLotClick]);

  // Alternar visibilidade das marcações dos lotes
  useEffect(() => {
    lotOverlaysRef.current.forEach((overlay) => {
      if (showMarkers) {
        overlay.setMap(mapRef.current);
      } else {
        overlay.setMap(null);
      }
    });
  }, [showMarkers]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-[500px] bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl flex items-center justify-center p-8">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
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

  if (loadError) {
    return (
      <div className="w-full h-[500px] bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl flex items-center justify-center p-8">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
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
          <svg
            className="animate-spin h-12 w-12 mx-auto mb-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-600 dark:text-gray-400 font-semibold">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full rounded-xl overflow-hidden relative ${placingMode ? 'cursor-crosshair' : ''}`}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={17}
        onLoad={(map) => {
          mapRef.current = map;
          // Não definir mapLoaded aqui — aguardar o primeiro idle para garantir
          // que a projeção do mapa está pronta antes de criar as marcações
        }}
        onIdle={() => {
          // Primeiro idle: mapa e tiles carregados, projeção disponível
          if (!idleInitializedRef.current) {
            idleInitializedRef.current = true;
            setMapLoaded(true);
          }
        }}
        onClick={handleMapClick}
        options={{
          mapTypeId: 'satellite',
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          draggableCursor: placingMode ? 'crosshair' : undefined,
        }}
      >
        {/* Overlay SVG/imagem e círculos dos lotes são gerenciados nativamente via useEffect */}
      </GoogleMap>

      {/* Indicador de modo de posicionamento */}
      {placingMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2 animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {placingLotLabel
            ? `Clique no mapa para posicionar: ${placingLotLabel}`
            : 'Clique no mapa para posicionar o lote'}
        </div>
      )}
    </div>
  );
}
