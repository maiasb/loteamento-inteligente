'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { GoogleMap, useLoadScript, OverlayView } from '@react-google-maps/api';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';

export interface OverlayConfig {
  imageUrl: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  opacity: number;
  rotation: number;
}

interface SVGOverlayEditorProps {
  initialCenter?: { lat: number; lng: number };
  initialOverlay?: OverlayConfig | null;
  onSave: (overlay: OverlayConfig | null) => void;
  onCancel: () => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '500px',
};

const defaultCenter = {
  lat: -6.0649,
  lng: -50.0389,
};

type InteractionMode =
  'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'rotate';

export default function SVGOverlayEditor({
  initialCenter,
  initialOverlay,
  onSave,
  onCancel,
}: SVGOverlayEditorProps) {
  const customAlert = useCustomAlert();
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // State
  const [imageUrl, setImageUrl] = useState<string>(initialOverlay?.imageUrl || '');
  const [, setImageFile] = useState<File | null>(null);
  const [opacity, setOpacity] = useState(initialOverlay?.opacity ?? 0.6);
  const [rotation, setRotation] = useState(initialOverlay?.rotation ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Bounds do overlay (posição no mapa)
  const [overlayBounds, setOverlayBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(initialOverlay?.bounds || null);

  // Controles de ajuste - interação por mouse
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('none');
  const [dragStartLatLng, setDragStartLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [dragStartBounds, setDragStartBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [dragStartRotation, setDragStartRotation] = useState<number>(0);
  const [dragStartAngle, setDragStartAngle] = useState<number>(0);
  const [activeTool, setActiveTool] = useState<'move' | 'resize' | 'rotate'>('move');

  // Centro calculado
  const [center] = useState(() => {
    if (initialOverlay?.bounds) {
      return {
        lat: (initialOverlay.bounds.north + initialOverlay.bounds.south) / 2,
        lng: (initialOverlay.bounds.east + initialOverlay.bounds.west) / 2,
      };
    }
    return initialCenter || defaultCenter;
  });

  // Criar overlay com base nos bounds existentes ou no boundary do mapa
  const createDefaultBounds = useCallback(() => {
    // Bounds padrão ~200m x 200m ao redor do centro
    const c = center;
    const delta = 0.001;
    return {
      north: c.lat + delta,
      south: c.lat - delta,
      east: c.lng + delta,
      west: c.lng - delta,
    };
  }, [center]);

  // Upload do arquivo de imagem
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validar tipo
      const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        customAlert.error('Formato inválido. Use SVG, PNG, JPG ou WebP.');
        return;
      }

      // Validar tamanho (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        customAlert.error('Arquivo muito grande. Máximo 10MB.');
        return;
      }

      setImageFile(file);
      setIsUploading(true);

      try {
        // Converter para data URL (base64) para uso direto no overlay
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result as string;
            if (result) resolve(result);
            else reject(new Error('Falha ao ler arquivo'));
          };
          reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
          reader.readAsDataURL(file);
        });

        setImageUrl(dataUrl);

        // Se não tem bounds, criar padrão
        if (!overlayBounds) {
          setOverlayBounds(createDefaultBounds());
        }

        customAlert.success('Imagem carregada com sucesso!');
      } catch (err) {
        console.error('Erro ao processar imagem:', err);
        customAlert.error('Erro ao processar a imagem. Tente novamente.');
      } finally {
        setIsUploading(false);
      }
    },
    [overlayBounds, createDefaultBounds, customAlert]
  );

  // Funções de ajuste de posição
  const moveOverlay = useCallback(
    (direction: 'north' | 'south' | 'east' | 'west', amount: number = 0.00005) => {
      if (!overlayBounds) return;
      setOverlayBounds((prev) => {
        if (!prev) return prev;
        switch (direction) {
          case 'north':
            return { ...prev, north: prev.north + amount, south: prev.south + amount };
          case 'south':
            return { ...prev, north: prev.north - amount, south: prev.south - amount };
          case 'east':
            return { ...prev, east: prev.east + amount, west: prev.west + amount };
          case 'west':
            return { ...prev, east: prev.east - amount, west: prev.west - amount };
          default:
            return prev;
        }
      });
    },
    [overlayBounds]
  );

  // Funções de escala (redimensionar)
  const scaleOverlay = useCallback(
    (factor: number) => {
      if (!overlayBounds) return;
      setOverlayBounds((prev) => {
        if (!prev) return prev;
        const centerLat = (prev.north + prev.south) / 2;
        const centerLng = (prev.east + prev.west) / 2;
        const halfH = (prev.north - prev.south) / 2;
        const halfW = (prev.east - prev.west) / 2;
        return {
          north: centerLat + halfH * factor,
          south: centerLat - halfH * factor,
          east: centerLng + halfW * factor,
          west: centerLng - halfW * factor,
        };
      });
    },
    [overlayBounds]
  );

  // Escala independente (horizontal / vertical)
  const scaleOverlayAxis = useCallback(
    (axis: 'horizontal' | 'vertical', factor: number) => {
      if (!overlayBounds) return;
      setOverlayBounds((prev) => {
        if (!prev) return prev;
        if (axis === 'vertical') {
          const centerLat = (prev.north + prev.south) / 2;
          const halfH = (prev.north - prev.south) / 2;
          return { ...prev, north: centerLat + halfH * factor, south: centerLat - halfH * factor };
        } else {
          const centerLng = (prev.east + prev.west) / 2;
          const halfW = (prev.east - prev.west) / 2;
          return { ...prev, east: centerLng + halfW * factor, west: centerLng - halfW * factor };
        }
      });
    },
    [overlayBounds]
  );

  // Rotação (para SVG rodado usamos CSS overlay em vez de GroundOverlay nativo)
  const handleRotationChange = useCallback((newRotation: number) => {
    setRotation(((newRotation % 360) + 360) % 360);
  }, []);

  // --- Interação por mouse: mover, redimensionar, rotacionar ---

  // Handler genérico para início de interação na imagem overlay
  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayBounds || !mapRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const map = mapRef.current;
      const div = map.getDiv();
      const rect = div.getBoundingClientRect();
      const b = map.getBounds();
      if (!b) return;

      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const lat = ne.lat() - (y / rect.height) * (ne.lat() - sw.lat());
      const lng = sw.lng() + (x / rect.width) * (ne.lng() - sw.lng());

      const startLatLng = { lat, lng };
      setDragStartLatLng(startLatLng);
      setDragStartBounds({ ...overlayBounds });

      if (activeTool === 'rotate') {
        // Calcular ângulo inicial desde o centro do overlay até o mouse
        const centerLat = (overlayBounds.north + overlayBounds.south) / 2;
        const centerLng = (overlayBounds.east + overlayBounds.west) / 2;
        const angle = Math.atan2(lng - centerLng, lat - centerLat) * (180 / Math.PI);
        setDragStartAngle(angle);
        setDragStartRotation(rotation);
        setInteractionMode('rotate');
      } else if (activeTool === 'resize') {
        // Determinar qual canto está mais perto
        const dists = {
          'resize-nw': Math.hypot(lat - overlayBounds.north, lng - overlayBounds.west),
          'resize-ne': Math.hypot(lat - overlayBounds.north, lng - overlayBounds.east),
          'resize-sw': Math.hypot(lat - overlayBounds.south, lng - overlayBounds.west),
          'resize-se': Math.hypot(lat - overlayBounds.south, lng - overlayBounds.east),
        };
        const closest = (Object.entries(dists) as [InteractionMode, number][]).sort(
          (a, b) => a[1] - b[1]
        )[0][0];
        setInteractionMode(closest);
      } else {
        setInteractionMode('move');
      }

      // Desabilitar panning do mapa durante interação
      map.setOptions({ draggable: false });
    },
    [overlayBounds, activeTool, rotation]
  );

  // Handler para mouse move global no container do mapa
  const handleMapMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (interactionMode === 'none' || !dragStartLatLng || !dragStartBounds || !mapRef.current)
        return;
      e.preventDefault();

      const map = mapRef.current;
      const div = map.getDiv();
      const rect = div.getBoundingClientRect();
      const b = map.getBounds();
      if (!b) return;

      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const currentLat = ne.lat() - (y / rect.height) * (ne.lat() - sw.lat());
      const currentLng = sw.lng() + (x / rect.width) * (ne.lng() - sw.lng());

      if (interactionMode === 'move') {
        const dLat = currentLat - dragStartLatLng.lat;
        const dLng = currentLng - dragStartLatLng.lng;
        setOverlayBounds({
          north: dragStartBounds.north + dLat,
          south: dragStartBounds.south + dLat,
          east: dragStartBounds.east + dLng,
          west: dragStartBounds.west + dLng,
        });
      } else if (interactionMode === 'rotate') {
        const centerLat = (dragStartBounds.north + dragStartBounds.south) / 2;
        const centerLng = (dragStartBounds.east + dragStartBounds.west) / 2;
        const currentAngle =
          Math.atan2(currentLng - centerLng, currentLat - centerLat) * (180 / Math.PI);
        const angleDiff = currentAngle - dragStartAngle;
        const newRot = (((dragStartRotation + angleDiff) % 360) + 360) % 360;
        setRotation(Math.round(newRot));
      } else {
        // Resize modes
        const newBounds = { ...dragStartBounds };
        const centerLat = (dragStartBounds.north + dragStartBounds.south) / 2;
        const centerLng = (dragStartBounds.east + dragStartBounds.west) / 2;

        switch (interactionMode) {
          case 'resize-nw':
            newBounds.north = Math.max(currentLat, centerLat + 0.00001);
            newBounds.west = Math.min(currentLng, centerLng - 0.00001);
            break;
          case 'resize-ne':
            newBounds.north = Math.max(currentLat, centerLat + 0.00001);
            newBounds.east = Math.max(currentLng, centerLng + 0.00001);
            break;
          case 'resize-sw':
            newBounds.south = Math.min(currentLat, centerLat - 0.00001);
            newBounds.west = Math.min(currentLng, centerLng - 0.00001);
            break;
          case 'resize-se':
            newBounds.south = Math.min(currentLat, centerLat - 0.00001);
            newBounds.east = Math.max(currentLng, centerLng + 0.00001);
            break;
        }
        setOverlayBounds(newBounds);
      }
    },
    [interactionMode, dragStartLatLng, dragStartBounds, dragStartAngle, dragStartRotation]
  );

  // Handler para fim de interação
  const handleMapMouseUp = useCallback(() => {
    if (interactionMode !== 'none' && mapRef.current) {
      mapRef.current.setOptions({ draggable: true });
    }
    setInteractionMode('none');
    setDragStartLatLng(null);
    setDragStartBounds(null);
  }, [interactionMode]);

  // Cleanup: garantir que o mapa volta a ser draggable caso o mouse saia do container
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (interactionMode !== 'none' && mapRef.current) {
        mapRef.current.setOptions({ draggable: true });
      }
      setInteractionMode('none');
      setDragStartLatLng(null);
      setDragStartBounds(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [interactionMode]);

  // Cursor style baseado no tool ativo
  const getOverlayCursor = useCallback(() => {
    if (interactionMode !== 'none') {
      if (interactionMode === 'move') return 'grabbing';
      if (interactionMode === 'rotate') return 'grabbing';
      return 'nwse-resize';
    }
    if (activeTool === 'move') return 'grab';
    if (activeTool === 'resize') return 'nwse-resize';
    if (activeTool === 'rotate') return 'crosshair';
    return 'grab';
  }, [activeTool, interactionMode]);

  // Salvar configuração
  const handleSave = useCallback(async () => {
    if (!imageUrl || !overlayBounds) {
      customAlert.error('Faça upload de uma imagem primeiro.');
      return;
    }

    setIsSaving(true);
    try {
      onSave({
        imageUrl,
        bounds: overlayBounds,
        opacity,
        rotation,
      });
    } finally {
      setIsSaving(false);
    }
  }, [imageUrl, overlayBounds, opacity, rotation, onSave, customAlert]);

  // Remover overlay
  const handleRemoveOverlay = useCallback(async () => {
    const confirmed = await customAlert.confirm('Tem certeza que deseja remover o overlay SVG?');
    if (confirmed) {
      setImageUrl('');
      setOverlayBounds(null);
      setImageFile(null);
      onSave(null);
    }
  }, [customAlert, onSave]);

  // --- Render ---
  if (loadError) {
    return (
      <div className="p-6 text-center bg-red-50 dark:bg-red-900/20 rounded-xl">
        <p className="text-red-600 dark:text-red-400">Erro ao carregar Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="p-6 text-center">
        <svg
          className="animate-spin h-8 w-8 mx-auto mb-2 text-gray-400"
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
        <p className="text-[var(--foreground)] opacity-60">Carregando mapa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload de imagem */}
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-xl p-4">
        <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Imagem do Loteamento (SVG/PNG)
        </h4>

        <div className="flex flex-col sm:flex-row items-start gap-3">
          <label className="flex-1 cursor-pointer">
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                imageUrl
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5'
              }`}
            >
              {isUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-blue-500"
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
                  <span className="text-sm text-blue-600 dark:text-blue-400">Enviando...</span>
                </div>
              ) : imageUrl ? (
                <div className="flex items-center justify-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Imagem carregada — clique para trocar
                  </span>
                </div>
              ) : (
                <>
                  <svg
                    className="w-8 h-8 mx-auto mb-2 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-sm text-[var(--foreground)] opacity-60">
                    Clique ou arraste um arquivo SVG, PNG, JPG ou WebP
                  </p>
                  <p className="text-xs text-[var(--foreground)] opacity-40 mt-1">Máx. 10MB</p>
                </>
              )}
            </div>
            <input
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {imageUrl && (
            <div className="flex gap-2">
              <button
                onClick={() => setOverlayBounds(createDefaultBounds())}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                title="Resetar posição do overlay para o centro do mapa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                Resetar Posição
              </button>
              <button
                onClick={handleRemoveOverlay}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Remover
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controles de ajuste (só mostra se tem imagem) */}
      {imageUrl && overlayBounds && (
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl p-4">
          <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-purple-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            Ajustes do Overlay
          </h4>

          {/* Opacidade */}
          <div className="mb-4">
            <label className="text-sm font-medium text-[var(--foreground)] opacity-80 flex items-center justify-between mb-1">
              <span>Opacidade</span>
              <span className="text-xs font-mono bg-purple-500/20 px-2 py-0.5 rounded">
                {Math.round(opacity * 100)}%
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(parseInt(e.target.value) / 100)}
              className="w-full accent-purple-600"
            />
          </div>

          {/* Controles de posição */}
          <div className="mb-4">
            <label className="text-sm font-medium text-[var(--foreground)] opacity-80 mb-2 block">
              Posição (D-pad)
            </label>
            <div className="flex items-center justify-center gap-1">
              <div className="grid grid-cols-3 gap-1">
                <div></div>
                <button
                  onClick={() => moveOverlay('north')}
                  className="p-2 bg-[var(--surface)] hover:bg-purple-500/20 rounded-lg transition-colors cursor-pointer border border-[var(--border)]"
                  title="Mover para cima"
                >
                  <svg
                    className="w-4 h-4 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
                <div></div>
                <button
                  onClick={() => moveOverlay('west')}
                  className="p-2 bg-[var(--surface)] hover:bg-purple-500/20 rounded-lg transition-colors cursor-pointer border border-[var(--border)]"
                  title="Mover para esquerda"
                >
                  <svg
                    className="w-4 h-4 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="p-2 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <button
                  onClick={() => moveOverlay('east')}
                  className="p-2 bg-[var(--surface)] hover:bg-purple-500/20 rounded-lg transition-colors cursor-pointer border border-[var(--border)]"
                  title="Mover para direita"
                >
                  <svg
                    className="w-4 h-4 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                <div></div>
                <button
                  onClick={() => moveOverlay('south')}
                  className="p-2 bg-[var(--surface)] hover:bg-purple-500/20 rounded-lg transition-colors cursor-pointer border border-[var(--border)]"
                  title="Mover para baixo"
                >
                  <svg
                    className="w-4 h-4 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div></div>
              </div>
            </div>
          </div>

          {/* Controles de escala */}
          <div className="mb-4">
            <label className="text-sm font-medium text-[var(--foreground)] opacity-80 mb-2 block">
              Escala (botões)
            </label>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => scaleOverlay(0.95)}
                className="px-3 py-1.5 bg-[var(--surface)] hover:bg-purple-500/20 border border-[var(--border)] rounded-lg text-sm transition-colors cursor-pointer"
                title="Reduzir 5%"
              >
                <span className="font-mono">−5%</span>
              </button>
              <button
                onClick={() => scaleOverlay(0.99)}
                className="px-3 py-1.5 bg-[var(--surface)] hover:bg-purple-500/20 border border-[var(--border)] rounded-lg text-sm transition-colors cursor-pointer"
                title="Reduzir 1%"
              >
                <span className="font-mono">−1%</span>
              </button>
              <button
                onClick={() => scaleOverlay(1.01)}
                className="px-3 py-1.5 bg-[var(--surface)] hover:bg-purple-500/20 border border-[var(--border)] rounded-lg text-sm transition-colors cursor-pointer"
                title="Aumentar 1%"
              >
                <span className="font-mono">+1%</span>
              </button>
              <button
                onClick={() => scaleOverlay(1.05)}
                className="px-3 py-1.5 bg-[var(--surface)] hover:bg-purple-500/20 border border-[var(--border)] rounded-lg text-sm transition-colors cursor-pointer"
                title="Aumentar 5%"
              >
                <span className="font-mono">+5%</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              <button
                onClick={() => scaleOverlayAxis('horizontal', 0.98)}
                className="px-3 py-1.5 bg-[var(--surface)] hover:bg-blue-500/20 border border-[var(--border)] rounded-lg text-xs transition-colors cursor-pointer"
              >
                ↔ Estreitar
              </button>
              <button
                onClick={() => scaleOverlayAxis('horizontal', 1.02)}
                className="px-3 py-1.5 bg-[var(--surface)] hover:bg-blue-500/20 border border-[var(--border)] rounded-lg text-xs transition-colors cursor-pointer"
              >
                ↔ Alargar
              </button>
              <button
                onClick={() => scaleOverlayAxis('vertical', 0.98)}
                className="px-3 py-1.5 bg-[var(--surface)] hover:bg-green-500/20 border border-[var(--border)] rounded-lg text-xs transition-colors cursor-pointer"
              >
                ↕ Achatar
              </button>
              <button
                onClick={() => scaleOverlayAxis('vertical', 1.02)}
                className="px-3 py-1.5 bg-[var(--surface)] hover:bg-green-500/20 border border-[var(--border)] rounded-lg text-xs transition-colors cursor-pointer"
              >
                ↕ Esticar
              </button>
            </div>
          </div>

          {/* Rotação */}
          <div className="mb-2">
            <label className="text-sm font-medium text-[var(--foreground)] opacity-80 flex items-center justify-between mb-1">
              <span>Rotação</span>
              <span className="text-xs font-mono bg-purple-500/20 px-2 py-0.5 rounded">
                {rotation}°
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={359}
              value={rotation}
              onChange={(e) => handleRotationChange(parseInt(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex gap-1 mt-1 justify-center flex-wrap">
              {[0, 90, 180, 270].map((angle) => (
                <button
                  key={angle}
                  onClick={() => handleRotationChange(angle)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors cursor-pointer border ${
                    rotation === angle
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-[var(--surface)] border-[var(--border)] hover:bg-purple-500/20'
                  }`}
                >
                  {angle}°
                </button>
              ))}
              <button
                onClick={() => handleRotationChange(rotation - 1)}
                className="px-2 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-purple-500/20 cursor-pointer"
              >
                −1°
              </button>
              <button
                onClick={() => handleRotationChange(rotation + 1)}
                className="px-2 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-purple-500/20 cursor-pointer"
              >
                +1°
              </button>
            </div>
          </div>

          {/* Ferramenta de interação ativa */}
          <div className="mb-2">
            <label className="text-sm font-medium text-[var(--foreground)] opacity-80 mb-2 block">
              Ferramenta (clique e arraste no mapa)
            </label>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setActiveTool('move')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer border font-medium ${
                  activeTool === 'move'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                    : 'bg-[var(--surface)] border-[var(--border)] hover:bg-blue-500/20 text-[var(--foreground)]'
                }`}
                title="Clique e arraste para mover o overlay"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                  />
                </svg>
                Mover
              </button>
              <button
                onClick={() => setActiveTool('resize')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer border font-medium ${
                  activeTool === 'resize'
                    ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-500/30'
                    : 'bg-[var(--surface)] border-[var(--border)] hover:bg-green-500/20 text-[var(--foreground)]'
                }`}
                title="Clique e arraste nos cantos para redimensionar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                Redimensionar
              </button>
              <button
                onClick={() => setActiveTool('rotate')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer border font-medium ${
                  activeTool === 'rotate'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-500/30'
                    : 'bg-[var(--surface)] border-[var(--border)] hover:bg-orange-500/20 text-[var(--foreground)]'
                }`}
                title="Clique e arraste para rotacionar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Rotacionar
              </button>
            </div>
          </div>

          {/* Info dos bounds */}
          <div className="mt-3 pt-3 border-t border-purple-500/20">
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--foreground)] opacity-60">
              <div>N: {overlayBounds.north.toFixed(6)}</div>
              <div>S: {overlayBounds.south.toFixed(6)}</div>
              <div>E: {overlayBounds.east.toFixed(6)}</div>
              <div>W: {overlayBounds.west.toFixed(6)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Mapa com overlay interativo */}
      <div
        ref={mapContainerRef}
        className="rounded-xl overflow-hidden border-2 border-[var(--border)] relative"
        onMouseMove={handleMapMouseMove}
        onMouseUp={handleMapMouseUp}
        onMouseLeave={handleMapMouseUp}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={17}
          onLoad={(map) => {
            mapRef.current = map;
            setMapLoaded(true);
            if (overlayBounds) {
              const bounds = new google.maps.LatLngBounds(
                { lat: overlayBounds.south, lng: overlayBounds.west },
                { lat: overlayBounds.north, lng: overlayBounds.east }
              );
              map.fitBounds(bounds, 50);
            }
          }}
          options={{
            mapTypeId: 'satellite',
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: interactionMode !== 'none' ? 'none' : 'cooperative',
          }}
        >
          {/* Overlay via OverlayView com interação */}
          {mapLoaded && imageUrl && overlayBounds && (
            <OverlayView
              bounds={
                new google.maps.LatLngBounds(
                  { lat: overlayBounds.south, lng: overlayBounds.west },
                  { lat: overlayBounds.north, lng: overlayBounds.east }
                )
              }
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  cursor: getOverlayCursor(),
                }}
                onMouseDown={handleOverlayMouseDown}
              >
                {/* Imagem do overlay */}
                <Image
                  src={imageUrl}
                  alt="Overlay do loteamento"
                  fill
                  unoptimized
                  style={{
                    objectFit: 'fill',
                    opacity: opacity,
                    transform: rotation ? `rotate(${rotation}deg)` : undefined,
                    transformOrigin: 'center center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                  draggable={false}
                />
                {/* Borda de seleção */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px dashed rgba(59, 130, 246, 0.8)',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                  }}
                />
                {/* Handles de canto para resize */}
                {activeTool === 'resize' && (
                  <>
                    {/* NW */}
                    <div
                      style={{
                        position: 'absolute',
                        top: -6,
                        left: -6,
                        width: 12,
                        height: 12,
                        background: '#22c55e',
                        border: '2px solid white',
                        borderRadius: 2,
                        cursor: 'nw-resize',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }}
                    />
                    {/* NE */}
                    <div
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 12,
                        height: 12,
                        background: '#22c55e',
                        border: '2px solid white',
                        borderRadius: 2,
                        cursor: 'ne-resize',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }}
                    />
                    {/* SW */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -6,
                        left: -6,
                        width: 12,
                        height: 12,
                        background: '#22c55e',
                        border: '2px solid white',
                        borderRadius: 2,
                        cursor: 'sw-resize',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }}
                    />
                    {/* SE */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -6,
                        right: -6,
                        width: 12,
                        height: 12,
                        background: '#22c55e',
                        border: '2px solid white',
                        borderRadius: 2,
                        cursor: 'se-resize',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }}
                    />
                  </>
                )}
                {/* Handle de rotação */}
                {activeTool === 'rotate' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -30,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        background: '#f97316',
                        border: '2px solid white',
                        borderRadius: '50%',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                      }}
                    />
                    <div style={{ width: 2, height: 18, background: '#f97316' }} />
                  </div>
                )}
              </div>
            </OverlayView>
          )}
        </GoogleMap>

        {/* Indicador de modo ativo sobre o mapa */}
        {imageUrl && overlayBounds && (
          <div
            className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white shadow-lg"
            style={{
              background:
                activeTool === 'move' ? '#2563eb' : activeTool === 'resize' ? '#16a34a' : '#ea580c',
            }}
          >
            {activeTool === 'move' && '✋ Arraste para mover'}
            {activeTool === 'resize' && '↔ Arraste para redimensionar'}
            {activeTool === 'rotate' && '🔄 Arraste para rotacionar'}
          </div>
        )}
      </div>

      {/* Dica */}
      {imageUrl && (
        <p className="text-xs text-[var(--foreground)] opacity-50 italic text-center">
          💡 Selecione a ferramenta desejada e clique e arraste diretamente sobre a imagem no mapa.
          Use também os controles manuais acima.
        </p>
      )}

      {/* Botões de ação */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-5 py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!imageUrl || !overlayBounds || isSaving}
          className="flex-1 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
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
              Salvando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Salvar Overlay
            </>
          )}
        </button>
      </div>
    </div>
  );
}
