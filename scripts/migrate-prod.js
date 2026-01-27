#!/usr/bin/env node

/**
 * Script de migrations para produção (sem TypeScript)
 * Usa apenas JavaScript compilado do Next.js build
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Configuração do banco de dados a partir de variáveis de ambiente
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
};

// Validar configurações necessárias
if (!dbConfig.user || !dbConfig.password || !dbConfig.database) {
  console.error('❌ Erro: Variáveis de ambiente DB_USER, DB_PASSWORD e DB_NAME são obrigatórias');
  process.exit(1);
}

async function getConnection() {
  try {
    return await mysql.createConnection(dbConfig);
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:', error.message);
    throw error;
  }
}

async function ensureMigrationsTable(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations(connection) {
  const [rows] = await connection.execute('SELECT name FROM _migrations ORDER BY executed_at');
  return rows.map(row => row.name);
}

async function getMigrationFiles() {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  
  try {
    const files = await fs.readdir(migrationsDir);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠️  Diretório migrations/ não encontrado. Criando...');
      await fs.mkdir(migrationsDir, { recursive: true });
      return [];
    }
    throw error;
  }
}

async function executeMigration(connection, filename, content) {
  // Dividir por ponto e vírgula, mas ignorar comentários
  const statements = content
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement) {
      await connection.execute(statement);
    }
  }
}

async function runPendingMigrations() {
  let connection;
  
  try {
    console.log('🔌 Conectando ao banco de dados...');
    connection = await getConnection();
    
    console.log('📋 Verificando tabela de migrations...');
    await ensureMigrationsTable(connection);
    
    console.log('📁 Buscando arquivos de migration...');
    const allMigrations = await getMigrationFiles();
    const executedMigrations = await getExecutedMigrations(connection);
    
    const pendingMigrations = allMigrations.filter(
      file => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ Nenhuma migration pendente');
      return;
    }

    console.log(`\n📝 ${pendingMigrations.length} migration(s) pendente(s):\n`);
    
    for (const filename of pendingMigrations) {
      console.log(`   → ${filename}`);
    }
    
    console.log('\n🚀 Executando migrations...\n');

    for (const filename of pendingMigrations) {
      try {
        console.log(`⏳ Executando: ${filename}...`);
        
        const filepath = path.join(process.cwd(), 'migrations', filename);
        const content = await fs.readFile(filepath, 'utf8');
        
        await executeMigration(connection, filename, content);
        
        await connection.execute(
          'INSERT INTO _migrations (name) VALUES (?)',
          [filename]
        );
        
        console.log(`✅ Concluída: ${filename}`);
      } catch (error) {
        console.error(`\n❌ Erro ao executar ${filename}:`, error.message);
        throw error;
      }
    }

    console.log('\n✨ Todas as migrations foram executadas com sucesso!\n');
  } catch (error) {
    console.error('\n❌ Erro durante execução das migrations:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function showMigrationsStatus() {
  let connection;
  
  try {
    console.log('🔌 Conectando ao banco de dados...');
    connection = await getConnection();
    
    await ensureMigrationsTable(connection);
    
    const allMigrations = await getMigrationFiles();
    const executedMigrations = await getExecutedMigrations(connection);

    console.log('\n📊 Status das Migrations:\n');
    console.log('─'.repeat(70));
    
    if (allMigrations.length === 0) {
      console.log('⚠️  Nenhuma migration encontrada');
    } else {
      allMigrations.forEach(file => {
        const status = executedMigrations.includes(file) ? '✅ Executada' : '⏳ Pendente';
        console.log(`${status.padEnd(15)} ${file}`);
      });
    }
    
    console.log('─'.repeat(70));
    console.log(`\nTotal: ${allMigrations.length} | Executadas: ${executedMigrations.length} | Pendentes: ${allMigrations.length - executedMigrations.length}`);
    console.log('');
  } catch (error) {
    console.error('❌ Erro ao buscar status:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Executar comando
const command = process.argv[2];

async function main() {
  switch (command) {
    case 'run':
    case undefined:
      await runPendingMigrations();
      break;

    case 'status':
      await showMigrationsStatus();
      break;

    default:
      console.log('Uso:');
      console.log('  node scripts/migrate-prod.js run     - Executa migrations pendentes');
      console.log('  node scripts/migrate-prod.js status  - Mostra status das migrations');
      process.exit(1);
  }
}

main();
