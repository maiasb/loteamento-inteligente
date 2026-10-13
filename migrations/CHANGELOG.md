# 📋 Histórico de Migrations

Este documento registra todas as migrations executadas no projeto.

## Ordem de Execução

### 001_initial_schema.sql

**Descrição**: Schema inicial do banco de dados (reescrita em 2026-10 para MySQL 8)

- Criação das tabelas: users, maps, blocks, lots, purchase_requests, purchase_request_lots
- Definição de foreign keys e constraints
- Índices para performance
- Sem views: `vw_map_statistics` e `vw_lot_details` foram removidas (o código não as usa)

**Tabelas Criadas**:

- `users` - Usuários do sistema
- `maps` - Mapas/Loteamentos
- `blocks` - Quadras/Blocos
- `lots` - Lotes
- `purchase_requests` - Solicitações de compra
- `purchase_request_lots` - Relacionamento múltiplos lotes

---

### 002_add_contract_column.sql

**Data**: 2024-11-27  
**Descrição**: Adiciona coluna contract na tabela purchase_requests

- Campo TEXT para armazenar informações do contrato

---

### 003_alter_price_column.sql

**Data**: 2024-11-22  
**Descrição**: Altera precisão da coluna price

- Muda de DECIMAL(15,2) para DECIMAL(10,2)
- Valores até R$ 99.999.999,99

---

### 004_add_agreed_price_installments.sql

**Data**: 2024-12-01  
**Descrição**: Adiciona campos para preço acordado e parcelas

- `agreed_price` em purchase_request_lots - DECIMAL(15,2)
- `installments` em purchase_requests - INT

---

### 005_add_active_users.sql

**Data**: 2024-12-05  
**Descrição**: Adiciona coluna active na tabela users

- Campo TINYINT(1) para ativar/desativar usuários
- Default: 1 (ativo)
- Atualiza usuários existentes para ativo

---

### 006_add_theme_preference.sql

**Descrição**: Adiciona preferência de tema do usuário

- Campo ENUM('light', 'dark') na tabela users
- Default: 'light'
- Sem índice (a coluna nunca é filtrada)

---

### 007_move_payment_fields_to_lots.sql

**Data**: 2024-11-29  
**Descrição**: Move campos de pagamento para tabela de lotes

- Adiciona `first_payment` e `installments` em purchase_request_lots
- Copia as parcelas de purchase_requests para os lotes
- Remove colunas antigas de purchase_requests
- Sem índices em `first_payment` e `installments` (nunca filtradas)

---

## Comandos Úteis

```bash
yarn migrate status   # lista executadas e pendentes
yarn migrate          # executa as pendentes
```

Os scripts `migrate`/`migrate:status` antigos (`npm run`) e `migrate:create` não existem; novas
migrations são criadas à mão em `migrations/`.

## Estrutura de Controle

As migrations são rastreadas na tabela `migrations`:

