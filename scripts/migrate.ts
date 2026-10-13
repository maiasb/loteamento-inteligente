/**
 * Roda as migrations de migrations/*.sql com o runner de lib/migrations.ts.
 *
 *   yarn migrate          executa as pendentes
 *   yarn migrate status   lista executadas e pendentes
 *
 * Lê o .env da raiz (sem sobrescrever variáveis já definidas no ambiente).
 */
async function main() {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem .env: usa apenas as variáveis do ambiente do processo
  }

  // Import dinâmico: lib/db.ts lê as variáveis DB_* ao ser carregado
  const { getPool } = await import('../lib/db');
  const { runPendingMigrations, showMigrationsStatus } = await import('../lib/migrations');
  const pool = getPool();

  try {
    if (process.argv[2] === 'status') {
      const statuses = await showMigrationsStatus();
      for (const { name, executed, fileMissing } of statuses) {
        const label = fileMissing ? 'arquivo ausente' : executed ? 'executada' : 'pendente';
        process.stdout.write(`${label.padEnd(16)} ${name}\n`);
      }
    } else {
      await runPendingMigrations();
      const pending = (await showMigrationsStatus()).filter((m) => !m.executed);
      process.stdout.write(
        pending.length === 0
          ? 'Banco atualizado.\n'
          : `${pending.length} migration(s) pendente(s).\n`
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(
    `Falha ao rodar migrations: ${error instanceof Error ? error.message : error}\n`
  );
  process.exitCode = 1;
});
