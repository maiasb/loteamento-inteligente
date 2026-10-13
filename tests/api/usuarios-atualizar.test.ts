import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/usuarios/atualizar/[id]/route';
import { executeQuery } from '@/lib/db';
import { sqlOf } from '../helpers/db';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn() }));

const query = vi.mocked(executeQuery);
const atualizar = (qs: string, id = '4') =>
  PUT(new NextRequest(`http://localhost/api/usuarios/atualizar/${id}${qs}`, { method: 'PUT' }), {
    params: Promise.resolve({ id }),
  });

describe('PUT /api/usuarios/atualizar/[id]', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('exige ao menos um campo', async () => {
    expect((await atualizar('')).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('valida o role como em usuarios/role', async () => {
    const res = await atualizar('?role=superuser');
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
    for (const role of ['dev', 'admin', 'vendedor']) {
      query.mockResolvedValueOnce({ affectedRows: 1 } as never);
      expect((await atualizar(`?role=${role}`)).status).toBe(200);
    }
  });

  it('grava CPF e telefone só com dígitos', async () => {
    query.mockResolvedValueOnce({ affectedRows: 1 } as never);
    await atualizar('?cpf=123.456.789-09&phone=(94)%2099999-0000');
    expect(sqlOf(query.mock.calls[0])).toContain('cpf = ?, phone = ?');
    expect(query.mock.calls[0][1]).toEqual(['12345678909', '94999990000', '4']);
  });

  it('retorna 404 quando nenhum usuário foi atualizado', async () => {
    query.mockResolvedValueOnce({ affectedRows: 0 } as never);
    expect((await atualizar('?name=Ana', '999')).status).toBe(404);
  });

  it('retorna 409 para e-mail ou CPF já cadastrado', async () => {
    query.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    expect((await atualizar('?email=a@b.c')).status).toBe(409);
  });

  it('retorna 500 em erro inesperado', async () => {
    query.mockRejectedValueOnce(new Error('falha'));
    expect((await atualizar('?name=Ana')).status).toBe(500);
  });
});
