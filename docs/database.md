# Banco de dados

**MariaDB** (InnoDB, `utf8mb4_unicode_ci`), acessado com `mysql2` e SQL cru. As migrations usam
`ADD COLUMN IF NOT EXISTS` e `DROP ... IF EXISTS`, sintaxe que o MySQL 8 não aceita; o ambiente
Docker usa `mariadb:11`. Configuração em `lib/db.ts` (`DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME`; pool de 5 conexões).

## Origem do schema

O banco original foi perdido e não há dump. O schema atual é o resultado das migrations 001–014.
As migrations 001–012 não bastavam para o código; a **013** e a **014** (spec
[007](specs/007-reconciliacao-schema.md)) alinham o schema ao que as rotas de `app/api` consultam.
Se o banco original diferia disso, a fonte de verdade passa a ser a 013.

Validado em 2026-10-05: num MariaDB vazio, 001 → 013 rodam sem erro, a 013 pode ser reexecutada, e
cadastro, login, criação de mapa, quadra e lote, reserva e dashboard funcionam.

## Tabelas

| Tabela                  | Papel                                                             | Relacionamentos                                           |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| `users`                 | Usuários do sistema                                               | 1:N `purchase_requests` (`user_id`, `ON DELETE SET NULL`) |
| `maps`                  | Loteamentos (`id BIGINT`, gerado pela aplicação com `Date.now()`) | 1:N `blocks`, 1:N `lots`                                  |
| `blocks`                | Quadras                                                           | N:1 `maps` (`mapId`, CASCADE)                             |
| `lots`                  | Lotes                                                             | N:1 `maps` (`map_id`) e `blocks` (`block_id`), CASCADE    |
| `purchase_requests`     | Reserva/solicitação de compra                                     | N:N com `lots` via `purchase_request_lots`                |
| `purchase_request_lots` | Lotes de cada reserva, com valores por lote                       | FK `purchase_request_id`, `lot_id`                        |
| `migrations`            | Controle do runner `lib/migrations.ts` (criada por ele)           | —                                                         |

Views: `vw_map_statistics`, `vw_lot_details` (criadas na 001).

### Colunas principais

- **users:** `id`, `cpf` (único, só dígitos; é o login), `name`, `email` (único), `phone`, `creci`,
  `password` (hash), `role` (`dev|admin|vendedor`), `status` (`pending|approved|rejected`),
  `active`, `first_login`, `theme_preference` (`light|dark`), timestamps. `username`,
  `first_name`, `last_name` vêm da 001, são opcionais e o código não os usa.
- **maps:** `id`, `name`, `description`, `image_url`, `width`, `height`, `address`,
  `overlay_config` (JSON), `status`, `location`, `total_area`, `pdf_url`, timestamps.
- **blocks:** `id`, `mapId`, `name`, `identifier` (opcional), `description`, `createdAt`,
  `updatedAt`. Usa camelCase, diferente das demais tabelas.
- **lots:** `id BIGINT UNSIGNED`, `map_id`, `block_id` (opcional), `lot_number`, `size`, `price`,
  `status` (`available|reserved|sold|unavailable|blocked`), `description`, `features` (JSON),
  `coordinates` (JSON), timestamps.
- **purchase_requests:** `id`, `user_id`, `customer_name`, `customer_email`, `customer_phone`,
  `customer_cpf`, `message`, `payment_method` (texto, formas separadas por vírgula), `seller_name`, `seller_email`, `seller_phone`,
  `seller_cpf`, `contract`, `status` (`pending|approved|rejected|completed|cancelled`),
  timestamps. `lot_id` e `map_id` existem mas são opcionais e o código não os preenche (a ligação
  com lotes é feita por `purchase_request_lots`).
- **purchase_request_lots:** `purchase_request_id`, `lot_id`, `agreed_price`, `first_payment`,
  `installments`, `payment_method` (texto, formas separadas por vírgula).

## Convenções

