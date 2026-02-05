'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, canAccessUsers } = useAuth();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Estado para controlar visibilidade do sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Inicializar showLotManagement como false para evitar hydration mismatch
  const [showLotManagement, setShowLotManagement] = useState(false);

  // Garantir que o componente está montado antes de renderizar
  useEffect(() => {
    setMounted(true);
    // Dar tempo para o AuthContext restaurar a sessão do localStorage
    const timer = setTimeout(() => {
      setIsCheckingAuth(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Após montar, verificar localStorage (apenas no cliente)
  useEffect(() => {
    if (mounted) {
      const visited = localStorage.getItem('hasVisitedMapManagement') === 'true';
      if (visited) {
        setShowLotManagement(true);
      }
    }
  }, [mounted]);

  // Fechar sidebar ao mudar de página em mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Validar sessão e redirecionar
  useEffect(() => {
    // Não verificar até que a checagem de autenticação termine
    if (isCheckingAuth) return;
    
    if (!isAuthenticated && pathname !== '/login') {
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router, isCheckingAuth]);

  // Marcar como visitado quando entrar em map-details
  useEffect(() => {
    if (mounted && pathname === '/map-details' && !showLotManagement) {
      localStorage.setItem('hasVisitedMapManagement', 'true');
      setShowLotManagement(true);
    }
  }, [pathname, showLotManagement, mounted]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getRoleBadge = () => {
    if (!user) return null;

    const styles = {
      [UserRole.DEV]: 'bg-purple-500 text-white border-purple-600 shadow-md',
      [UserRole.ADMIN]: 'bg-blue-500 text-white border-blue-600 shadow-md',
      [UserRole.VENDEDOR]: 'bg-emerald-500 text-white border-emerald-600 shadow-md',
    };

    const labels = {
      [UserRole.DEV]: 'DEV',
      [UserRole.ADMIN]: 'Admin',
      [UserRole.VENDEDOR]: 'Vendedor',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[user.role]}`}>
        {labels[user.role]}
      </span>
    );
  };

  // Não renderizar até montar no cliente (evita hydration mismatch)
  // if (!mounted || isCheckingAuth) {
  //   return (
  //     <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
  //         <p className="text-[var(--foreground)] opacity-70">Carregando...</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (!isAuthenticated || !user) {
    return null;
  }

  const isActive = (path: string) => {
    if (!pathname) return false;
    
    // Comparação exata para rotas específicas
    if (pathname === path) return true;
    
    // Para rotas com sub-páginas, verifica se começa com path seguido de /
    // Isso garante que /dashboard não ative /dashboard-admin por exemplo
    if (pathname.startsWith(path + '/')) return true;
    
    return false;
  };

  // Verificar se há ferramentas disponíveis para o usuário
  const hasToolsAvailable = user.role !== UserRole.VENDEDOR || canAccessUsers;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <ThemeToggle />
      <div className="flex">
        {/* Overlay para mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50
          w-64 bg-[var(--card-bg)] border-r border-[var(--border)] shadow-[var(--shadow-md)] flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Header do Sidebar */}
          <div className="flex-shrink-0 p-6 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <img 
                  src={theme === 'light' ? '/simbolo-logotipo-epiteto-verde.svg' : '/simbolo-logotipo-epiteto.svg'}
                  alt="Imobiliária Vale dos Carajás" 
                  className="h-auto w-auto"
                />
              </div>
              {/* Botão fechar (mobile) */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Fechar menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Área de Navegação com Scroll */}
          <div className="flex-1 overflow-y-auto">
            <nav className="p-4 space-y-2">
            {/* Dashboard - apenas para ADMIN e DEV */}
            {user.role !== UserRole.VENDEDOR && (
              <Link
                href="/dashboard"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all cursor-pointer ${
                  isActive('/dashboard')
                    ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white shadow-[var(--shadow-md)]'
                    : 'text-[var(--foreground)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-sm)]'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Dashboard</span>
              </Link>
            )}

            {/* Mapas e Lotes - para todos */}
            <Link
              href="/maps"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all cursor-pointer ${
                isActive('/maps')
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white shadow-[var(--shadow-md)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-sm)]'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>Reservar Lotes</span>
            </Link>

            {/* Reservas - para todos */}
            <Link
              href="/reservations"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all cursor-pointer ${
                isActive('/reservations')
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white shadow-[var(--shadow-md)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-sm)]'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>{user.role === UserRole.VENDEDOR ? 'Minhas Vendas e Reservas' : 'Vendas e Reservas'}</span>
            </Link>
          </nav>

          {/* Divider */}
          <div className="px-4 py-4">
            <div className="border-t border-[var(--border)]"></div>
          </div>

          {/* Legacy Links (mantém compatibilidade com páginas antigas) */}
          {/* Apenas mostrar seção FERRAMENTAS se houver pelo menos uma ferramenta disponível */}
          {hasToolsAvailable && (
            <div className="px-4 pb-4">
              <p className="text-xs font-bold text-[var(--foreground)]/60 mb-2 px-4">FERRAMENTAS</p>
              <div className="space-y-1">
                {/* Gerenciamento de Mapas - apenas DEV e ADMIN */}
                {user.role !== UserRole.VENDEDOR && (
                  <>
                    <Link
                      href="/map-details"
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                        isActive('/map-details')
                          ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white shadow-[var(--shadow-md)]'
                          : 'text-[var(--foreground)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-sm)]'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span>Gerenciar Loteamentos</span>
                    </Link>
                    <Link
                      href="/import-map"
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                        isActive('/import-map')
                          ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white shadow-[var(--shadow-md)]'
                          : 'text-[var(--foreground)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-sm)]'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Importar Loteamento</span>
                    </Link>
                    {showLotManagement && (
                      <Link
                        href="/lot-management"
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                          isActive('/lot-management')
                            ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white shadow-[var(--shadow-md)]'
                            : 'text-[var(--foreground)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-sm)]'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Editar Lotes</span>
                      </Link>
                    )}
                  </>
                )}
                {canAccessUsers && (
                  <Link
                    href="/users"
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                      isActive('/users')
                        ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white shadow-[var(--shadow-md)]'
                        : 'text-[var(--foreground)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-sm)]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Usuários</span>
                  </Link>
                )}
              </div>
            </div>
          )}
          </div>

          {/* User Info & Logout - Sempre Visível */}
          <div className="flex-shrink-0 border-t border-[var(--border)] p-4">
            <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                  {user?.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">{user?.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getRoleBadge()}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          {/* Header com botão de menu (mobile) */}
          <div className="lg:hidden sticky top-0 z-30 bg-[var(--card-bg)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-[var(--foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--surface)]/50 rounded-lg transition-colors"
                aria-label="Abrir menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-sm font-bold text-[var(--foreground)]">Admin</h1>
                  <p className="text-xs text-[var(--foreground)]/60">Vale dos Carajás</p>
                </div>
              </div>
            </div>
            
            {/* Theme Toggle Mobile */}
            <ThemeToggle variant="inline" />
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
