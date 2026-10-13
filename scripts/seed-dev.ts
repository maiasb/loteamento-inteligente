/**
 * Cria o usuário dev inicial (role dev, aprovado, ativo) com o mesmo hash scrypt da aplicação.
 *
 *   yarn seed:dev
 *
 * Variáveis: DEV_PASSWORD (obrigatória) e, opcionais, DEV_CPF, DEV_NAME, DEV_EMAIL. Lê o .env da
 * raiz sem sobrescrever variáveis já definidas no ambiente. Se o CPF já existe, não altera nada.
 * A senha nunca é impressa.
 */
export {};

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem .env: usa apenas as variáveis do ambiente do processo
  }

  // Imports dinâmicos: lib/db.ts lê as variáveis DB_* ao ser carregado
  const { getPool } = await import('../lib/db');
  const { hashPassword, validatePasswordPolicy } = await import('../lib/auth/password');

  const cpf = (process.env.DEV_CPF || '99999999998').replace(/\D/g, '');
  const name = process.env.DEV_NAME || 'Desenvolvedor';
  const email = process.env.DEV_EMAIL || 'dev@valedoscarajas.local';
  const password = process.env.DEV_PASSWORD;

  if (!password) throw new Error('DEV_PASSWORD não definido');
  const policyError = validatePasswordPolicy(password, cpf);
  if (policyError) throw new Error(`DEV_PASSWORD recusada: ${policyError}`);

  const pool = getPool();
  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE cpf = ? OR email = ?', [
      cpf,
      email,
    ]);
    if (Array.isArray(existing) && existing.length > 0) {
      process.stdout.write(`Usuário dev já existe (CPF ${cpf}); nada a fazer.\n`);
      return;
    }

    await pool.execute(
      `INSERT INTO users (cpf, name, email, phone, role, status, active, password, first_login)
       VALUES (?, ?, ?, '', 'dev', 'approved', 1, ?, 0)`,
      [cpf, name, email, await hashPassword(password)]
    );
    process.stdout.write(`Usuário dev criado (CPF ${cpf}).\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(
    `Falha ao criar o usuário dev: ${error instanceof Error ? error.message : error}\n`
  );
  process.exit(1);
});
