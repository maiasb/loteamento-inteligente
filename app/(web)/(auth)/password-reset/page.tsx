'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import PasswordField from '@/components/PasswordField';
import { formatCPF, validateCPF } from '@/utils/formatters';

type Step = 'request' | 'requested' | 'redefine';

function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response) {
    if (err.response.status === 429) {
      const minutes = Math.max(1, Math.ceil(Number(err.response.data?.retryAfter ?? 60) / 60));
      return `Muitas tentativas. Tente novamente em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`;
    }
    if (typeof err.response.data?.error === 'string') return err.response.data.error;
  }
  return fallback;
}

const inputClass =
  'w-full px-4 py-3 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary-light)] focus:border-[var(--primary-light)] transition-all placeholder-[var(--foreground)]/40';
const buttonClass =
  'w-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white py-3 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-light)] transition-all disabled:opacity-50 disabled:cursor-not-allowed';

export default function PasswordResetPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateCPF(cpf)) {
      setError('CPF inválido. Verifique o número digitado.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        '/api/usuarios/senha/solicitar',
        { cpf: cpf.replace(/\D/g, ''), email },
        { timeout: 10000 }
      );
      setStep('requested');
    } catch (err) {
      setError(apiError(err, 'Não foi possível enviar o pedido. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRedefine = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateCPF(cpf)) {
      setError('CPF inválido. Verifique o número digitado.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        '/api/usuarios/senha/redefinir',
        { cpf: cpf.replace(/\D/g, ''), code, newPassword },
        { timeout: 10000 }
      );
      router.push('/login?senha=redefinida');
    } catch (err) {
      setError(apiError(err, 'Não foi possível redefinir a senha. Tente novamente.'));
      setLoading(false);
    }
  };

  const cpfField = (
    <div>
      <label
        htmlFor="cpf"
        className="block text-sm font-medium text-[var(--foreground)] opacity-90 mb-2"
      >
        CPF
      </label>
      <input
        id="cpf"
        type="text"
        inputMode="numeric"
        autoComplete="username"
        value={cpf}
        onChange={(e) => {
          setCpf(formatCPF(e.target.value));
          if (error) setError('');
        }}
        required
        maxLength={14}
        className={inputClass}
        placeholder="000.000.000-00"
      />
    </div>
  );

  const errorBox = (
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
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-md)] p-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)] text-center mb-2">
          Esqueci minha senha
        </h1>

        {step === 'request' && (
          <form onSubmit={handleRequest} className="space-y-5">
            <p className="text-sm text-[var(--foreground)] opacity-70 text-center">
              Informe o CPF e o e-mail cadastrados. O administrador vai confirmar a sua identidade e
              entregar um código para você criar uma nova senha.
            </p>
            {cpfField}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--foreground)] opacity-90 mb-2"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="voce@email.com"
              />
            </div>
            {errorBox}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? 'Enviando...' : 'Pedir redefinição'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep('redefine');
              }}
              className="w-full text-sm text-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
            >
              Já tenho um código
            </button>
          </form>
        )}

        {step === 'requested' && (
          <div className="space-y-5" role="status">
            <p className="text-sm text-[var(--foreground)] text-center">
              Se os dados conferem, o administrador foi avisado. Ele vai confirmar a sua identidade
              (por telefone ou WhatsApp) e entregar um código válido por 15 minutos.
            </p>
            <button type="button" onClick={() => setStep('redefine')} className={buttonClass}>
              Já recebi o código
            </button>
          </div>
        )}

        {step === 'redefine' && (
          <form onSubmit={handleRedefine} className="space-y-5">
            <p className="text-sm text-[var(--foreground)] opacity-70 text-center">
              Informe o CPF, o código que o administrador entregou e a nova senha.
            </p>
            {cpfField}
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-[var(--foreground)] opacity-90 mb-2"
              >
                Código
              </label>
              <input
                id="code"
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={11}
                className={`${inputClass} font-mono tracking-widest`}
                placeholder="XXXXX-XXXXX"
              />
            </div>
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
            {errorBox}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link
            href="/login"
            className="text-[var(--primary-light)] hover:text-[var(--primary)] font-medium transition-colors"
          >
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
