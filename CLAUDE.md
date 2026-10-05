# CLAUDE.md

Plataforma web da Imobiliária Vale dos Carajás para gerenciar loteamentos: mapas, quadras, lotes,
reservas de lotes por vendedores e usuários com papéis (dev, admin, vendedor). Também há uma
visualização pública dos mapas.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript estrito · Tailwind v4 · MariaDB (compatível com MySQL) via `mysql2`
(SQL cru, sem ORM) · axios no cliente · Cloudinary · Google Maps. Gerenciador de pacotes: **yarn**.
Detalhes e motivos: [docs/decisions/001-stack.md](docs/decisions/001-stack.md).

## Comandos

```bash
yarn install        # instala e ativa os hooks do Husky (script prepare)
yarn dev            # servidor de desenvolvimento (0.0.0.0:3000)
yarn build          # build de produção
yarn lint           # ESLint
yarn typecheck      # tsc --noEmit
yarn format <arquivos>  # Prettier nos arquivos informados (nunca no projeto todo)

docker compose up -d db       # só o MariaDB (dev com `yarn dev` na máquina)
docker compose up --build     # banco + app em container (http://localhost:3000)
```

- **Testes:** ainda não existem. Quando forem criados (etapa própria, com spec em `docs/specs/`),
  adicionar o script `test` e incluí-lo em `.husky/pre-push` e na definição de pronto.
- **Banco:** MariaDB. Docker executa `migrations/*.sql` em volume vazio. Não há scripts `migrate`,
  `migrate:status` nem seed no `package.json`, embora o deploy chame `npm run migrate`. Primeiro
  usuário e regras de migration: [docs/database.md](docs/database.md).
- **Variáveis de ambiente:** nomes em `.env.example`. Nunca ler, copiar ou expor valores de `.env*`.

## Estrutura e onde colocar cada coisa

| Pasta                               | Conteúdo                                                           |
| ----------------------------------- | ------------------------------------------------------------------ |
| `app/<rota>/page.tsx`               | Páginas (App Router). Páginas em inglês: `/maps`, `/reservations`… |
| `app/api/<recurso>/<ação>/route.ts` | Back-end. Recursos e ações em português: `mapas/lotes/criar`       |
| `components/`                       | Componentes de tela, PascalCase                                    |
| `hooks/`                            | Hooks `useX` com lógica de tela reutilizável                       |
| `contexts/`                         | Providers globais (Auth, Theme)                                    |
| `lib/`                              | Infra: banco (`db.ts`), Cloudinary, migrations, config de libs     |
| `utils/`                            | Funções puras (formatação, validação)                              |
| `types/index.ts`                    | Tipos de domínio                                                   |
| `migrations/`                       | SQL numerado, executado em ordem                                   |
| `docs/`                             | Arquitetura, banco, design system, specs, ADRs                     |

## Convenções (padrões dominantes do código)

- TypeScript estrito. Evitar `any` em código novo, porque o ESLint bloqueia `no-explicit-any`.
- Imports com alias `@/` (raiz do projeto).
- Prettier: aspas simples, ponto e vírgula, 2 espaços, `printWidth` 100, vírgula final `es5`.
- Componentes e hooks de cliente começam com `'use client'`.
- Rotas de API: `export const dynamic = 'force-dynamic'`, validar entrada, responder
  `NextResponse.json({ error }, { status })`, `try/catch` com `console.error('[API /rota] …')`.
- Acesso ao banco: **use `executeQuery`/`getPool` de `lib/db.ts`**. Não abrir
  `mysql.createConnection(dbConfig)` em rotas novas (40 rotas antigas ainda fazem isso). Sempre
  SQL parametrizado (`?`).
- Chamadas do cliente à API: axios com base `/api`.
- Estilo: classes Tailwind usando tokens CSS (`var(--primary)`, `var(--border)`…). Ver
  [docs/design-system.md](docs/design-system.md).
- Textos de interface e mensagens de erro em português do Brasil.

## Fluxo de trabalho (spec-driven)

1. Funcionalidade nova ou mudança relevante começa por uma spec em `docs/specs/` (copie
   `_template.md`). Processo em [docs/specs/README.md](docs/specs/README.md).
2. A spec precisa estar **aprovada** antes do código. Se a implementação mudar, atualize a spec.
3. Plano curto antes de codar, tarefas pequenas, um commit por tarefa.
4. Implemente a partir da spec, não fora dela.
5. Decisões técnicas duradouras viram ADR em `docs/decisions/`.

## Regras para o agente

- Não criar arquivos sem necessidade; preferir editar os existentes.
- Fazer a menor mudança que resolva a tarefa.
- Não criar README, resumos, scripts de teste avulsos nem cópias (`_v2`, `_new`, `.bak`).
- Não adicionar dependências sem perguntar.
- Não criar abstrações "para o futuro".
- Não deixar `console.log`, código comentado, mocks ou dados fake.
- Seguir o design system; não criar cores, tamanhos ou componentes fora dele sem perguntar.
- Nunca ler, copiar ou expor valores de `.env`.
- Não formatar nem rodar `lint --fix` no projeto inteiro; padronize só os arquivos que tocar.
- Inconsistências conhecidas estão registradas nos docs; não "corrija de passagem".

## Qualidade e git

- Branches `tipo/descricao-curta`; commits em **Conventional Commits** (`feat:`, `fix:`, `docs:`,
  `chore:`…), validados pelo commitlint no hook `commit-msg`.
- **pre-commit** (lint-staged): ESLint `--fix` + Prettier só nos arquivos em stage.
- **pre-push:** `yarn typecheck`.
- Atenção: o código legado tem erros de ESLint (principalmente `any`). Ao tocar num arquivo
  legado, o pre-commit pode bloquear até esses erros serem resolvidos naquele arquivo. Não use
  `--no-verify`.

## Definição de pronto

- `yarn lint` sem erros nos arquivos tocados e `yarn typecheck` passando.
- Testes passando (quando existirem).
- Spec atualizada e com status correto.
- Nenhum arquivo extra, `console.log`, código comentado ou dado fake.

## Documentos

- [docs/architecture.md](docs/architecture.md) · [docs/database.md](docs/database.md) ·
  [docs/design-system.md](docs/design-system.md)
- [docs/specs/README.md](docs/specs/README.md) · [docs/decisions/](docs/decisions/)
