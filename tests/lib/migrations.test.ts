import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';

import { createConnection } from '@/lib/db';
import { executeMigration, showMigrationsStatus } from '@/lib/migrations';

vi.mock('@/lib/db', () => ({ createConnection: vi.fn() }));

const connection = {
  query: vi.fn(),
  execute: vi.fn(),
  release: vi.fn(),
};

describe('executeMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.query.mockResolvedValue([]);
    connection.execute.mockResolvedValue([]);
    vi.mocked(createConnection).mockResolvedValue(connection as never);
  });

  it('não descarta o primeiro statement quando o arquivo começa com comentário', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '-- cabeçalho\n-- outro comentário\nCREATE TABLE a (id INT);\n-- meio\nALTER TABLE a ADD b INT;\n'
    );
    await executeMigration('999_teste.sql');
    expect(connection.query.mock.calls.map((c) => c[0])).toEqual([
      'CREATE TABLE a (id INT)',
      'ALTER TABLE a ADD b INT',
    ]);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('libera a conexão uma única vez quando um statement falha e não registra a migration', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      'CREATE TABLE a (id INT);\nALTER TABLE a ADD b INT;'
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    connection.query.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('falha no ALTER'));

    await expect(executeMigration('999_teste.sql')).rejects.toThrow('falha no ALTER');
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(connection.execute).not.toHaveBeenCalled();
  });
});

describe('showMigrationsStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createConnection).mockResolvedValue(connection as never);
    connection.execute.mockResolvedValue([[]]);
  });

  it('lista executadas, pendentes e registradas sem arquivo', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['002_b.sql', '001_a.sql', '003_c.sql'] as never);
    connection.execute
      .mockResolvedValueOnce([[]]) // CREATE TABLE IF NOT EXISTS migrations
      .mockResolvedValueOnce([[{ name: '001_a.sql' }, { name: '000_antiga.sql' }]]);

    expect(await showMigrationsStatus()).toEqual([
      { name: '001_a.sql', executed: true, fileMissing: false },
      { name: '002_b.sql', executed: false, fileMissing: false },
      { name: '003_c.sql', executed: false, fileMissing: false },
      { name: '000_antiga.sql', executed: true, fileMissing: true },
    ]);
    expect(connection.release).toHaveBeenCalledTimes(2);
  });
});
