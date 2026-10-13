# Executado pelo entrypoint oficial do MySQL (carregado com `source`) apenas na primeira subida,
# com o volume vazio. Roda as migrations em ordem. O usuário dev inicial NÃO é criado aqui:
# use `yarn seed:dev` (scripts/seed-dev.ts), que grava a senha com o hash scrypt da aplicação.

docker_process_sql <<'SQL'
CREATE TABLE IF NOT EXISTS migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_executed_at (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL

# Registra cada arquivo aplicado para que `yarn migrate` não o reexecute
for f in /migrations/*.sql; do
  mysql_note "migration: $(basename "$f")"
  docker_process_sql < "$f"
  docker_process_sql <<SQL
INSERT INTO migrations (name) VALUES ('$(basename "$f")');
SQL
done
