'use client';

import { Suspense } from 'react';
import LotManagement from '@/components/LotManagement';

export default function LotManagementPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Carregando...</div>}>
      <LotManagement />
    </Suspense>
  );
}
