import { useState } from 'react';
import axios from 'axios';
import { Lot } from '@/types';
import { validateCPF, parseCurrency } from '@/utils/formatters';

const API_URL = '/api';

interface FormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCPF: string;
  message: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  sellerCPF: string;
  paymentMethod: string[];
  otherPayment: string;
  contract: string;
  firstPayment: string;
  installments: number;
  reservationDate: string;
  lotPaymentMethods: Record<string, string[]>;
}

export function usePurchaseForm(
  lots: Lot[], 
  onSuccess: (reservationId?: string) => void, 
  lotPrices?: Record<string, number | null>, 
  lotFirstPayments?: Record<string, number | null>,
  lotInstallments?: Record<string, number | null>,
  userId?: string
) {
  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerCPF: '',
    message: '',
    sellerName: '',
    sellerEmail: '',
    sellerPhone: '',
    sellerCPF: '',
    paymentMethod: [],
    otherPayment: '',
    contract: '',
    firstPayment: '',
    installments: 1,
    reservationDate: new Date().toISOString().slice(0, 16),
    lotPaymentMethods: {},
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validar nome do cliente (obrigatório)
    if (!formData.customerName || formData.customerName.trim() === '') {
      setError('Nome do cliente é obrigatório.');
      setIsSubmitting(false);
      return;
    }

    // Validar nome do vendedor (obrigatório)
    if (!formData.sellerName || formData.sellerName.trim() === '') {
      setError('Nome do vendedor é obrigatório.');
      setIsSubmitting(false);
      return;
    }

    // Validar CPF do cliente se fornecido
    if (formData.customerCPF && !validateCPF(formData.customerCPF)) {
      setError('CPF do cliente inválido.');
      setIsSubmitting(false);
      return;
    }

    // Validar CPF do vendedor se fornecido
    if (formData.sellerCPF && !validateCPF(formData.sellerCPF)) {
      setError('CPF do vendedor inválido.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 🔍 VERIFICAR SE TODOS OS LOTES ESTÃO DISPONÍVEIS ANTES DE RESERVAR

      const unavailableLots: string[] = [];
      for (const lot of lots) {
        const checkResponse = await axios.get(`${API_URL}/mapas/lotes/valido?idLote=${lot.id}`);
        if (checkResponse.data.isAvailable === 0) {
          unavailableLots.push(lot.lotNumber);
        }
      }

      if (unavailableLots.length > 0) {
        setError(`Os seguintes lotes não estão mais disponíveis: ${unavailableLots.join(', ')}. Por favor, remova-os da seleção.`);
        setIsSubmitting(false);
        return;
      }

      // Preparar detalhes dos lotes com map_id, block_id, preço, firstPayment e installments
      // Converter firstPayment do formulário (string "1.900,00") para número
      const formFirstPayment = formData.firstPayment ? parseCurrency(formData.firstPayment) : null;
      const formInstallments = formData.installments > 1 ? formData.installments : null;

      const lotDetails = lots.map(lot => ({
        lotId: lot.id,
        mapId: lot.mapId,
        blockId: lot.blockId || null,
        price: lotPrices?.[lot.id] || lot.price,
        firstPayment: lotFirstPayments?.[lot.id] || formFirstPayment || null,
        installments: lotInstallments?.[lot.id] || formInstallments || null,
        paymentMethod: formData.lotPaymentMethods[lot.id]?.length > 0
          ? formData.lotPaymentMethods[lot.id].join(', ')
          : formData.paymentMethod.length > 0
            ? formData.paymentMethod.join(', ')
            : null,
      }));

      // Criar objeto de requisição apenas com campos obrigatórios e preenchidos
      const requestData: any = {
        lotIds: lots.map(lot => lot.id),
        lotDetails,
        customerName: formData.customerName,
        sellerName: formData.sellerName,
      };

      // Adicionar campos opcionais apenas se preenchidos
      if (formData.customerEmail) requestData.customerEmail = formData.customerEmail;
      if (formData.customerPhone) requestData.customerPhone = formData.customerPhone;
      if (formData.customerCPF) requestData.customerCPF = formData.customerCPF;
      if (formData.sellerEmail) requestData.sellerEmail = formData.sellerEmail;
      if (formData.sellerPhone) requestData.sellerPhone = formData.sellerPhone;
      if (formData.sellerCPF) requestData.sellerCPF = formData.sellerCPF;
      if (formData.message) requestData.message = formData.message;
      if (formData.contract) requestData.contract = formData.contract;
      if (formData.reservationDate) requestData.reservationDate = formData.reservationDate;
      if (userId) requestData.userId = userId;
      
      if (formData.paymentMethod.length > 0 || formData.otherPayment) {
        const methods = formData.otherPayment
          ? [...formData.paymentMethod, formData.otherPayment]
          : formData.paymentMethod;
        requestData.paymentMethod = methods.join(', ');
      }

      const response = await axios.post(`${API_URL}/mapas/lotes/reservar`, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      // Retornar o ID da reserva criada
      const reservationId = response.data?.purchaseRequestId || response.data?.id || response.data?.reservationId;
      onSuccess(reservationId);
    } catch (err) {
      console.error('[usePurchaseForm] ❌ Erro ao enviar reserva:', err);

      if (axios.isAxiosError(err)) {
        if (err.response) {
          // Verifica se o erro é de lote indisponível
          if (err.response.status === 409 || err.response.data?.message?.includes('disponível')) {
            setError('Este lote não está mais disponível. Por favor, escolha outro lote.');
          } else {
            setError(`Erro do servidor: ${err.response.data?.message || err.response.statusText}`);
          }
        } else if (err.request) {
          setError('Não foi possível conectar ao servidor. Verifique sua conexão.');
        } else {
          setError('Erro ao preparar requisição.');
        }
      } else {
        setError('Erro inesperado ao enviar reserva.');
      }

      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    isSubmitting,
    error,
    handleSubmit,
  };
}
