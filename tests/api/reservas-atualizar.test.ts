import mysql from 'mysql2/promise';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/api/reservas/atualizar/route';
import { jsonRequest, useFakeConnection, type FakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

const base = {
  id: 1,
  customer_name: 'Cliente',
  seller_name: 'Vendedor',
  status: 'pending',
  userRole: 'vendedor',
  lots: [],
};
const atualizar = (payload: unknown) => PUT(jsonRequest('/api/reservas/atualizar', 'PUT', payload));

describe('PUT /api/reservas/atualizar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
    conn.execute.mockResolvedValue([{}]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('exige id, cliente e vendedor', async () => {
    expect((await atualizar({ ...base, id: undefined })).status).toBe(400);
    expect((await atualizar({ ...base, customer_name: '' })).status).toBe(400);
    expect((await atualizar({ ...base, seller_name: '' })).status).toBe(400);
  });

  it('vendedor não edita reserva concluída ou cancelada', async () => {
    expect((await atualizar({ ...base, status: 'completed' })).status).toBe(403);
    expect((await atualizar({ ...base, status: 'cancelled' })).status).toBe(403);
    expect(mysql.createConnection).not.toHaveBeenCalled();
  });

  it('vendedor edita reserva pendente e admin edita qualquer uma', async () => {
    expect((await atualizar(base)).status).toBe(200);
    expect((await atualizar({ ...base, status: 'completed', userRole: 'admin' })).status).toBe(200);
  });
});
