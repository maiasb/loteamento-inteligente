# Banco de dados

MySQL (InnoDB, `utf8mb4_unicode_ci`), acessado com `mysql2` e SQL cru. Configuração em `lib/db.ts`
(`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; pool de 5 conexões).

## Aviso: migrations ≠ schema que o código usa

O banco original foi perdido e **não há dump**. As migrations em `migrations/` não criam todas as
colunas que o código consulta. Aplicar só as migrations produz um banco que **quebra** partes do
app (login, mapas, reservas). A tabela abaixo separa o que está nas migrations do que o código
espera. A coluna "só no código" foi deduzida das queries em `app/api/**` e pode estar incompleta.

Reconciliar o schema exige uma migration nova, com spec aprovada. Não editar as migrations já
numeradas.

## Tabelas

| Tabela                  | Papel                                                              | Relacionamentos                                        |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `users`                 | Usuários do sistema                                                | 1:N com `purchase_requests` (`user_id`, só no código)  |
| `maps`                  | Loteamentos                                                        | 1:N `blocks`, 1:N `lots`                               |
| `blocks`                | Quadras                                                            | N:1 `maps` (`mapId`, ON DELETE CASCADE)                |
| `lots`                  | Lotes                                                              | N:1 `maps` (`map_id`) e `blocks` (`block_id`), CASCADE |
| `purchase_requests`     | Reserva/solicitação de compra                                      | N:N com `lots` via `purchase_request_lots`             |
| `purchase_request_lots` | Lotes de cada reserva, com valores por lote                        | FK `purchase_request_id`, `lot_id`                     |
| `migrations`            | Controle de migrations executadas (criada por `lib/migrations.ts`) | —                                                      |

Views em `001`: `vw_map_statistics`, `vw_lot_details`.

### Colunas

**users**

- Nas migrations: `id`, `username`, `password`, `email`, `first_name`, `last_name`,
  `role ENUM('admin','user')`, `first_login`, `created_at`, `updated_at`, `active` (005),
  `theme_preference ENUM('light','dark')` (006).
- Só no código: `cpf` (login), `name`, `phone`, `creci`, `status` (`pending|approved|rejected`) e
  `role` com valores `dev|admin|vendedor`. `username`, `first_name` e `last_name` não são usados.

**maps**

- Nas migrations: `id INT AUTO_INCREMENT`, `name`, `description`, `location`, `total_area`,
  `pdf_url`, `image_url`, `status`, timestamps.
- Só no código: `width`, `height`, `address`, `overlay_config` (JSON). O `id` é informado pela
  aplicação no `INSERT` (valor tipo timestamp, ver `app/api/mapas/criar/route.ts`).

**blocks**: `id`, `mapId`, `name`, `identifier` (NOT NULL, mas o `INSERT` do código não o preenche),
`description`, `createdAt`, `updatedAt`. Usa camelCase, diferente das demais tabelas.

**lots**: `id BIGINT UNSIGNED`, `block_id`, `map_id`, `lot_number`, `size`, `price`, `status`,
`description`, `features` (JSON), `coordinates` (JSON, 012), timestamps.

- Migration: `status ENUM('available','reserved','sold','unavailable')`.
- Código: usa também `'blocked'`, valor fora do ENUM. Ver "Inconsistências".

**purchase_requests**

- Nas migrations: `id`, `lot_id`, `map_id`, `customer_*`, `payment_method`, `status`, `notes`,
  `contract` (002), `installments` (004, removida na 007), timestamps.
- Só no código: `user_id`, `message`, `seller_name`, `seller_email`, `seller_phone`, `seller_cpf`.
  O `INSERT` não preenche `lot_id` nem `map_id`, ambos NOT NULL nas migrations.

**purchase_request_lots**: `id`, `purchase_request_id`, `lot_id`, `agreed_price` (004),
`first_payment` e `installments` (007), `created_at`.

## Convenções

- Tabelas em snake_case, plural, inglês. Colunas em snake_case, exceto `blocks` (camelCase).
- PKs `id` com `AUTO_INCREMENT`; FKs `<entidade>_id`, `ON DELETE CASCADE` nas relações de mapa.
- Timestamps `created_at` e `updated_at`.
- Valores monetários em `DECIMAL`. CPF e telefone gravados só com dígitos.

## Inconsistências encontradas

| Caso                                                                | Recomendação                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Código usa colunas ausentes das migrations (ver acima)              | Criar migration de reconciliação, com spec, antes de recriar o banco     |
| Status `blocked` no código e `unavailable` no ENUM                  | Escolher um valor único; recomendação: o do banco, ajustando `LotStatus` |
| `blocks` em camelCase                                               | Manter em código existente; em tabelas novas usar snake_case             |
| Numeração 001–007 e depois 012; datas dos comentários fora de ordem | Próxima migration: 013                                                   |
| Quatro formas de acessar o banco                                    | Padrão: `executeQuery` de `lib/db.ts`                                    |
| Senhas em MD5                                                       | Spec própria de autenticação                                             |

## Migrations

- Arquivos `migrations/NNN_descricao.sql`, executados em ordem alfabética; cada um é dividido em
  statements por `;` (evite `;` dentro de strings ou procedures).
- `lib/migrations.ts` expõe `runPendingMigrations`, `getPendingMigrations` e registra cada arquivo
  na tabela `migrations`. **Não existe script de linha de comando** no `package.json`, apesar de o
  deploy chamar `npm run migrate` e `npm run migrate:status`.
- Escreva migrations idempotentes (`IF NOT EXISTS`) como as existentes; documente cada uma em
  `migrations/CHANGELOG.md`.
- Nunca editar uma migration já aplicada em algum ambiente.

## Cuidados com dados

- Sempre SQL parametrizado (`?`). Usar transação (`beginTransaction`) quando alterar mais de uma
  tabela, como em `lotes/reservar`.
- Excluir mapa, quadra ou lote apaga em cascata lotes e reservas ligados. As rotas de exclusão de
  quadra recusam quando há lotes `reserved` ou `sold`.
- Dados de clientes (CPF, e-mail, telefone) são pessoais; não registrar em logs.
- Sem dump nem backup versionado: definir rotina de backup antes de usar em produção.
