import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth/password';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitedResponse,
  recordAttempt,
} from '@/lib/auth/rate-limit';
import { assertSameOrigin, errorResponse, getClientIp, readJsonBody } from '@/lib/auth/request';
import { parseUserFields } from '@/lib/auth/user-input';

export const dynamic = 'force-dynamic';

const DUPLICATE = 'CPF ou email já cadastrado';

/**
 * POST /api/usuarios/criar: cadastro público. Grava SEMPRE vendedor / pending / first_login=1;
 * role, status, active e first_login do corpo são ignorados (RN-12).
 */
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(RATE_LIMITS.registerIp, ip);
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfter);
    await recordAttempt(RATE_LIMITS.registerIp, ip);

    const body = await readJsonBody(request);
    if (!body) return errorResponse('Dados obrigatórios: name, email, cpf, phone, password', 400);

    const fields = parseUserFields(body);
    if (!fields.ok) return errorResponse(fields.error, 400);
    const { name, email, cpf, phone, creci } = fields.data;

    const passwordError = validatePasswordPolicy(body.password, cpf);
    if (passwordError) return errorResponse(passwordError, 400);

    const hashedPassword = await hashPassword(body.password as string);

    await executeQuery(
      `INSERT INTO users (name, email, cpf, phone, creci, role, status, password, first_login)
       VALUES (?, ?, ?, ?, ?, 'vendedor', 'pending', ?, 1)`,
      [name, email, cpf, phone, creci, hashedPassword]
    );

    return NextResponse.json(
      { message: 'Cadastro realizado. Aguarde a aprovação do administrador.' },
      { status: 201 }
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
      return errorResponse(DUPLICATE, 409);
    }
    console.error('[API /usuarios/criar] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao criar usuário', 500);
  }
}
