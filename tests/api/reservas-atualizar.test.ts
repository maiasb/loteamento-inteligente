import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/api/reservas/atualizar/route';
import { jsonRequest, sqlOf, useFakePool, type FakeConnection } from '../helpers/db';

vi.mock('@/lib/db', () => ({ getPool: vi.fn() }));

const base = {
  id: 1,
  customer_name: 'Cliente',
  seller_name: 'Vendedor',
  userRole: 'vendedor',
  lots: [],
};
const atualizar = (payload: unknown) => PUT(jsonRequest('/api/reservas/atualizar', 'PUT', payload));

describe('PUT /api/reservas/atualizar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakePool();
    conn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const statusNoBanco = (status: string) => conn.execute.mockResolvedValueOnce([[{ status }]]);

  it('exige id, cliente e vendedor', async () => {
    expect((await atualizar({ ...base, id: undefined })).status).toBe(400);
    expect((await atualizar({ ...base, customer_name: '' })).status).toBe(400);
    expect((await atualizar({ ...base, seller_name: '' })).status).toBe(400);
  });

  it('lê o status do banco com FOR UPDATE e retorna 404 se a reserva não existe', async () => {
    conn.execute.mockResolvedValueOnce([[]]);
    expect((await atualizar(base)).status).toBe(404);
    expect(sqlOf(conn.execute.mock.calls[0])).toBe(
      'SELECT status FROM purchase_requests WHERE id = ? FOR UPDATE'
    );
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('vendedor não edita reserva concluída ou cancelada, mesmo que o corpo diga "pending"', async () => {
    for (const atual of ['completed', 'cancelled']) {
      statusNoBanco(atual);
      expect((await atualizar({ ...base, status: 'pending' })).status).toBe(403);
    }
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(2);
  });

  it('vendedor edita reserva pendente e admin edita qualquer uma', async () => {
    statusNoBanco('pending');
    expect((await atualizar(base)).status).toBe(200);
    statusNoBanco('completed');
    expect((await atualizar({ ...base, userRole: 'admin' })).status).toBe(200);
    expect(conn.commit).toHaveBeenCalledTimes(2);
  });

  it('edita reserva cancelada que ficou sem lotes (lote excluído)', async () => {
    statusNoBanco('cancelled');
    expect((await atualizar({ ...base, userRole: 'admin', lots: [] })).status).toBe(200);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  it('grava telefone e CPF só com dígitos', async () => {
    statusNoBanco('pending');
    await atualizar({
      ...base,
      customer_phone: '(94) 99999-0000',
      customer_cpf: '123.456.789-09',
      seller_phone: '(94) 98888-0000',
      seller_cpf: '987.654.321-00',
    });
    const params = conn.execute.mock.calls[1][1];
    expect(params[2]).toBe('94999990000');
    expect(params[3]).toBe('12345678909');
    expect(params[9]).toBe('94988880000');
    expect(params[10]).toBe('98765432100');
  });

  it('preserva preço e entrada zero (usa ??) e converte parcelas 0 em NULL', async () => {
    statusNoBanco('pending');
    await atualizar({
      ...base,
      lots: [{ id: 7, agreed_price: 0, firstPayment: 0, installments: 0, paymentMethod: 'cash' }],
    });
    expect(conn.execute.mock.calls[2][1]).toEqual([0, 0, null, 'cash', 1, 7]);
  });

  it('desfaz e retorna 400 quando o lote não pertence à reserva', async () => {
    statusNoBanco('pending');
    conn.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = await atualizar({ ...base, lots: [{ id: 99, agreed_price: 10 }] });
    expect(res.status).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('desfaz e libera a conexão em erro inesperado', async () => {
    conn.execute.mockRejectedValueOnce(new Error('falha'));
    expect((await atualizar(base)).status).toBe(500);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});
