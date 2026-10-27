'use client';

import { useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import CustomAlert from '@/components/CustomAlert';

type AlertOptions = {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

// Função helper para criar e mostrar alert
export const showAlert = ({ title, message, type = 'info' }: AlertOptions) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const handleClose = () => {
    root.unmount();
    // Verificar se o container ainda é filho do body antes de remover
    if (container.parentNode === document.body) {
      document.body.removeChild(container);
    }
  };

  root.render(<CustomAlert title={title} message={message} type={type} onClose={handleClose} />);
};

// Função helper para criar e mostrar confirm
export const showConfirm = ({
  title,
  message,
  confirmText,
  cancelText,
}: ConfirmOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = () => {
      root.unmount();
      // Verificar se o container ainda é filho do body antes de remover
      if (container.parentNode === document.body) {
        document.body.removeChild(container);
      }
      resolve(false);
    };

    const handleConfirm = () => {
      root.unmount();
      // Verificar se o container ainda é filho do body antes de remover
      if (container.parentNode === document.body) {
        document.body.removeChild(container);
      }
      resolve(true);
    };

    root.render(
      <CustomAlert
        title={title}
        message={message}
        type="confirm"
        onClose={handleClose}
        onConfirm={handleConfirm}
        confirmText={confirmText}
        cancelText={cancelText}
      />
    );
  });
};

// Hook para usar nos componentes
export function useCustomAlert() {
  const alert = useCallback((options: AlertOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options;

    showAlert(opts);
  }, []);

  const success = useCallback((message: string, title?: string) => {
    showAlert({ message, title, type: 'success' });
  }, []);

  const error = useCallback((message: string, title?: string) => {
    showAlert({ message, title, type: 'error' });
  }, []);

  const warning = useCallback((message: string, title?: string) => {
    showAlert({ message, title, type: 'warning' });
  }, []);

  const info = useCallback((message: string, title?: string) => {
    showAlert({ message, title, type: 'info' });
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;

    return showConfirm(opts);
  }, []);

  return {
    alert,
    success,
    error,
    warning,
    info,
    confirm,
  };
}
