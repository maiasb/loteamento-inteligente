'use client';

import React, { useState } from 'react';
import PublicMapViewer from './PublicMapViewer';
import { Lot } from '@/types/Lot';
import { Block } from '@/types/Block';
import { OverlayConfig } from '@/types/OverlayConfig';

type ViewOnlyLotMapProps = {
  mapName: string;
  address?: string;
  overlayConfig?: OverlayConfig | null;
  blocks: Block[];
  lots: Lot[];
};

type LotModalProps = {
  lot: Lot | null;
  onClose: () => void;
};

function LotInfoModal({ lot, onClose }: LotModalProps) {
  if (!lot) return null;

  const statusLabels = {
    available: 'Disponível',
    reserved: 'Reservado',
    sold: 'Vendido',
    blocked: 'Bloqueado',
  };

  const statusColors = {
    available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    reserved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    sold: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    blocked: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Lote {lot.lotNumber}</h2>
              {lot.blockName && (
                <p className="text-blue-100 text-sm mt-1">Quadra {lot.blockName}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              aria-label="Fechar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Status</h3>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[lot.status]}`}
            >
              {statusLabels[lot.status]}
            </span>
          </div>

          {/* Informações principais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Área</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{lot.size} m²</p>
            </div>
          </div>

          {/* Descrição */}
          {lot.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                Descrição
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{lot.description}</p>
            </div>
          )}

          {/* Características */}
          {lot.features && lot.features.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                Características
              </h3>
              <div className="flex flex-wrap gap-2">
                {lot.features.map((feature, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer com informação */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-b-2xl border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Esta é uma visualização do lote. Para informações sobre disponibilidade e compra,
              entre em contato com nossa equipe de vendas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ViewOnlyLotMap({
  mapName,
  address,
  overlayConfig,
  blocks,
  lots,
}: ViewOnlyLotMapProps) {
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  // Calcular estatísticas dos lotes
  const stats = {
    total: lots.length,
    totalBlocks: blocks.length,
    available: lots.filter((lot) => lot.status === 'available').length,
    reserved: lots.filter((lot) => lot.status === 'reserved').length,
    sold: lots.filter((lot) => lot.status === 'sold').length,
    blocked: lots.filter((lot) => lot.status === 'blocked').length,
  };

  const handleLotClick = (lot: Lot) => {
    setSelectedLot(lot);
  };

  const handleBlockClick = (block: Block) => {
    setFocusedBlockId(focusedBlockId === block.id ? null : block.id);
  };

  const closeModal = () => {
    setSelectedLot(null);
  };

  return (
    <div className="flex flex-row h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar à esquerda */}
      <div className="w-full md:w-96 lg:w-[400px] flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{mapName}</h1>
          {address && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              {address}
            </p>
          )}
        </div>

        {/* Estatísticas */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Estatísticas
          </h3>
          <div className="space-y-3">
            {/* Total */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total de Lotes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                </div>
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Quadras */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Quadras</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalBlocks}
                  </p>
                </div>
                <div className="bg-purple-500/20 p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Disponíveis */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Disponíveis</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.available}
                  </p>
                </div>
                <div className="bg-green-500/20 p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Reservados */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Reservados</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.reserved}
                  </p>
                </div>
                <div className="bg-yellow-500/20 p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Vendidos */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Vendidos</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.sold}</p>
                </div>
                <div className="bg-red-500/20 p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-red-600 dark:text-red-400"
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
                </div>
              </div>
            </div>

            {/* Bloqueados */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Bloqueados</p>
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {stats.blocked}
                  </p>
                </div>
                <div className="bg-gray-500/20 p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-gray-600 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map - área principal à direita */}
      <div className="flex-1 relative overflow-hidden">
        <PublicMapViewer
          address={address}
          blocks={blocks}
          lots={lots}
          onLotClick={handleLotClick}
          onBlockClick={handleBlockClick}
          overlayConfig={overlayConfig}
        />
      </div>

      {/* Modal */}
      {selectedLot && <LotInfoModal lot={selectedLot} onClose={closeModal} />}
    </div>
  );
}
