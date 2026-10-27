# Arquitetura

Descreve o sistema como ele é hoje. Dívidas técnicas aparecem em "Pontos de atenção".

## Camadas

```
Navegador (React 19, client components)
  app/**/page.tsx  →  components/  →  hooks/  →  axios('/api/...')
        │
        ▼
Servidor Next.js 16 (App Router)
  proxy.ts            CORS das rotas /api
  app/api/**/route.ts regras de negócio + SQL
        │
        ▼
mysql2 (lib/db.ts)  →  MySQL 8
Serviços externos: Cloudinary (imagens/SVG), Google Maps (overlay de lotes)
```

Não há camada de serviço ou repositório: validação, regras de negócio e SQL ficam juntos em cada
`route.ts`. Os tipos de domínio estão em `types/` (um arquivo por tipo, importado direto: `@/types/Lot`).

## Fluxo de uma requisição

Exemplo: reservar lotes (`LotSelector` / `PurchaseModal`).

1. A tela coleta os dados com `usePurchaseForm` (máscaras e validação de CPF em `utils/formatters.ts`).
2. axios chama `POST /api/mapas/lotes/reservar`.
3. `proxy.ts` adiciona os headers CORS.
4. A rota valida o corpo, abre transação, confere se todos os lotes estão `available`, grava
   `purchase_requests` e `purchase_request_lots` e muda o status dos lotes para `reserved`.
5. Respostas de erro: `{ error: string }` com 400, 404, 409 ou 500.
6. O cliente atualiza a tela. Telas de mapa usam polling (`useRealtimeUpdates`, 10 s por padrão).

## Autenticação e autorização

- Login: `GET /api/usuarios/login?cpf=…&password=…`. A senha é comparada como **hash MD5** no SQL.
  A resposta é o objeto do usuário.
- Sessão: `AuthContext` guarda o usuário em `localStorage['currentUser']`. Não há cookie, token
  nem verificação no servidor.
- Papéis (`UserRole`): `dev` (acesso total), `admin`, `vendedor`. Status do usuário: `pending`,
  `approved`, `rejected`. Só `approved` e `active` entram.
- Controle de acesso: **apenas no cliente** (`SharedLayout` redireciona para `/login`;
  `canAccessUsers` = dev ou admin). As rotas `/api` não checam papel.

## Telas e módulos

| Rota                                                  | Módulo                                              |
| ----------------------------------------------------- | --------------------------------------------------- |
| `/login`, `/register`, `/password`, `/password-reset` | Acesso e senha                                      |
| `/dashboard`                                          | Estatísticas (`/api/dashboard/stats`)               |
| `/maps`, `/maps/[id]`                                 | Seleção de lotes e reserva                          |
| `/map-details`, `/lot-management`                     | Gestão de mapa, quadras e lotes (admin/dev)         |
| `/import-map`                                         | Importação de loteamento (JSON/planilha com `xlsx`) |
| `/reservations`                                       | Reservas                                            |
| `/users`                                              | Gestão de usuários                                  |
| `/view/[mapId]`                                       | Visualização pública somente leitura                |

## Integrações externas

- **Cloudinary** (`lib/cloudinary.ts`): upload de imagens de mapa e de overlay SVG.
- **Google Maps** (`lib/googleMapsConfig.ts`, `SVGOverlayEditor`): overlay do mapa sobre o satélite;
  lotes guardam polígonos em `lots.coordinates` (JSON).
- **PDF**: `react-pdf`/`pdfjs-dist`. `canvas` é substituído por `lib/canvas-mock.ts` (alias do
  Turbopack em `next.config.ts` e `resolutions` no `package.json`).

## Hospedagem e deploy

### Destino planejado: Vercel (decisão de 2026-10-13, ainda não implantado)

Ver [decisions/003-hospedagem-vercel.md](decisions/003-hospedagem-vercel.md) e a spec
[010](specs/010-autenticacao-autorizacao-servidor.md) (RN-29 a RN-31).