```sql
CREATE TABLE migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Cada migration é executada apenas uma vez e registrada automaticamente.

## Próximas Migrations

Para adicionar novas alterações no schema:

1. Criar `migrations/NNN_nome_descritivo.sql` (próxima: 016) com descrição e rollback no cabeçalho
2. Executar: `yarn migrate`
3. Documentar aqui

## Rollback

⚠️ **ATENÇÃO**: Este sistema não suporta rollback automático.

Para reverter uma migration:

1. Fazer backup do banco antes de executar
2. Se necessário, restaurar o backup
3. Criar nova migration para reverter as mudanças

## Boas Práticas

- ✅ Use só sintaxe do MySQL 8 (sem `IF NOT EXISTS` em `ALTER`/`CREATE INDEX`); a migration roda uma vez
- ✅ Teste localmente antes de produção
- ✅ Faça backup antes de executar em produção
- ✅ Documente as alterações neste arquivo
- ✅ Nunca edite migrations já executadas num banco com dados reais
- ✅ Use nomes descritivos para migrations
- ✅ Uma migration = uma responsabilidade

### 013_reconcile_schema_with_code.sql

**Data**: 2026-10-05 (reescrita para MySQL 8 em 2026-10-13)
**Descrição**: Alinha o schema ao que o código usa (spec 007). Assume banco recriado do zero.

- `users`: adiciona `cpf` (único), `name`, `phone`, `creci`, `status`; `role` passa a `dev|admin|vendedor`; `username` opcional
- `maps`: `id` BIGINT; adiciona `address`, `width`, `height`, `overlay_config`
- `blocks`: `mapId` BIGINT, `identifier` opcional, adiciona `coordinates` (JSON; antes a rota de atualizar criava a coluna em tempo de execução)
- `lots`, `purchase_requests`: colunas de mapa em BIGINT e FKs recriadas; `block_id`, `lot_id`, `map_id`, `customer_email`, `customer_phone` opcionais; `lots.status` aceita `blocked`
- `purchase_requests`: adiciona `user_id`, `message`, `seller_*`
- `purchase_request_lots`: adiciona `payment_method`

### 014_payment_method_text.sql

**Data**: 2026-10-06
**Descrição**: `purchase_requests.payment_method` passa de ENUM para `VARCHAR(255)`, porque o formulário de reserva envia várias formas separadas por vírgula (ex.: `cash, financing`). Com o ENUM, reservar pela tela retornava erro 500 (`Data truncated`).

### 015_integrity_and_indexes.sql

**Data**: 2026-10-13
**Descrição**: Integridade e índices (requer MySQL 8.0.16+ para os CHECKs).

- `purchase_request_lots.lot_id`: FK `ON DELETE RESTRICT` (lote com linha de reserva não é excluído, nem em cascata; as rotas de exclusão removem as linhas de reservas `cancelled`/`rejected` na mesma transação)
- `purchase_requests.lot_id` e `map_id` (legados, nunca preenchidos, FK CASCADE) removidos, para que excluir lote ou mapa não apague a reserva
- `lots.block_key` (coluna gerada VIRTUAL, `IFNULL(block_id, 0)`) e `UNIQUE (map_id, block_key, lot_number)`: o UNIQUE anterior não barrava duplicata de lote sem quadra (NULL ≠ NULL). VIRTUAL porque `block_id` tem FK com CASCADE
- `lots.price` e `purchase_request_lots.first_payment` em `DECIMAL(15,2)`; CHECKs `price >= 0`, `agreed_price >= 0`, `first_payment >= 0`, `installments > 0`
- Índices `purchase_requests (status, created_at, id)` e `(user_id, created_at, id)` para a paginação (`ORDER BY created_at DESC, id DESC`, sem filesort)
- Removidos por redundância ou falta de uso: `purchase_request_lots.idx_purchase_request_id`, `users.idx_role`, `lots.idx_map_id`, `lots.idx_lot_number`, `blocks.idx_mapId`, `blocks.idx_name`, `purchase_requests.idx_status`, `purchase_requests.idx_pr_user_id`
- Rollback no cabeçalho do arquivo (testado)

### 016_auth_sessions.sql

**Data**: 2026-10-13
**Descrição**: Autenticação no servidor (spec 010). Banco novo: não altera senhas existentes.

- `users.last_login_at` (último login); a troca obrigatória de senha reaproveita `users.first_login`
- `user_sessions`: sessão por cookie; só o hash SHA-256 do token; expiração por inatividade e absoluta; `revoked_at`; apagada em cascata com o usuário
- `auth_attempts`: tentativas para limite de taxa (login, cadastro, troca de senha, pedido de redefinição); `subject_hash` é o SHA-256 de CPF/IP/id
- `password_reset_requests`: pedido de "esqueci a senha" e código de uso único emitido por admin/dev (só o hash do código); `UNIQUE` em coluna gerada VIRTUAL garante um pedido aberto por usuário
- Rollback no cabeçalho do arquivo
