'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useIsMounted } from '@/hooks/useIsMounted';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const mounted = useIsMounted();

  useEffect(() => {
    // Aplicar tema padrão ao montar
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  // Função pública para atualizar tema (usada pelo AuthContext)
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    return newTheme;
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Retornar valor padrão em vez de lançar erro
    return {
      theme: 'light' as Theme,
      toggleTheme: () => 'light' as Theme,
      setTheme: () => {},
    };
  }
  return context;
}
