'use client';

import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import PasswordField from '@/components/PasswordField';

const API_URL = '/api';

export default function PasswordPage() {
  const { user, isLoading, isAuthenticated, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  const mustChange = Boolean(user?.first_login);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/usuarios/senha`,
        { currentPassword, newPassword },
        { timeout: 10000 }
      );
      await refreshUser();
      router.push('/dashboard');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setError(typeof message === 'string' ? message : 'Erro ao atualizar a senha.');
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--background)]"
        role="status"
      >
        <p className="text-[var(--foreground)] opacity-70">Verificando sessão...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-md)] p-8 w-full max-w-md space-y-5"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {mustChange ? 'Defina uma nova senha' : 'Atualizar senha'}
          </h1>
          {mustChange && (
            <p className="mt-2 text-sm text-[var(--foreground)] opacity-70">
              Você entrou com uma senha provisória. Escolha uma senha só sua para continuar.
            </p>
          )}
        </div>

        <PasswordField
          label={mustChange ? 'Senha provisória' : 'Senha atual'}
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordField
          label="Nova senha"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres. Não use o CPF nem senhas comuns."
        />
        <PasswordField
          label="Confirmar nova senha"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />

        <div aria-live="assertive">
          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
            >
              {error}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white py-3 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-light)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Salvando...' : 'Atualizar senha'}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full text-sm text-[var(--foreground)] opacity-70 hover:opacity-100 transition-opacity"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
