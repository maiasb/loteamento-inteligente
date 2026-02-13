'use client';

import React from 'react';
import { Lot, LotStatus } from '@/types';
import { usePurchaseForm } from '@/hooks/usePurchaseForm';
import { useAuth } from '@/contexts/AuthContext';
import { formatCPF, validateCPF, formatCurrency, parseCurrency, formatPhone } from '@/utils/formatters';

interface PurchaseModalProps {
  lots: Lot[]; // Mudado de lot: Lot para lots: Lot[]
  onClose: () => void;
  onSuccess: (reservationId?: string) => void;
  onToggleLotStatus?: (lotId: string, currentStatus: LotStatus) => Promise<void>;
}

const paymentOptions = [
  { label: 'Dinheiro', value: 'dinheiro', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="7" width="18" height="10" rx="2" stroke="currentColor" strokeWidth={2} />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={2} />
    </svg>
  ) },
  { label: 'PIX', value: 'pix', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth={2} />
      <path d="M8 12h8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  ) },
  { label: 'Cartão Crédito', value: 'cartao_credito', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="currentColor" strokeWidth={2} />
      <path d="M2 10h20" stroke="currentColor" strokeWidth={2} />
    </svg>
  ) },
  { label: 'Cartão Débito', value: 'cartao_debito', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="currentColor" strokeWidth={2} />
      <path d="M2 10h20M6 14h4" stroke="currentColor" strokeWidth={2} />
    </svg>
  ) },
];

const installmentOptions = [
  { label: 'À Vista', value: 1 },
  { label: '12x', value: 12 },
  { label: '24x', value: 24 },
  { label: '36x', value: 36 },
  { label: '48x', value: 48 },
  { label: '60x', value: 60 },
  { label: '72x', value: 72 },
  { label: '84x', value: 84 },
  { label: '100x', value: 100 },
];

