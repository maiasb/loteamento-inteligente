'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { User, UserRole } from '@/types';

const API_URL = '/api';

// Endpoints em que 401 não significa "sessão perdida" (login errado, /me sem sessão, logout).
const AUTH_ENDPOINTS = ['/usuarios/login', '/usuarios/me', '/usuarios/logout'];

export type LoginResult = { ok: true; user: User } | { ok: false; message: string };

interface AuthContextType {
  user: User | null;
  /** true enquanto o servidor ainda não respondeu se existe sessão válida (/me). */
  isLoading: boolean;
  login: (cpf: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  canAccessUsers: boolean;
  updateUserTheme: (theme: 'light' | 'dark') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loginErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response) {
    const { status, data } = error.response;
    if (status === 429) {
      const minutes = Math.max(1, Math.ceil(Number(data?.retryAfter ?? 60) / 60));
      return `Muitas tentativas. Tente novamente em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`;
    }
    if (typeof data?.error === 'string') return data.error;
  }
  return 'Não foi possível entrar. Verifique sua conexão e tente novamente.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const response = await axios.get(`${API_URL}/usuarios/me`, { timeout: 10000 });
      const current = response.data.user as User;
      setUser(current);
      return current;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // A sessão vive no cookie HttpOnly; o navegador não guarda mais usuário nem senha. Chaves
  // antigas do localStorage (usuário completo) são removidas.
  useEffect(() => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userData');

    let cancelled = false;
    axios
      .get(`${API_URL}/usuarios/me`, { timeout: 10000 })
      .then((response) => {
        if (!cancelled) setUser(response.data.user as User);
      })
      .catch(() => {
        // Sem sessão válida (401) ou servidor indisponível: segue deslogado.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 401 fora do login = sessão expirada/revogada: limpa o estado e volta ao login (uma vez:
  // sem usuário no estado, novos 401 não redirecionam, então não há laço). Senha provisória
  // (403 PASSWORD_CHANGE_REQUIRED) leva a /password.
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (axios.isAxiosError(error) && error.response) {
          const requestUrl = error.config?.url ?? '';
          const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => requestUrl.includes(endpoint));
          if (error.response.status === 401 && !isAuthEndpoint && userRef.current) {
            userRef.current = null;
            setUser(null);
            router.replace('/login');
          } else if (
            error.response.status === 403 &&
            error.response.data?.code === 'PASSWORD_CHANGE_REQUIRED' &&
            window.location.pathname !== '/password'
          ) {
            router.replace('/password');
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptorId);
  }, [router]);

  const login = async (cpf: string, password: string): Promise<LoginResult> => {
    try {
      const response = await axios.post(
        `${API_URL}/usuarios/login`,
        { cpf: cpf.replace(/\D/g, ''), password },
        { timeout: 10000 }
      );
      const loggedUser = response.data.user as User;
      setUser(loggedUser);
      return { ok: true, user: loggedUser };
    } catch (error) {
      return { ok: false, message: loginErrorMessage(error) };
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/usuarios/logout`, null, { timeout: 10000 });
    } catch {
      // A sessão local é descartada de qualquer forma.
    }
    setUser(null);
  };

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    if (user.role === UserRole.DEV) return true; // Dev tem acesso a tudo
    return user.role === role;
  };

  const canAccessUsers = user?.role === UserRole.DEV || user?.role === UserRole.ADMIN;

  const updateUserTheme = (theme: 'light' | 'dark') => {
    setUser((current) => (current ? { ...current, theme_preference: theme } : current));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!user,
        hasRole,
        canAccessUsers,
        updateUserTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
