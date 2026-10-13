# TODO

Pendências abertas em 2026-10-13, depois da varredura geral, da migração para MySQL 8 e do início da
autenticação ([spec 010](specs/010-autenticacao-autorizacao-servidor.md)). Remova cada item quando
for concluído.

## Commits e push

- [ ] Nada do que está na árvore de trabalho foi commitado nem enviado ao remoto. A branch
      `fix/varredura-geral-mysql8` tem 8 commits locais. Ficaram sem commit: a autenticação das
      fases 1 a 3 (migration 016, `lib/auth/`, rotas `usuarios/*`, telas de login, senha e
      usuários, `scripts/seed-dev.ts`, testes `auth-*`), o ADR 003, `docs/tecnico/provedores.md`,
      ajustes na spec 010, em `docs/architecture.md`, `docs/database.md` e
      `migrations/CHANGELOG.md`, e este arquivo. As remoções de `app/api/password/*` já estão no
      stage.
- [ ] `AGENTS.md` na raiz foi gerado pelo `next` 16.4 ao instalar. Decidir se entra no
      repositório ou se vai para o `.gitignore`.
- [ ] O hook pre-push roda `yarn typecheck` e `yarn test` na árvore de trabalho inteira.

## Autenticação (spec 010)

Fases 1 a 3 implementadas e validadas pelo dev-auth (lint 0 erros, typecheck limpo, build ok,
migration 016 e fluxo de login, troca de senha e "esqueci a senha" testados com curl num MySQL 8.4
descartável). Restam:

- [ ] Teste instável: `tests/lib/auth-password.test.ts` (scrypt real, N=2^16) estourou o limite de
      5 s com a máquina carregada na última execução completa (294 testes, 1 falha). Dar um
      timeout maior (ex.: 30 s) aos dois testes que chamam `hashPassword` e repetir a suíte.
- [ ] Medir o scrypt na Vercel: os parâmetros ficaram N=2^16, r=8, p=1 (a spec dizia p=2; aqui
      p=2 levou cerca de 900 ms e p=1 cerca de 540 ms). Constante `PARAMS` em
      `lib/auth/password.ts`; o dev-security valida o custo na função serverless.
- [ ] Sem testes automatizados de front (CA-45 a 47: limpeza do `localStorage` legado, `/me`,
      interceptor de 401, redirecionamento de `PASSWORD_CHANGE_REQUIRED`) e sem verificação no
      navegador; o Vitest do projeto é só `environment: node`.
- [ ] Revisão de segurança das tarefas 2.4 e 3.5 da spec (dev-security) e do dev-reviewer sobre o
      conjunto da autenticação.
- [ ] Fora da Vercel o IP do cliente cai num balde único (`'local'`), então o limite por IP vira
      global e só o limite por CPF protege de verdade. Só lê `x-forwarded-for`/`x-real-ip` com
      `process.env.VERCEL` definido.
- [ ] Cookie `__Host-session` com `Secure` em produção: `docker compose up` local em
      `http://localhost` pode ter o cookie recusado no Safari (Chrome e Firefox aceitam).
- [ ] "Esqueci a senha": o admin não tem botão para recusar um pedido (os abertos expiram em 7
      dias); quem sabe o CPF de alguém pode gastar as 5 tentativas do código dele.
- [ ] `docker-compose.yml`: o serviço `db` ainda exige `DEV_PASSWORD` e repassa `DEV_*` sem uso,
      porque o usuário dev agora é criado por `yarn seed:dev` (roda do host). O Dockerfile não
      copia `scripts/` nem `lib/` para o runner. Ajuste do dev-devops.
- [ ] `app/users/page.tsx`: o fluxo de edição de usuário (`setEditingUser`) não é acionado por
      nenhum botão; o modal "Alterar cargo" continua sem a opção dev.
- [ ] Um processo `next-server` (v16.0.10) segue rodando na máquina (pid 170465 na última
      checagem); não confirmei de quem é. Conferir com `pgrep -af next-server`.
- [ ] Aplicar `requireUser`/`requireRole` nas demais rotas (reservas, mapas, lotes, quadras,
      dashboard): vendedor vê só as próprias reservas; editar, confirmar e cancelar reserva só
      admin e dev; `userId` e `userRole` deixam de vir do corpo.
