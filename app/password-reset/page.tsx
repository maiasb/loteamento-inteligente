'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

export default function PasswordResetPage() {
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [userId, setUserId] = useState<number | null>(null);
  const router = useRouter();

  // Formatar CPF com máscara
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return value;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    if (error) setError('');
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verificar se o CPF e email correspondem a um usuário
      const response = await axios.post('/api/password/verify', {
        cpf: cpf.replace(/\D/g, ''),
        email,
      });

      if (response.data.success) {
        setUserId(response.data.userId);
        setStep('reset');
      } else {
        setError('CPF ou email não encontrados.');
      }
    } catch {
      setError('CPF ou email não encontrados. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/password/reset', {
        userId,
        newPassword,
      });

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setError('Erro ao redefinir senha. Tente novamente.');
      }
    } catch {
      setError('Erro ao redefinir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
        <div className="w-full max-w-md">
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl p-8 text-center border border-[var(--border)]">
            <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-green-600"
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
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
              Senha redefinida com sucesso!
            </h2>
            <p className="text-[var(--foreground)] opacity-70 mb-6">
              Você será redirecionado para a página de login em alguns segundos...
            </p>
            <Link
              href="/login"
              className="inline-block text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              Ir para Login agora
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl p-8 border border-[var(--border)]">
          {/* Logo e Título */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Redefinir Senha</h1>
            <p className="text-gray-600 mt-2">
              {step === 'verify'
                ? 'Digite seu CPF e email para verificação'
                : 'Digite sua nova senha'}
            </p>
          </div>

          {/* Formulário de Verificação */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-2">
                  CPF
                </label>
                <input
                  id="cpf"
                  type="text"
                  value={cpf}
                  onChange={handleCPFChange}
                  required
                  maxLength={14}
                  className="text-black w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  className="text-black w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="seu@email.com"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verificando...' : 'Verificar'}
              </button>
            </form>
          )}

          {/* Formulário de Redefinição */}
          {step === 'reset' && (
            <form onSubmit={handleReset} className="space-y-6">
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    minLength={6}
                    className="text-black w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Confirmar Nova Senha
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  minLength={6}
                  className="text-black w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Digite a senha novamente"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Redefinindo...' : 'Redefinir Senha'}
              </button>
            </form>
          )}

          {/* Link para Login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Voltar para Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
