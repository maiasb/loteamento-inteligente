'use client';

import React, { useEffect, useState } from 'react';
import { Lot } from '@/types/Lot';
import { LotArea } from '@/types/LotArea';
import { LotStatus } from '@/types/LotStatus';
import { useInteractiveMap } from '@/hooks/useInteractiveMap';
import { loadPdfJs } from '@/lib/pdfjs-wrapper';

type InteractiveMapProps = {
  imageUrl: string;
  lots: Lot[];
  onLotClick?: (lot: Lot) => void;
  isEditMode?: boolean;
  onAreaDrawn?: (area: LotArea) => void;
  selectedLotId?: string;
  selectedLotIds?: string[]; // Novo: suporte para múltiplos lotes selecionados
  drawingMode?: 'polygon' | 'rectangle';
  previewArea?: LotArea | null;
};

export default function InteractiveMap({
  imageUrl,
  lots,
  onLotClick,
  isEditMode = false,
  onAreaDrawn,
  selectedLotId,
  selectedLotIds = [], // Novo: suporte para múltiplos lotes selecionados
  drawingMode = 'polygon',
  previewArea = null,
}: InteractiveMapProps) {
  const [isPDF, setIsPDF] = useState(false);
  const [pdfImageUrl, setPdfImageUrl] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);

  // Detectar se é PDF e converter
  useEffect(() => {
    // Resetar estados ao mudar imageUrl
    setIsPDF(false);
    setPdfImageUrl('');
    setIsConverting(false);

    if (!imageUrl || imageUrl.trim() === '') {
      return;
    }

    if (imageUrl.startsWith('data:application/pdf')) {
      setIsPDF(true);
      setIsConverting(true);

      const loadPDF = async () => {
        try {
          const pdfjsLib = await loadPdfJs();
          const loadingTask = pdfjsLib.getDocument(imageUrl);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const scale = 4;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            const imageData = canvas.toDataURL('image/png', 1.0);
            setPdfImageUrl(imageData);
          }
        } catch (error) {
          console.error('[InteractiveMap] Erro ao converter PDF:', error);
        } finally {
          setIsConverting(false);
        }
      };

      loadPDF();
    }
  }, [imageUrl]);

  const effectiveImageUrl = isPDF ? pdfImageUrl : imageUrl;

  const {
    canvasRef,
    imageRef,
    containerRef,
    hoveredLot,
    drawingPoints,
    scale,
    handleCanvasClick,
    handleCanvasMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleFinishDrawing,
    handleCancelDrawing,
  } = useInteractiveMap({
    imageUrl: effectiveImageUrl,
    lots,
    onLotClick,
    isEditMode,
    onAreaDrawn,
    selectedLotId,
    selectedLotIds,
    drawingMode,
    previewArea,
  });

  // Adicionar listener de wheel com passive: false para permitir zoom com scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleZoomIn, handleZoomOut, containerRef]);

  return (
    <div ref={containerRef} className="relative" style={{ touchAction: 'none' }}>
      {/* Loading durante conversão de PDF */}
      {isConverting ? (
        <div className="border-2 border-[var(--border)] rounded-lg bg-[var(--surface)] min-h-[500px] relative overflow-hidden">
          {/* Skeleton animado de fundo */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--surface)] via-[var(--border)] to-[var(--surface)] animate-pulse"></div>

          {/* Padrão de grade simulando um mapa */}
          <div className="absolute inset-0 opacity-20">
            <div className="grid grid-cols-8 grid-rows-6 h-full gap-4 p-8">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[var(--border)] rounded animate-pulse"
                  style={{ animationDelay: `${i * 0.05}s` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Indicador de loading centralizado */}
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/60 backdrop-blur-sm">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)]/20 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-[var(--accent)] animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <p className="text-[var(--foreground)] font-semibold mb-1">Convertendo PDF...</p>
              <p className="text-[var(--foreground)] opacity-60 text-sm">Por favor, aguarde</p>
            </div>
          </div>
        </div>
      ) : !effectiveImageUrl || effectiveImageUrl.trim() === '' ? (
        /* Sem imagem cadastrada */
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
          <svg
            className="w-24 h-24 mx-auto mb-4 text-gray-400"
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
          <p className="text-gray-600 font-medium mb-2">Nenhuma imagem do mapa carregada</p>
          <p className="text-gray-500 text-sm">
            Adicione uma imagem ao mapa para começar a desenhar os lotes
          </p>
        </div>
      ) : (
        /* Mapa pronto */
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imageRef} src={effectiveImageUrl} alt="Map" className="hidden" />
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="border border-gray-300 rounded-lg shadow-lg cursor-crosshair max-w-full touch-none select-none"
            style={{
              touchAction: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              userSelect: 'none',
            }}
          />
        </>
      )}

      {/* Controles e informações: apenas quando NÃO está convertendo e tem URL válida */}
      {!isConverting && effectiveImageUrl && effectiveImageUrl.trim() !== '' && (
        <>
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button
              onClick={handleZoomIn}
              className="bg-white hover:bg-gray-50 text-gray-800 font-bold py-2 px-3 rounded-lg shadow-lg border border-gray-200 transition-all hover:shadow-xl cursor-pointer"
              title="Zoom In (Roda do Mouse ou Pinch)"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="bg-white hover:bg-gray-50 text-gray-800 font-bold py-2 px-3 rounded-lg shadow-lg border border-gray-200 transition-all hover:shadow-xl cursor-pointer"
              title="Zoom Out (Roda do Mouse ou Pinch)"
            >
              -
            </button>
            <button
              onClick={handleResetZoom}
              className="bg-white hover:bg-gray-50 text-gray-800 font-medium py-2 px-3 rounded-lg shadow-lg border border-gray-200 transition-all hover:shadow-xl text-xs cursor-pointer"
              title="Resetar Zoom e Posição"
            >
              Reset
            </button>
            <div className="bg-white px-3 py-1 rounded-lg shadow-lg border border-gray-200 text-xs text-gray-700 text-center">
              {Math.round(scale * 100)}%
            </div>
          </div>

          {/* Dica de navegação - visível em telas maiores */}
          <div className="hidden md:block absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-xs text-gray-600 max-w-xs">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-semibold text-gray-700">Navegação:</span>
            </div>
            <ul className="space-y-0.5 ml-6">
              <li>
                🖱️ <strong>Botão direito:</strong> Arrastar mapa
              </li>
              <li>
                🔍 <strong>Scroll:</strong> Zoom
              </li>
            </ul>
          </div>

          {/* Dica mobile - visível apenas em telas pequenas */}
          <div className="md:hidden absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-blue-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                👆 <strong>1 dedo:</strong> Arrastar
              </span>
              <span className="mx-1">•</span>
              <span>
                🤏 <strong>2 dedos:</strong> Zoom
              </span>
            </div>
          </div>
        </>
      )}

      {isEditMode && drawingMode === 'polygon' && drawingPoints.length > 0 && (
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button
            onClick={handleFinishDrawing}
            className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow-lg transition-all hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
            disabled={drawingPoints.length < 3}
          >
            Finalizar Área ({drawingPoints.length} pontos)
          </button>
          <button
            onClick={handleCancelDrawing}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-lg transition-all hover:shadow-xl cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {isEditMode && drawingMode === 'rectangle' && !previewArea && (
        <div className="absolute bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <p className="font-medium">🔲 Modo Retângulo: Clique e arraste para desenhar</p>
        </div>
      )}

      {isEditMode && previewArea && previewArea.points.length >= 3 && (
        <div className="absolute bottom-4 left-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <p className="font-medium">✅ Área selecionada - Complete as informações do lote</p>
        </div>
      )}

      {hoveredLot && !isEditMode && (
        <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-xl border border-gray-200">
          <h3 className="font-bold text-lg text-gray-900 mb-2">Lote {hoveredLot.lotNumber}</h3>
          <p className="text-sm text-gray-700 mb-1">
            <span className="font-medium">Status:</span>{' '}
            <span
              className={
                hoveredLot.status === LotStatus.AVAILABLE
                  ? 'font-semibold text-green-700'
                  : hoveredLot.status === LotStatus.RESERVED
                    ? 'font-semibold text-amber-700'
                    : hoveredLot.status === LotStatus.BLOCKED
                      ? 'font-semibold text-gray-500'
                      : 'font-semibold text-red-700'
              }
            >
              {hoveredLot.status === LotStatus.AVAILABLE
                ? 'Disponível'
                : hoveredLot.status === LotStatus.RESERVED
                  ? 'Reservado'
                  : hoveredLot.status === LotStatus.BLOCKED
                    ? 'Bloqueado'
                    : 'Vendido'}
            </span>
          </p>
          <p className="text-sm text-gray-700 mb-1">
            <span className="font-medium">Área:</span> {hoveredLot.size}m²
          </p>
          <p className="text-base font-bold text-gray-900 mt-2">
            R$ {hoveredLot.price.toLocaleString('pt-BR')}
          </p>
          {hoveredLot.pricePerM2 && (
            <p className="text-xs text-gray-600 mt-1">
              R$ {hoveredLot.pricePerM2.toLocaleString('pt-BR')}/m²
            </p>
          )}
        </div>
      )}
    </div>
  );
}
