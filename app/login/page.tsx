'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

function LoginForm() {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  // Verificar se veio da página de registro
  const isRegistered = searchParams.get('registered') === 'true';
  const isPending = searchParams.get('registered') === 'pending';

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

  // Validar CPF
  const validateCPF = (cpf: string): boolean => {
    const numbers = cpf.replace(/\D/g, '');

    if (numbers.length !== 11) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(numbers)) return false;

    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(numbers.charAt(9))) return false;

    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(numbers.charAt(10))) return false;

    return true;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);

    // Limpar erro quando usuário começar a digitar
    if (error) setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validar CPF antes de enviar
    if (!validateCPF(cpf)) {
      setError('CPF inválido. Verifique o número digitado.');
      return;
    }

    setLoading(true);

    try {
      const success = await login(cpf, password);

      if (success) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

        if (!currentUser.first_login) {
          router.push('/dashboard');
        } else {
          router.push(`/password?userId=${currentUser.id}`);
        }
      } else {
        setError('CPF ou senha inválidos');
        setLoading(false);
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'PENDING') {
          setError(
            'Sua conta ainda está aguardando aprovação de um administrador. Entre em contato para mais informações.'
          );
        } else if (err.message === 'REJECTED') {
          setError(
            'Sua conta foi rejeitada. Entre em contato com o administrador para mais informações.'
          );
        } else {
          setError('CPF ou senha inválidos');
        }
      } else {
        setError('CPF ou senha inválidos');
      }
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#E8D5CE' }}
    >
      <div className="w-full max-w-md">
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl p-8 border border-[var(--border)]">
          {/* Logo e Título */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <Image
                src="/simbolo-logotipo-epiteto-login.svg"
                alt="Imobiliária Vale dos Carajás"
                width={1329}
                height={738}
                priority
                className="h-30 w-auto"
              />
            </div>
            {/* <p className="text-[var(--foreground)] opacity-70 mt-2">
              Sistema de Loteamento
            </p> */}
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
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
                value={cpf}
                onChange={handleCPFChange}
                required
                maxLength={14}
                className="w-full px-4 py-3 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder-[var(--foreground)]/40"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--foreground)] opacity-90 mb-2"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-black w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {isPending && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
                ⏳ Conta criada com sucesso! Aguardando aprovação de um administrador. Você receberá
                acesso em breve.
              </div>
            )}

            {isRegistered && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                ✅ Conta criada com sucesso! Faça login para continuar.
              </div>
            )}

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
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Link para Cadastro */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link
                href="/register"
                className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
              <svg
                className="w-8 h-8 text-emerald-600 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
