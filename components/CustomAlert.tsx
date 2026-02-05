'use client';

import React, { useEffect } from 'react';

interface CustomAlertProps {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function CustomAlert({
  title,
  message,
  type = 'info',
  onClose,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancelar',
}: CustomAlertProps) {
  const isConfirm = type === 'confirm';

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Configurações de cor por tipo
  const config = {
    success: {
      gradient: 'from-green-500 to-emerald-600',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      defaultTitle: 'Sucesso!',
    },
    error: {
      gradient: 'from-red-500 to-red-600',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      defaultTitle: 'Erro',
    },
    warning: {
      gradient: 'from-amber-500 to-orange-600',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      defaultTitle: 'Atenção',
    },
    info: {
      gradient: 'from-blue-500 to-blue-600',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      defaultTitle: 'Informação',
    },
    confirm: {
      gradient: 'from-purple-500 to-purple-600',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      defaultTitle: 'Confirmação',
    },
  };

  const currentConfig = config[type];
  const displayTitle = title || currentConfig.defaultTitle;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card-bg)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp border-2 border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com gradiente */}
        <div className={`bg-gradient-to-r ${currentConfig.gradient} p-6 text-white`}>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/20 rounded-full p-3 backdrop-blur-sm">
              {currentConfig.icon}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center">{displayTitle}</h2>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          <p className="text-[var(--foreground)] text-center text-lg leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* Botões */}
        <div className="px-6 pb-6 flex gap-3">
          {isConfirm ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-[var(--surface)] text-[var(--foreground)] rounded-xl font-semibold hover:bg-[var(--surface)]/80 transition-all duration-200 border-2 border-[var(--border)]"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
                className={`flex-1 px-6 py-3 bg-gradient-to-r ${currentConfig.gradient} text-white rounded-xl font-semibold hover:opacity-90 transition-all duration-200 shadow-lg`}
              >
                {confirmText}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className={`w-full px-6 py-3 bg-gradient-to-r ${currentConfig.gradient} text-white rounded-xl font-semibold hover:opacity-90 transition-all duration-200 shadow-lg`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
