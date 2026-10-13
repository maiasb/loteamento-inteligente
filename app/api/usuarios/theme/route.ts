import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { requireUser } from '@/lib/auth/guard';
import { errorResponse, readJsonBody } from '@/lib/auth/request';

export const dynamic = 'force-dynamic';

/** PUT /api/usuarios/theme  { theme }: altera só o tema do usuário da sessão. */
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    const theme = body?.theme;
    if (theme !== 'light' && theme !== 'dark') {
      return errorResponse('Tema inválido. Use "light" ou "dark"', 400);
    }

    await executeQuery('UPDATE users SET theme_preference = ? WHERE id = ?', [theme, auth.user.id]);
    return NextResponse.json({ success: true, theme });
  } catch (error) {
    console.error(
      '[API /usuarios/theme PUT] Erro:',
      error instanceof Error ? error.message : error
    );
    return errorResponse('Erro ao atualizar preferência de tema', 500);
  }
}