export default function PurchaseModal({ lots, onClose, onSuccess, onToggleLotStatus }: PurchaseModalProps) {
  const { user } = useAuth();
  const [isTogglingBlock, setIsTogglingBlock] = React.useState(false);
  
  // Estados simplificados - apenas preços dos lotes
  const [lotPrices] = React.useState<Record<string, number | null>>(
    lots.reduce((acc, lot) => ({ ...acc, [lot.id]: lot.price }), {})
  );
  
  const { formData, setFormData, isSubmitting, error, handleSubmit } = usePurchaseForm(lots, onSuccess, lotPrices, {}, {}, user?.id);
  const [cpfError, setCpfError] = React.useState<string>('');
  const [sellerCpfError, setSellerCpfError] = React.useState<string>('');
  const [showOptionalFields, setShowOptionalFields] = React.useState(false);

  // Função para bloquear/desbloquear lote
  const handleToggleLotStatus = async (lot: Lot) => {
    if (!onToggleLotStatus) return;
    
    const action = lot.status === LotStatus.BLOCKED ? 'desbloquear' : 'bloquear';
    if (!confirm(`Deseja ${action} o lote ${lot.lotNumber}?`)) {
      return;
    }

    setIsTogglingBlock(true);
    try {
      await onToggleLotStatus(lot.id, lot.status);
      alert(`✅ Lote ${lot.lotNumber} ${lot.status === LotStatus.BLOCKED ? 'desbloqueado' : 'bloqueado'} com sucesso!`);
      // Não chamar onSuccess() para evitar a mensagem de reserva
      // Apenas fechar o modal e o componente pai irá recarregar os dados
      onClose();
    } catch (error) {
      console.error('Erro ao alterar status do lote:', error);
      alert('❌ Erro ao alterar status do lote. Tente novamente.');
    } finally {
      setIsTogglingBlock(false);
    }
  };

  // Calcular preço total e área
  const totalPrice = Object.values(lotPrices).reduce((sum: number, price) => sum + (price || 0), 0);
  const totalArea = lots.reduce((sum, lot) => sum + lot.size, 0);

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setFormData({ ...formData, customerCPF: formatted });

    // Validar CPF quando tiver 14 caracteres (formato completo)
    if (formatted.length === 14) {
      if (!validateCPF(formatted)) {
        setCpfError('CPF inválido');
      } else {
        setCpfError('');
      }
    } else {
      setCpfError('');
    }
  };

  const handleSellerCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setFormData({ ...formData, sellerCPF: formatted });

    if (formatted.length === 14) {
      if (!validateCPF(formatted)) {
        setSellerCpfError('CPF inválido');
      } else {
        setSellerCpfError('');
      }
    } else {
      setSellerCpfError('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData({ ...formData, customerPhone: formatted });
  };

  const handleSellerPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData({ ...formData, sellerPhone: formatted });
  };

  const handleFirstPaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/\D/g, '');
    
    if (value === '') {
      setFormData({ ...formData, firstPayment: '' });
      return;
    }
    
    value = value.padStart(3, '0');
    const cents = value.slice(-2);
    const reais = value.slice(0, -2);
    const displayValue = `${parseInt(reais).toLocaleString('pt-BR')},${cents}`;
    setFormData({ ...formData, firstPayment: displayValue });
  };

  return (
    <div className="fixed inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[var(--card-bg)] rounded-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] my-auto overflow-y-auto shadow-[var(--shadow-xl)] border border-[var(--border)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white p-4 sm:p-6 rounded-t-2xl shadow-[var(--shadow-md)] z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-bold">Manifestar Interesse</h2>
                <p className="text-white opacity-90 text-xs sm:text-sm">
                  {lots.length === 1 ? `Lote ${lots[0].lotNumber}` : `${lots.length} Lotes Selecionados`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                      <span className="text-sm font-medium text-[var(--foreground)]">Lote {lot.lotNumber}</span>
                      {lot.blockName && (
                        <span className="text-xs text-[var(--foreground)] opacity-80 bg-white/20 px-2 py-0.5 rounded">
                          Quadra: {lot.blockName}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-[var(--foreground)]">{lot.size}m²</span>
                  </div>
                  
                  {lot.price && (
                    <div className="mt-2 text-right">
                      <span className="text-xs text-[var(--foreground)] opacity-70">R$ </span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {lot.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-3 border border-blue-300/50">
                <p className="text-xs font-medium text-[var(--foreground)] opacity-70 mb-1">Área Total</p>
                <p className="text-lg font-bold text-[var(--foreground)]">{totalArea}m²</p>
              </div>
              <div className="rounded-xl p-3 border border-blue-300/50">
                <p className="text-xs font-medium text-[var(--foreground)] opacity-70 mb-1">Preço Total</p>
                <p className="text-lg font-bold text-[var(--foreground)]">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl p-4 mb-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[var(--danger)] text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* SEÇÃO 1: CAMPOS OBRIGATÓRIOS */}
            <div className="bg-[var(--surface)] border-2 border-[var(--primary)]/30 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[var(--primary)] text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">Informações Obrigatórias</h3>
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

            {/* Botão para expandir campos opcionais */}
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="w-full py-3 px-4 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg 
                className={`w-5 h-5 transition-transform ${showOptionalFields ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showOptionalFields ? 'Ocultar Informações Adicionais' : 'Adicionar Mais Informações (Opcional)'}
            </button>

            {/* SEÇÃO 2: CAMPOS OPCIONAIS */}
            {showOptionalFields && (
              <div className="space-y-5 animate-in slide-in-from-top duration-300">
                {/* Dados do Cliente - Detalhados */}
                <div className="bg-[var(--surface)] border-2 border-blue-500/30 rounded-xl p-4 sm:p-5">
                  <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Dados Complementares do Cliente
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">CPF</label>
                      <input
                        type="text"
                        value={formData.customerCPF}
                        onChange={handleCPFChange}
                        className={`w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] font-mono placeholder:text-gray-400 ${
                          cpfError ? 'border-red-500 focus:border-red-500' : 'border-[var(--border)] focus:border-[var(--primary)]'
                        }`}
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                      {cpfError && (
                        <p className="text-red-600 text-sm mt-1">❌ {cpfError}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Telefone</label>
                      <input
                        type="text"
                        value={formData.customerPhone || ''}
                        onChange={handlePhoneChange}
                        className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] font-mono placeholder:text-gray-400"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">E-mail</label>
                      <input
                        type="email"
                        value={formData.customerEmail || ''}
                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder:text-gray-400"
                        placeholder="exemplo@email.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados do Vendedor - Detalhados */}
                <div className="bg-[var(--surface)] border-2 border-purple-500/30 rounded-xl p-4 sm:p-5">
                  <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Dados Complementares do Vendedor
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">CPF</label>
                      <input
                        type="text"
                        value={formData.sellerCPF || ''}
                        onChange={handleSellerCPFChange}
                        className={`w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] font-mono placeholder:text-gray-400 ${
                          sellerCpfError ? 'border-red-500 focus:border-red-500' : 'border-[var(--border)] focus:border-[var(--primary)]'
                        }`}
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                      {sellerCpfError && (
                        <p className="text-red-600 text-sm mt-1">❌ {sellerCpfError}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Telefone</label>
                      <input
                        type="text"
                        value={formData.sellerPhone || ''}
                        onChange={handleSellerPhoneChange}
                        className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] font-mono placeholder:text-gray-400"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">E-mail</label>
                      <input
                        type="email"
                        value={formData.sellerEmail || ''}
                        onChange={(e) => setFormData({ ...formData, sellerEmail: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder:text-gray-400"
                        placeholder="exemplo@email.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Informações de Pagamento */}
                <div className="bg-[var(--surface)] border-2 border-green-500/30 rounded-xl p-4 sm:p-5">
                  <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Informações de Pagamento
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Forma de Pagamento */}
                    <div>
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-3">Forma de Pagamento</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {paymentOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, paymentMethod: option.value })}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all cursor-pointer ${
                              formData.paymentMethod === option.value
                                ? 'border-green-500 bg-green-500/20 text-green-600 dark:text-green-400 ring-2 ring-green-500/50 shadow-lg shadow-green-500/20'
                                : 'border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-green-500/50 hover:bg-green-500/5'
                            }`}
                          >
                            {option.icon}
                            <span className="text-xs font-medium mt-1">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Entrada e Parcelas */}
                    <div className={`grid grid-cols-1 gap-4 ${formData.paymentMethod === 'cartao_credito' ? 'md:grid-cols-2' : ''}`}>
                      <div>
                        <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Valor de Entrada</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--foreground)] opacity-60 font-semibold">R$</span>
                          <input
                            type="text"
                            value={formData.firstPayment || ''}
                            onChange={handleFirstPaymentChange}
                            className="w-full pl-12 pr-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] font-mono placeholder:text-gray-400"
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      {/* Parcelamento - apenas para Cartão Crédito */}
                      {formData.paymentMethod === 'cartao_credito' && (
                        <div>
                          <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Parcelamento</label>
                          <select
                            value={formData.installments || 1}
                            onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value) })}
                            className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] cursor-pointer"
                          >
                            {installmentOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Número do Contrato */}
                    <div>
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Número do Contrato</label>
                      <input
                        type="text"
                        value={formData.contract || ''}
                        onChange={(e) => setFormData({ ...formData, contract: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder:text-gray-400"
                        placeholder="Ex: CONT-2025-001"
                      />
                    </div>

                    {/* Observações */}
                    <div>
                      <label className="block text-[var(--foreground)] opacity-80 text-sm font-semibold mb-2">Observações</label>
                      <textarea
                        value={formData.message || ''}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder:text-gray-400 resize-none"
                        placeholder="Informações adicionais sobre a reserva..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 bg-[var(--card-bg)] border-t border-[var(--border)] p-4 sm:p-6 flex flex-col sm:flex-row gap-3 rounded-b-2xl">
              <button
                type="submit"
                disabled={isSubmitting || cpfError !== '' || sellerCpfError !== ''}
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e as any);
                }}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--success)] text-white rounded-xl hover:bg-[var(--success)]/90 font-semibold text-sm sm:text-base shadow-[var(--shadow-md)] transition-all hover:shadow-[var(--shadow-lg)] disabled:bg-[var(--foreground)]/20 disabled:cursor-not-allowed disabled:hover:shadow-[var(--shadow-md)] cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando...
                  </span>
                ) : 'Criar Reserva'}
              </button>
              
              {/* Botão de bloquear/desbloquear - apenas para admin/dev, um único lote, e status disponível ou bloqueado */}
              {onToggleLotStatus && lots.length === 1 && (user?.role === 'admin' || user?.role === 'dev') && (lots[0].status === LotStatus.AVAILABLE || lots[0].status === LotStatus.BLOCKED) && (
                <button
                  type="button"
                  onClick={() => handleToggleLotStatus(lots[0])}
                  disabled={isTogglingBlock || isSubmitting}
                  className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 ${
                    lots[0].status === LotStatus.BLOCKED
                      ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/40'
                      : 'bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30 border border-gray-500/40'
                  }`}
                  title={lots[0].status === LotStatus.BLOCKED ? 'Desbloquear lote' : 'Bloquear lote'}
                >
                  {isTogglingBlock ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        {lots[0].status === LotStatus.BLOCKED ? (
                          <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                        ) : (
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
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
