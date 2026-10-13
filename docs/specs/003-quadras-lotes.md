# 003 – Quadras e lotes (as-built)

**Status:** implementada
**Origem:** descrição do comportamento atual a partir do código em 2026-10-05; não é pedido de mudança.

## Contexto e problema

Cada mapa tem quadras e lotes com status, preço, área e polígono.

## Objetivo

Cadastrar e manter quadras e lotes, inclusive operações em lote (bloqueio e exclusão de várias quadras).

## Fora de escopo

Reservar lotes (spec 004).

## Usuários e permissões

Admin e dev (telas `/map-details`, `/lot-management`); vendedor só consulta.

## Regras de negócio

1. Quadra pertence a um mapa e tem nome único por mapa (`unique_block_per_map`).
2. Lote tem número, área, preço, descrição, características (JSON) e `coordinates` (JSON); número único por mapa e quadra.
3. Status do lote: `available`, `reserved`, `sold` e `blocked` (o ENUM aceita `blocked` desde a migration 013, mantendo `unavailable`).
4. Excluir quadra é recusado se houver lote `reserved` ou `sold` (`DELETE /api/mapas/quadras/deletar`).
5. Excluir lote é recusado se estiver `reserved` ou `sold`; a mensagem orienta cancelar na página de Reservas.
6. Criar, atualizar e listar: `/api/mapas/lotes/*` e `/api/mapas/quadras/*`; `lotes/valido` e `verificar-lotes-reservados` auxiliam validações.
7. Operações em lote de quadras (bloquear, desbloquear, excluir) usam `useBlockOperations`.

> **Nota de atualização (2026-10-13, decisão do dono – regra nova de exclusão; código ainda não alterado):** as regras 4 e 5 acima descrevem o comportamento **atual** (recusa por status do lote e, desde a migration 015, FK `RESTRICT` em `purchase_request_lots.lot_id`, que impede excluir lote com qualquer histórico de reserva). Ficam **substituídas, quando implementadas**, pela RN-N1..N6 abaixo. Registro detalhado de implementação, banco e testes em [007](007-reconciliacao-schema.md) (nota de 2026-10-13) e [004](004-reservas.md) (RN8).

### Regras novas de exclusão (aprovadas em 2026-10-13, status: aprovada, não implementada)

- **RN-N1 – Reserva ativa x encerrada.** Para fins de exclusão, reserva/compra **ativa** = `pending`, `approved` ou `completed`; **encerrada** = `cancelled` ou `rejected`. Origem: dono.
- **RN-N2 – Excluir lote.** Pode ser excluído quando **todas** as reservas/compras ligadas a ele estão encerradas (ou quando não há nenhuma). Com **qualquer** reserva ativa, a exclusão é recusada (409) e a mensagem orienta cancelar a reserva na página de Reservas. A decisão **não** depende mais do status do lote (`reserved`/`sold`), e sim do estado das reservas ligadas, lido do banco na mesma transação da exclusão. Origem: dono.
- **RN-N3 – O que acontece ao excluir.** O vínculo `purchase_request_lots` daquele lote é removido; a reserva **permanece como histórico**, sem o lote. A reserva (cliente, vendedor, datas, status) não é apagada. Origem: dono.
- **RN-N4 – Acesso a lote excluído.** Quem tentar abrir o lote por uma reserva/compra cancelada vê a mensagem **"Este lote não existe mais."** (em vez de erro). Origem: dono.
- **RN-N5 – Quadra.** A quadra só pode ser excluída se **todos** os seus lotes puderem ser excluídos pela RN-N2; basta um lote com reserva ativa para recusar a exclusão inteira (nada é excluído, tudo-ou-nada, na mesma transação). Ao excluir, aplica-se a RN-N3 a todos os lotes. Origem: dono (extensão a quadra).
- **RN-N6 – Mapa.** Idem para o mapa: só é excluído se todos os lotes de todas as quadras puderem ser excluídos pela RN-N2 (tudo-ou-nada). Origem: dono (extensão a mapa).

**Critérios de aceite novos** (verificáveis; viram teste em `tests/api`):

- [ ] CA-N1 – Dado lote cujas reservas ligadas estão todas `cancelled`, quando `DELETE /api/mapas/lotes/deletar`, então 200, o lote some e as linhas de `purchase_request_lots` dele são removidas, e a reserva continua existindo.
- [ ] CA-N2 – Dado lote cujas reservas são `cancelled` e `rejected`, a exclusão é aceita.
- [ ] CA-N3 – Dado lote com ao menos uma reserva `pending`, `approved` ou `completed`, quando excluir, então 409 e nada é alterado, mesmo que as outras reservas estejam canceladas.
- [ ] CA-N4 – Dado lote sem nenhuma reserva (qualquer status do lote que não seja por reserva ativa, ex.: `blocked`), a exclusão é aceita.
- [ ] CA-N5 – Dado reserva `cancelled` cujo lote foi excluído, quando se abre o lote por essa reserva, então aparece "Este lote não existe mais." e nenhum erro 500.
- [ ] CA-N6 – Quadra: com um único lote de reserva ativa, `DELETE quadras/deletar` responde 409 e **nenhum** lote nem a quadra são removidos; com todas as reservas encerradas, a quadra e seus lotes são removidos e as reservas permanecem.
- [ ] CA-N7 – Mapa: idem CA-N6 para `DELETE mapas/deletar`.
- [ ] CA-N8 – Após excluir lote/quadra/mapa conforme RN-N3, a listagem de reservas (`GET /api/reservas`) continua devolvendo as reservas encerradas sem erro, com a lista de lotes sem o lote excluído.
- [ ] CA-N9 – Reserva ativa criada ou confirmada **durante** a exclusão (concorrência): exclusão e reserva não podem ambas ter sucesso para o mesmo lote (uma delas falha com 409; sem lote reservado sem lote existente).

**Questões para `dev-database` (a spec define o comportamento, não o schema):** a FK `purchase_request_lots.lot_id` está `RESTRICT` desde a migration 015 e precisa permitir a remoção do vínculo (ex.: remover os vínculos explicitamente na transação, ou mudar a regra de integridade); a coluna legada `purchase_requests.lot_id` (FK `CASCADE` para `lots`, opcional, não preenchida pelo código) **não pode** apagar a reserva ao excluir o lote; `purchase_requests.map_id` (FK `CASCADE` para `maps`) idem para o mapa. Garantir que nenhuma cascata apague a reserva (RN-N3). Telas (`dev-uiux`): mensagem "Este lote não existe mais." no ponto em que a reserva abre o lote; texto de confirmação da exclusão informando que reservas canceladas ficarão sem o lote.

## Fluxos

Edição em `MapDetails`/`LotManagement`; seleção múltipla com barra flutuante (`animate-slide-up`).

## Critérios de aceite (comportamento atual)

- [ ] Quadra com lote reservado ou vendido não é excluída.
- [ ] Lote reservado ou vendido não é excluído.

## Impacto no banco

`blocks`, `lots` (`coordinates` na migration 012).

## Impacto em telas e no design system

`MapDetails` (3300+ linhas), `LotManagement`, `LotSelector`, `InteractiveMap`; cores de status definidas por componente.

## Riscos e dúvidas em aberto

- `unavailable` e `blocked` coexistem no ENUM; unificar exige spec.
- Regra recente de bloqueio e desbloqueio (último commit) sem spec; registrar os detalhes ao revisar esta spec.