- [ ] Mapa público com dados mínimos: `mapas/lotes` (usada por `/maps/[id]`) ainda devolve preço.
- [ ] Migrar as cerca de 35 rotas que ainda usam `mysql.createConnection(dbConfig)` para o pool
      (na Vercel, conexões avulsas esgotam o limite do banco).
- [ ] `GET /api/reservas` usa `SELECT *` e devolve CPF, e-mail e telefone de clientes: trocar por
      colunas explícitas junto com a autorização (avaliar com o lgpd-specialist).
- [ ] Aviso desatualizado nas specs 003/010 (risco R14): as colunas `purchase_requests.lot_id` e
      `map_id` já foram removidas na migration 015.

## Hospedagem na Vercel e banco

- [ ] Decidir o provedor do MySQL (recomendação: AWS RDS 8.4 em `sa-east-1`; plano B: Aiven).
      Análise em [tecnico/provedores.md](tecnico/provedores.md).
- [ ] Decidir se o banco fica acessível pela internet com TLS ou se paga o IP estático da Vercel.
- [ ] Plano Vercel Pro (o Hobby é só para uso não comercial), funções em `gru1`, contas AWS e Vercel
      em nome da imobiliária com 2FA, RTO e RPO.
- [ ] Implementar a configuração do `lib/db.ts` para serverless: `DB_POOL_SIZE`, `DB_SSL`,
      `DB_SSL_CA`, timeouts.
- [ ] Validar as migrations em MySQL 8.4 limpo (`docs/database.md` cita a validação em 8.0.46) e
      testar `yarn migrate` contra um banco remoto vazio.
- [ ] Limites das funções da Vercel (corpo de 4,5 MB): `upload-svg` e importação de planilhas.
- [ ] Teste de restore do backup antes do go-live.
- [ ] Revisão do dev-security para banco exposto com TLS, e do lgpd-specialist para a Vercel e o
      banco como operadores.
- [ ] Definir quando desligar a HostGator e o que fazer com os dados de clientes que estão lá.

## Deploy

- [ ] O workflow `deploy-hostgator-main.yml` fica obsoleto com a Vercel: remover ou substituir.
- [ ] `.github/workflows/deploy.yml` (GitHub Pages) parece obsoleto: gera `out` num app com API e
      banco, roda em todo push na `main` e tem `contents: write`. Remover.
- [ ] Rotacionar o `CLOUDINARY_API_SECRET` (esteve em variável `NEXT_PUBLIC_*`) e configurar as
      variáveis `CLOUDINARY_*`, `ALLOWED_ORIGINS` e `NEXT_PUBLIC_SITE_URL` no ambiente de destino.

## Dívidas conhecidas do código

- [ ] Rota `mapas/migrar-overlay-cloudinary`: GET público que escreve no banco e no Cloudinary.
      Remover (e atualizar a spec 002, que a cita) ou proteger com papel `dev`.
- [ ] SVG no `upload-svg`: ainda aceito porque o editor de overlay o envia. Converter para PNG no
      cliente ou sanitizar.
- [ ] `components/LotManagement.tsx:155` chama `mapas/lotes/numero-valido`, rota que não existe.
- [ ] Aviso de lint `react-hooks/exhaustive-deps` em `components/PublicMapViewer.tsx:347`.
- [ ] `eslint-config-next` 16.4.0 gera 23 erros de lint (regras novas do React). Fica na 16.0.1
      até uma limpeza de lint.
- [ ] `xlsx` 0.18.5 tem 2 vulnerabilidades altas sem correção no npm: trocar a biblioteca de
      leitura de planilhas em `app/import-map/page.tsx`.
- [ ] `lotes/reservar` grava `installments ?? null`: um valor 0 vindo do cliente violaria o
      `CHECK` (`> 0`) e daria 500.
- [ ] `mapas/configurar-overlay` ainda faz `ALTER TABLE maps` em tempo de execução (a coluna já
      existe desde a migration 013).
- [ ] Runner de migrations divide por `;`: não usar `;` dentro de literais de string em
      migrations. `process.loadEnvFile` exige Node 20.12 ou superior.

## Testes

- [ ] Teste de integração de concorrência contra MySQL real (reserva dupla, exclusão concorrente):
      os testes de `tests/api` mockam `mysql2` e não provam isso.
- [ ] Executar as migrations contra um MySQL real em CI, quando o projeto ganhar CI.
