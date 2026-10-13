# Banco de dados

**MySQL 8.0.16+** (InnoDB, `utf8mb4_unicode_ci`; CHECK só é aplicado a partir da 8.0.16), acessado
com `mysql2` e SQL cru. As migrations usam só sintaxe do MySQL 8 (sem `IF NOT EXISTS` em `ALTER`),
não são idempotentes e rodam uma única vez por banco. Configuração em `lib/db.ts` (`DB_HOST`,
`DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; pool único em `globalThis`, 5 conexões, ociosas
fechadas após 60 s; `getPool()` falha com mensagem clara se faltar variável `DB_*`).

## Origem do schema

O banco original foi perdido e não há dump. Em outubro de 2026 o dono decidiu que produção é
**MySQL 8** (não MariaDB) e que o banco antigo não existe mais, então as migrations 001–014 foram
reescritas para MySQL 8, mantendo numeração e arquivos, e a **015** acrescentou integridade e
índices. Num banco vazio, 001 → 015 produzem o schema que o código de `app/api` usa. Não há
conversão de dados: as migrations assumem banco novo.

Validado em 2026-10-13 num MySQL 8.0.46 vazio: 001 → 015 rodam sem erro tanto pelo cliente `mysql`
quanto pelo runner (`scripts/migrate.ts`), e o rollback da 015 também foi executado.

Views: `vw_map_statistics` e `vw_lot_details` foram removidas (a 001 não as cria mais). O código
nunca as usou, a primeira multiplicava linhas (produto cartesiano de lotes e quadras) e a segunda
excluía lotes sem quadra.

## Tabelas

| Tabela                  | Papel                                                             | Relacionamentos                                           |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| `users`                 | Usuários do sistema                                               | 1:N `purchase_requests` (`user_id`, `ON DELETE SET NULL`) |
| `maps`                  | Loteamentos (`id BIGINT`, gerado pela aplicação com `Date.now()`) | 1:N `blocks`, 1:N `lots`                                  |
| `blocks`                | Quadras                                                           | N:1 `maps` (`mapId`, CASCADE)                             |
| `lots`                  | Lotes                                                             | N:1 `maps` (`map_id`) e `blocks` (`block_id`), CASCADE    |
| `purchase_requests`     | Reserva/solicitação de compra                                     | N:N com `lots` via `purchase_request_lots`                |
| `purchase_request_lots` | Lotes de cada reserva, com valores por lote                       | `purchase_request_id` (CASCADE), `lot_id` (**RESTRICT**)  |
| `migrations`            | Controle do runner `lib/migrations.ts` (criada por ele)           | —                                                         |

### Colunas principais

- **users:** `id`, `cpf` (único, só dígitos; é o login), `name`, `email` (único), `phone`, `creci`,
  `password` (hash), `role` (`dev|admin|vendedor`), `status` (`pending|approved|rejected`),
  `active`, `first_login`, `theme_preference` (`light|dark`), timestamps. `username`,
  `first_name`, `last_name` vêm da 001, são opcionais e o código não os usa.
- **maps:** `id`, `name`, `description`, `image_url`, `width`, `height`, `address`,
  `overlay_config` (JSON), `status`, `location`, `total_area`, `pdf_url`, timestamps.
- **blocks:** `id`, `mapId`, `name`, `identifier` (opcional), `description`, `coordinates` (JSON),
  `createdAt`, `updatedAt`. Usa camelCase, diferente das demais tabelas. `UNIQUE (mapId, name)`.
- **lots:** `id BIGINT UNSIGNED`, `map_id`, `block_id` (opcional: lote sem quadra é permitido),
  `block_key` (coluna gerada VIRTUAL, `IFNULL(block_id, 0)`), `lot_number`, `size`,
  `price DECIMAL(15,2)`, `status` (`available|reserved|sold|unavailable|blocked`), `description`,
  `features` (JSON), `coordinates` (JSON, ponto `{"lat": n, "lng": n}`), timestamps.
  `UNIQUE (map_id, block_key, lot_number)` impede número repetido na mesma quadra e também entre
  lotes sem quadra do mesmo mapa. CHECKs: `size >= 0`, `price >= 0`.
- **purchase_requests:** `id`, `user_id`, `customer_name`, `customer_email`, `customer_phone`,
  `customer_cpf`, `message`, `payment_method` (texto, formas separadas por vírgula), `seller_name`, `seller_email`, `seller_phone`,
  `seller_cpf`, `contract`, `status` (`pending|approved|rejected|completed|cancelled`),
  timestamps. `lot_id` e `map_id` existem mas são opcionais e o código não os preenche (a ligação
  com lotes é feita por `purchase_request_lots`).
- **purchase_request_lots:** `purchase_request_id`, `lot_id`, `agreed_price`, `first_payment`
  (ambos `DECIMAL(15,2)`), `installments`, `payment_method` (texto, formas separadas por vírgula).
  CHECKs: preços `>= 0`, `installments > 0`. `lot_id` é `ON DELETE RESTRICT`: um lote que já
  teve reserva (mesmo cancelada) não pode ser excluído, nem em cascata pela exclusão de quadra ou
  mapa.

## Convenções

- Tabelas em snake_case, plural, inglês. Colunas em snake_case, exceto `blocks` (camelCase).
- FKs `<entidade>_id`, `ON DELETE CASCADE` nas relações de mapa; `RESTRICT` em
  `purchase_request_lots.lot_id` (histórico de reservas).
- Timestamps `created_at` e `updated_at`. Valores monetários em `DECIMAL(15,2)`.
- Colunas `JSON`: o MySQL 8 devolve o valor já decodificado pelo `mysql2` (no MariaDB vinha como
  texto). Rotas novas devem aceitar os dois casos (`typeof v === 'string' ? JSON.parse(v) : v`).
- CPF e telefone gravados só com dígitos.

## Inconsistências encontradas

| Caso                                                                               | Recomendação                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `lots.status` aceita `unavailable` (001) e `blocked` (013); o código usa `blocked` | Unificar em `blocked` numa spec, ajustando dados e ENUM      |
| `blocks` em camelCase                                                              | Manter em código existente; em tabelas novas usar snake_case |
| Numeração 001–007 e depois 012 a 015 (008–011 nunca existiram)                     | Próxima migration: 016                                       |
| `purchase_requests.lot_id`/`map_id` (FKs CASCADE) e `users.username` sem uso       | Remover numa spec futura, após confirmar                     |
| Rotas antigas ainda usam `mysql.createConnection(dbConfig)`                        | Padrão: `executeQuery`/`getPool` de `lib/db.ts`              |
| Hash de senha MD5 (login) e SHA-256 (`password/reset`)                             | Spec própria de autenticação                                 |
| `POST /api/usuarios/criar` aceita `role` e `status` do corpo                       | Spec própria de autenticação                                 |

## Subir um banco novo

Só Docker é necessário (sem Node, yarn ou MySQL instalados):

```bash
cp .env.example .env     # preencher DB_PASSWORD e DEV_PASSWORD (demais campos têm padrão)
docker compose up --build
```

Com o volume vazio, `docker/db-init.sh` executa `migrations/*.sql` em ordem (falha interrompe a
inicialização) e cria o usuário dev. `DB_HOST_PORT` define a porta do banco no host (padrão 3306).
`docker compose down -v` apaga os dados e a próxima subida recria tudo. Detalhes em
[specs/006-docker.md](specs/006-docker.md).

Os `.sql` rodam fora do runner `lib/migrations.ts`; a tabela `migrations` não é preenchida. Como
as migrations não são idempotentes, **não rode `yarn migrate` num banco inicializado assim** sem
antes registrar os arquivos já aplicados na tabela `migrations`.

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
  ignora linhas que começam com `--` e divide o resto por `;` (evite `;` em strings, comentários
  de coluna e procedures).
- Comandos (`scripts/migrate.ts`, via `ts-node`, que lê o `.env` da raiz):
  - `yarn migrate`: executa as pendentes e registra cada uma na tabela `migrations`.
  - `yarn migrate status`: lista cada arquivo como executado ou pendente e avisa de migrations
    registradas cujo arquivo não existe mais.
- Cada migration traz no cabeçalho a descrição e o **rollback** (comentado). DDL do MySQL faz
  commit implícito: uma migration que falha no meio deixa o banco parcialmente alterado; em
  desenvolvimento recrie o banco, em produção restaure o backup e corrija a migration.
- Escreva SQL válido no MySQL 8 e linear (sem `IF [NOT] EXISTS` em `ALTER`/`CREATE INDEX`).
  Documente cada migration em `migrations/CHANGELOG.md`.
- Não editar migration já aplicada num banco com dados reais; crie a próxima. Antes de adicionar
  `UNIQUE`, `CHECK` ou `NOT NULL` a tabela com dados, procure violações (a 015 lista as consultas).
- Antes de alterar tipos de chave ou FKs num banco com dados, faça backup.

## Cuidados com dados

- Sempre SQL parametrizado (`?`). Usar transação (`beginTransaction`) quando alterar mais de uma
  tabela, como em `lotes/reservar`.
- Excluir mapa ou quadra apaga em cascata os lotes. As rotas de exclusão de mapa, quadra e lote
  rodam em transação, travam os lotes com `FOR UPDATE` e recusam (409) quando há lotes `reserved` ou
  `sold` ou qualquer linha em `purchase_request_lots`; a FK `RESTRICT` (erro 1451) é a rede de
  segurança contra reservas criadas durante a exclusão.
- Dados de clientes (CPF, e-mail, telefone) são pessoais; não registrar em logs.
- Sem rotina de backup versionada: definir uma antes de usar em produção.
