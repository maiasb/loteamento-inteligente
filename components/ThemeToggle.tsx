'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

type ThemeToggleProps = {
  variant?: 'floating' | 'inline';
};

export default function ThemeToggle({ variant = 'floating' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, updateUserTheme } = useAuth();

  const handleToggle = () => {
    // Alternar tema imediatamente (síncrono)
    const newTheme = toggleTheme();

    // Atualizar AuthContext imediatamente
    if (user?.id) {
      updateUserTheme(newTheme);

      // Salvar no banco de dados em background (não bloqueia UI)
      axios
        .put('/api/usuarios/theme', {
          theme: newTheme,
        })
        .catch((error) => {
          console.error('[ThemeToggle] Erro ao salvar preferência de tema:', error);
        });
    }
  };

  if (variant === 'inline') {
    return (
      <button
        onClick={handleToggle}
        className="p-2 bg-[var(--surface)]/50 hover:bg-[var(--surface)] rounded-lg transition-all"
        aria-label="Alternar tema"
      >
        {theme === 'light' ? (
          <svg
            className="w-6 h-6 text-[var(--foreground)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 text-[var(--foreground)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className="fixed top-4 right-4 z-50 p-3 bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 hidden lg:flex"
      aria-label="Alternar tema"
    >
      {theme === 'light' ? (
        <svg
          className="w-6 h-6 text-[var(--foreground)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : (
        <svg
          className="w-6 h-6 text-[var(--foreground)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </button>
  );
}