- Tabelas em snake_case, plural, inglês. Colunas em snake_case, exceto `blocks` (camelCase).
- FKs `<entidade>_id`, `ON DELETE CASCADE` nas relações de mapa.
- Timestamps `created_at` e `updated_at`. Valores monetários em `DECIMAL`.
- CPF e telefone gravados só com dígitos.

## Inconsistências encontradas

| Caso                                                                               | Recomendação                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `lots.status` aceita `unavailable` (001) e `blocked` (013); o código usa `blocked` | Unificar em `blocked` numa spec, ajustando dados e ENUM      |
| `blocks` em camelCase                                                              | Manter em código existente; em tabelas novas usar snake_case |
| Numeração 001–007 e depois 012 a 014; datas dos comentários fora de ordem          | Próxima migration: 015                                       |
| `purchase_requests.lot_id`/`map_id` e `users.username` sem uso                     | Remover numa spec futura, após confirmar                     |
| Quatro formas de acessar o banco                                                   | Padrão: `executeQuery` de `lib/db.ts`                        |
| Hash de senha MD5 (login) e SHA-256 (`password/reset`)                             | Spec própria de autenticação                                 |
| `POST /api/usuarios/criar` aceita `role` e `status` do corpo                       | Spec própria de autenticação                                 |

## Subir um banco novo

Só Docker é necessário (sem Node, yarn ou MariaDB instalados):

```bash
cp .env.example .env     # preencher DB_PASSWORD e DEV_PASSWORD (demais campos têm padrão)
docker compose up --build
```

Com o volume vazio, `docker/db-init.sh` executa `migrations/*.sql` em ordem (falha interrompe a
inicialização) e cria o usuário dev. `DB_HOST_PORT` define a porta do banco no host (padrão 3306).
`docker compose down -v` apaga os dados e a próxima subida recria tudo. Detalhes em
[specs/006-docker.md](specs/006-docker.md).

Os `.sql` rodam fora do runner `lib/migrations.ts`; a tabela `migrations` não é preenchida.

### Usuário dev inicial

Criado na primeira subida, com as variáveis do `.env` (a senha nunca fica no repositório):

| Variável       | Padrão                                                          |
| -------------- | --------------------------------------------------------------- |
| `DEV_CPF`      | `99999999998` (CPF de desenvolvimento aceito por `validateCPF`) |
| `DEV_NAME`     | `Desenvolvedor`                                                 |
| `DEV_EMAIL`    | `dev@valedoscarajas.local`                                      |
| `DEV_PASSWORD` | obrigatória, sem padrão                                         |

O usuário nasce `role = 'dev'`, `status = 'approved'`, `first_login = 0`; o login é pelo CPF. Para
criar ou promover alguém depois, com o banco já existente:

```sql
UPDATE users SET status = 'approved', role = 'dev' WHERE cpf = '<cpf só com dígitos>';
```

## Migrations

- Arquivos `migrations/NNN_descricao.sql`, executados em ordem alfabética. `lib/migrations.ts`
  divide cada arquivo por `;` (evite `;` dentro de strings ou procedures).
- **Não existe script de linha de comando** no `package.json`, apesar de o deploy chamar
  `npm run migrate` e `npm run migrate:status`.
- Escreva migrations idempotentes (`IF NOT EXISTS`/`IF EXISTS`) e documente cada uma em
  `migrations/CHANGELOG.md`.
- Não editar migration já aplicada. Exceção registrada: a 007 foi corrigida porque nunca concluía
  num banco novo.
- Antes de alterar tipos de chave ou FKs num banco com dados, faça backup.

## Cuidados com dados

- Sempre SQL parametrizado (`?`). Usar transação (`beginTransaction`) quando alterar mais de uma
  tabela, como em `lotes/reservar`.
- Excluir mapa, quadra ou lote apaga em cascata lotes e reservas ligados. As rotas de exclusão de
  quadra e de lote recusam quando há lotes `reserved` ou `sold`.
- Dados de clientes (CPF, e-mail, telefone) são pessoais; não registrar em logs.
- Sem rotina de backup versionada: definir uma antes de usar em produção.
