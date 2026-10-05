import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/usuarios/criar/route';
import { jsonRequest, useFakeConnection, type FakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

const valid = {
  name: 'Maria',
  email: 'm@m.com',
  cpf: '529.982.247-25',
  phone: '(11) 99999-8888',
  password: 'abc123',
};

describe('POST /api/usuarios/criar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
  });

  it('exige os campos obrigatórios', async () => {
    const { password, ...semSenha } = valid;
    void password;
    expect((await POST(jsonRequest('/api/usuarios/criar', 'POST', semSenha))).status).toBe(400);
  });

  it('retorna 409 quando CPF ou e-mail já existem', async () => {
    conn.execute.mockResolvedValueOnce([[{ count: 1 }]]);
    const res = await POST(jsonRequest('/api/usuarios/criar', 'POST', valid));
    expect(res.status).toBe(409);
    expect(conn.execute).toHaveBeenCalledTimes(1);
  });

  it('cria usuário vendedor pendente, com CPF e telefone só com dígitos', async () => {
    conn.execute.mockResolvedValueOnce([[{ count: 0 }]]).mockResolvedValueOnce([{ insertId: 7 }]);
    const res = await POST(jsonRequest('/api/usuarios/criar', 'POST', valid));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.user).toMatchObject({
      id: 7,
      cpf: '52998224725',
      role: 'vendedor',
      status: 'pending',
    });
    const params = conn.execute.mock.calls[1][1] as unknown[];
    expect(params).toContain('11999998888');
    expect(params).not.toContain('abc123');
  });
});
