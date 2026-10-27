'use client';

import React from 'react';
import { Lot } from '@/types/Lot';
import { LotStatus } from '@/types/LotStatus';
import { usePurchaseForm } from '@/hooks/usePurchaseForm';
import { useAuth } from '@/contexts/AuthContext';
import { showAlert, showConfirm } from '@/hooks/useCustomAlert';

type PurchaseModalProps = {
  lots: Lot[]; // Mudado de lot: Lot para lots: Lot[]
  onClose: () => void;
  onSuccess: (reservationId?: string) => void;
  onToggleLotStatus?: (lotId: string, currentStatus: LotStatus) => Promise<void>;
};

export default function PurchaseModal({
  lots,
  onClose,
  onSuccess,
  onToggleLotStatus,
}: PurchaseModalProps) {
  const { user } = useAuth();
  const [isTogglingBlock, setIsTogglingBlock] = React.useState(false);

  // Preços fixos dos lotes (sem edição)
  const lotPrices = React.useMemo(
    () =>
      lots.reduce<Record<string, number | null>>(
        (acc, lot) => ({ ...acc, [lot.id]: lot.price }),
        {}
      ),
    [lots]
  );

  const { formData, setFormData, isSubmitting, error, handleSubmit } = usePurchaseForm(
    lots,
    onSuccess,
    lotPrices,
    {},
    {},
    user?.id
  );

  // Função para bloquear/desbloquear lote
  const handleToggleLotStatus = async (lot: Lot) => {
    if (!onToggleLotStatus) return;

    const action = lot.status === LotStatus.BLOCKED ? 'desbloquear' : 'bloquear';
    const confirmed = await showConfirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Lote`,
      message: `Deseja ${action} o lote ${lot.lotNumber}?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    setIsTogglingBlock(true);
    try {
      await onToggleLotStatus(lot.id, lot.status);
      showAlert({
        message: `Lote ${lot.lotNumber} ${lot.status === LotStatus.BLOCKED ? 'desbloqueado' : 'bloqueado'} com sucesso!`,
        type: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Erro ao alterar status do lote:', error);
      showAlert({
        message: 'Erro ao alterar status do lote. Tente novamente.',
        type: 'error',
      });
    } finally {
      setIsTogglingBlock(false);
    }
  };

  // Calcular preço total e área
  const totalPrice = Object.values(lotPrices).reduce((sum: number, price) => sum + (price || 0), 0);
  const totalArea = lots.reduce((sum, lot) => sum + lot.size, 0);

  return (
    <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] my-auto overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white p-4 sm:p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 sm:w-7 sm:h-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-bold">Manifestar Interesse</h2>
                <p className="text-white opacity-90 text-xs sm:text-sm">
                  {lots.length === 1
                    ? `Lote ${lots[0].lotNumber}`
                    : `${lots.length} Lotes Selecionados`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        <div className="p-4 sm:p-6">
          {/* Informações dos lotes selecionados - APENAS VISUALIZAÇÃO */}
          <div className="bg-blue-500/30 border-2 border-blue-400 rounded-2xl p-3 sm:p-5 mb-4 sm:mb-6 shadow-lg">
            <h3 className="text-base font-bold text-[var(--foreground)] mb-3">
              {lots.length === 1 ? 'Lote Selecionado' : 'Lotes Selecionados'}
            </h3>
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {lots.map((lot) => (
                <div key={lot.id} className="rounded-lg p-3 border border-blue-300/50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        Lote {lot.lotNumber}
                      </span>
                      {lot.blockName && (
                        <span className="text-xs text-[var(--foreground)] opacity-80 bg-white/20 px-2 py-0.5 rounded">
                          Quadra: {lot.blockName}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-[var(--foreground)]">{lot.size}m²</span>
                  </div>

                  <div className="mt-2 flex items-center justify-end">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      R${' '}
                      {lot.price
                        ? lot.price.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '0,00'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-3 border border-blue-300/50">
                <p className="text-xs font-medium text-[var(--foreground)] opacity-70 mb-1">
                  Área Total
                </p>
                <p className="text-lg font-bold text-[var(--foreground)]">{totalArea}m²</p>
              </div>
              <div className="rounded-xl p-3 border border-blue-300/50">
                <p className="text-xs font-medium text-[var(--foreground)] opacity-70 mb-1">
                  Preço Total
                </p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  R${' '}
                  {totalPrice.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl p-4 mb-4 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-[var(--danger)] text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* SEÇÃO 1: CAMPOS OBRIGATÓRIOS */}
            <div className="bg-[var(--surface)] border-2 border-[var(--primary)]/30 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[var(--primary)] text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  Informações Obrigatórias
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">
                    <span className="text-red-500">*</span> Nome Completo do Cliente
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder:text-gray-400"
                    placeholder="Digite o nome completo"
                  />
                </div>

                <div>
                  <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">
                    <span className="text-red-500">*</span> Nome do Vendedor
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sellerName || ''}
                    onChange={(e) => setFormData({ ...formData, sellerName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder:text-gray-400"
                    placeholder="Digite o nome do vendedor"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-[var(--card-bg)] border-t border-[var(--border)] p-4 sm:p-6 flex flex-col sm:flex-row gap-3 rounded-b-2xl">
              <button
                type="submit"
                disabled={isSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--success)] text-white rounded-xl hover:bg-[var(--success)]/90 font-semibold text-sm sm:text-base shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] disabled:bg-[var(--foreground)]/20 disabled:cursor-not-allowed disabled:hover:shadow-[var(--shadow-md)] cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
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
                    Enviando...
                  </span>
                ) : (
                  'Criar Reserva'
                )}
              </button>

              {/* Botão de bloquear/desbloquear - apenas para admin/dev, um único lote, e status disponível ou bloqueado */}
              {onToggleLotStatus &&
                lots.length === 1 &&
                (user?.role === 'admin' || user?.role === 'dev') &&
                (lots[0].status === LotStatus.AVAILABLE ||
                  lots[0].status === LotStatus.BLOCKED) && (
                  <button
                    type="button"
                    onClick={() => handleToggleLotStatus(lots[0])}
                    disabled={isTogglingBlock || isSubmitting}
                    className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 ${
                      lots[0].status === LotStatus.BLOCKED
                        ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/40'
                        : 'bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30 border border-gray-500/40'
                    }`}
                    title={
                      lots[0].status === LotStatus.BLOCKED ? 'Desbloquear lote' : 'Bloquear lote'
                    }
                  >
                    {isTogglingBlock ? (
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
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          {lots[0].status === LotStatus.BLOCKED ? (
                            <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                          ) : (
                            <path
                              fillRule="evenodd"
                              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                              clipRule="evenodd"
                            />
                          )}
                        </svg>
                        {lots[0].status === LotStatus.BLOCKED ? 'Desbloquear' : 'Bloquear'}
                      </>
                    )}
                  </button>
                )}

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl hover:bg-[var(--foreground)]/5 font-semibold text-sm sm:text-base shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
