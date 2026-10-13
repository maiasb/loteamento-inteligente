import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { toPublicUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** GET /api/usuarios/me: usuário da sessão (papel e situação lidos do banco). */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request, { allowPasswordChange: true });
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ user: toPublicUser(auth.user) });
}
