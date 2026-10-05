# Executado pelo entrypoint do MariaDB (carregado com `source`) apenas na primeira subida,
# com o volume vazio. Roda as migrations em ordem e cria o usuário dev inicial.

hex() { printf %s "$1" | od -An -tx1 | tr -d ' \n'; }

for f in /migrations/*.sql; do
  mysql_note "migration: $(basename "$f")"
  docker_process_sql < "$f"
done

if [ -z "$DEV_PASSWORD" ]; then
  mysql_warn "DEV_PASSWORD não definido: usuário dev não criado"
else
  mysql_note "criando usuário dev (CPF $DEV_CPF)"
  PASS_MD5=$(printf %s "$DEV_PASSWORD" | md5sum | cut -d' ' -f1)
  docker_process_sql <<SQL
INSERT INTO users (cpf, name, email, phone, role, status, active, password, first_login)
VALUES (
  '$DEV_CPF',
  CONVERT(UNHEX('$(hex "$DEV_NAME")') USING utf8mb4),
  CONVERT(UNHEX('$(hex "$DEV_EMAIL")') USING utf8mb4),
  '', 'dev', 'approved', 1, '$PASS_MD5', 0
);
SQL
fi
