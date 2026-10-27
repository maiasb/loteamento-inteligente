'use client';

import { useEffect } from 'react';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Force light theme for login page
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  return <>{children}</>;
}