- App Next.js em funções serverless da Vercel; `proxy.ts` roda como middleware. HTTPS e proxy da
  plataforma na frente; domínio inicial `*.vercel.app` (domínio próprio é opcional).
- Banco **novo**, MySQL 8 **externo gerenciado** (a Vercel não hospeda o banco). **Provedor ainda
  não escolhido**; pendência E1 da spec 010 (`dev-infra` recomenda, dono decide).
- Sem estado em memória: sessões, rate limit e códigos de redefinição ficam no banco.
- Conexões curtas e pool pequeno (`lib/db.ts`); as rotas antigas com `mysql.createConnection`
  precisam migrar para o pool antes do deploy.
- IP do cliente vem de `x-forwarded-for`/`x-real-ip`. Cookie de sessão com `Secure` em produção.
- Migrations rodadas de fora do deploy (`yarn migrate` contra o banco remoto), nunca no build.
  O script é `yarn migrate`.
- Variáveis de ambiente configuradas na Vercel por ambiente (inclui `ALLOWED_ORIGINS` e
  `NEXT_PUBLIC_SITE_URL`).
- Limites de função (tempo, memória, corpo) afetam `mapas/upload-svg` e `mapas/importar`; o
  `bodySizeLimit` de 500 MB não vale na Vercel. Pendência E2 da spec 010.
- O usuário dev inicial é criado por script Node (hash scrypt), não pelo `docker/db-init.sh`.

### Produção atual (legado, será substituída)

- **Obsoleto** (não apagar até o dono decidir): `.github/workflows/deploy-hostgator-main.yml`: em push na `main`, conecta por SSH na VPS, faz
  `git reset --hard origin/main`, `yarn install --frozen-lockfile`, `yarn migrate` (com `yarn migrate status`
  em seguida), `yarn build` e recarrega o PM2 (`ecosystem.config.js`, 1 instância, reinicia acima de
  1 GB). O runner é `scripts/migrate.ts`.
- `.github/workflows/deploy.yml` (GitHub Pages, publica `out/`): **legado**. O projeto não usa
  `output: export`, então esse workflow não corresponde ao app atual.

## Ambiente local com Docker

`docker-compose.yml` sobe `db` (MySQL 8.4, migrations executadas na primeira subida) e `app` (build
de produção do `Dockerfile`, Node 20). Ver [specs/006-docker.md](specs/006-docker.md). O Docker
fica para desenvolvimento local; até a Vercel entrar no ar, a produção segue o workflow legado com
SSH e PM2.

## Decisões relevantes

- `next.config.ts`: `trailingSlash: true`, imagens sem otimização, `bodySizeLimit` de 500 MB nas
  server actions (uploads grandes), limite de memória para produção.
- Tema claro/escuro por `data-theme` no `<html>`, persistido em `users.theme_preference`.

## Pontos de atenção (dívida técnica conhecida)

1. Senha em query string (GET) e MD5. Sessão só no `localStorage`; rotas de API sem checagem de papel.
2. CORS aberto: `next.config.ts` envia `*` e `proxy.ts` aceita qualquer origem.
3. Hash de senha divergente: login, criação e troca usam MD5; `api/password/reset` usa SHA-256.
4. `validateCPF` aceita o CPF de desenvolvimento `99999999998`.
5. Chaves do Cloudinary também em variáveis `NEXT_PUBLIC_*` (expostas ao navegador).
6. Acesso ao banco inconsistente: ver [database.md](database.md).
7. `lib/storage.ts` (dados de exemplo em localStorage) e `components/PDFMapViewer.tsx` (arquivo
   vazio) parecem sem uso.
8. Componentes muito grandes (`MapDetails.tsx` com mais de 3000 linhas, `LotSelector.tsx`).

Cada item que for tratado deve virar uma spec em `docs/specs/`.
