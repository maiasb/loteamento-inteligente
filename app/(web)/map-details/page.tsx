'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import MapDetails from '@/components/MapDetails';

export default function AdminMapDetailsPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Vendedores não têm acesso ao gerenciamento detalhado de mapas
    if (user?.role === UserRole.VENDEDOR) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Não renderizar nada se for vendedor
  if (user?.role === UserRole.VENDEDOR) {
    return null;
  }

  return <MapDetails />;
}
