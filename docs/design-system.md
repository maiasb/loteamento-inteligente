# Design system

Extraído do código. Os tokens estão centralizados em [app/globals.css](../app/globals.css); os
componentes não têm biblioteca de UI e a maior parte do estilo é Tailwind inline com tokens via
`var(--token)`. Nada aqui foi centralizado ou alterado no código.

## Tokens

### Cores (definidas por tema em `:root[data-theme="dark"|"light"]`)

| Token                              | Valor                                                               | Uso                                                                    |
| ---------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `--primary` / `-light` / `-dark`   | `#1e5a37` / `#2d7a4f` / `#0f3d24`                                   | Ação principal, item ativo do menu, links de destaque (verde floresta) |
| `--secondary` / `-light` / `-dark` | `#7d5a3f` / `#9d7456` / `#5e4330`                                   | Ações secundárias, thumb da scrollbar (terra)                          |
| `--accent` / `-light`              | `#d4a574` / `#c49563` (claro) ou `#e6b885` (escuro)                 | Destaques, bordas no tema escuro (dourado)                             |
| `--success` / `-dark`              | `#1e7e34` / `#155d27`                                               | Sucesso, lote disponível                                               |
| `--warning` / `-dark`              | `#d66a1f` / `#b35419`                                               | Atenção, reservado                                                     |
| `--danger` / `-dark`               | `#b02836` / `#8c1f2a`                                               | Erro, exclusão                                                         |
| `--background`                     | claro `#f8f9fa`, escuro `#1a4a42`                                   | Fundo da página                                                        |
| `--foreground`                     | claro `#1a1a1a`, escuro `#ffffff`                                   | Texto padrão                                                           |
| `--card-bg`                        | claro `#ffffff`, escuro `#234f47`                                   | Cards, modais, sidebar                                                 |
| `--surface` / `--surface-hover`    | claro `#f1f3f5` / `#e9ecef`, escuro `#2a5850` / `#316159`           | Inputs, áreas rebaixadas, hover                                        |
| `--border` / `--border-strong`     | claro `rgba(0,0,0,.1)` / `.2`; escuro `rgba(212,165,116,.3)` / `.5` | Bordas                                                                 |

Uso real (contagem em `var(--…)`): `foreground` 501, `border` 228, `surface` 192, `primary` 111,
`card-bg` 78. Os tokens `success/warning/danger` são pouco usados (30, 8 e 15).

### Tipografia

- Fonte: Geist Sans (`--font-geist-sans`) e Geist Mono (`--font-geist-mono`), carregadas em
  `app/layout.tsx`. Fallback: system-ui.
- Corpo: 16px, `line-height` 1.6. `button`, `input`, `textarea` e `select` têm `font-weight: 600`
  global; inputs em 16px (evita zoom no iOS).
- Títulos e textos: escala padrão do Tailwind (`text-sm`, `text-xl`…), sem tokens próprios.

### Espaçamento

Escala padrão do Tailwind. Mais frequentes: `px-4`, `py-2`, `py-3`, `p-4`, `p-6`, `gap-2`, `gap-3`.

### Raios

`rounded-lg` (286) em botões e inputs, `rounded-xl` (183) em botões grandes e cards,
`rounded-2xl` (62) em modais, `rounded-full` (87) em badges e avatares.

### Sombras (tokens)

`--shadow-sm` a `--shadow-xl`, diferentes por tema. Uso via `shadow-[var(--shadow-md)]`.
Também há classes Tailwind diretas (`shadow-md` 119, `shadow-lg` 108, `shadow-xl`, `shadow-2xl`).

### Breakpoints

Padrão do Tailwind: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Mobile-first; mais usados: `sm:` e `lg:`.

### Movimento

`button` tem `transition` global; hover sobe 1px e `:active` faz `scale(.98)`. Animações:
`animate-slide-up` (globals.css, barra de seleção), `animate-fadeIn` e `animate-slideUp`
(definidas dentro de `CustomAlert.tsx`), `animate-spin` e `animate-pulse` do Tailwind.

## Tema

`ThemeContext` define `data-theme` no `<html>`; `ThemeSync` sincroniza com
`users.theme_preference`; `ThemeToggle` alterna. Todo estilo novo deve usar tokens para funcionar
nos dois temas.

## Componentes reutilizáveis

| Componente                                                           | Caminho                        | Quando usar                                                           | Variações                                                     |
| -------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `CustomAlert`                                                        | `components/CustomAlert.tsx`   | Modal de feedback ou confirmação                                      | `type`: success, error, warning, info, confirm; fecha com ESC |
| `useCustomAlert` / `showAlert` / `showConfirm`                       | `hooks/useCustomAlert.tsx`     | Forma padrão de abrir o `CustomAlert` (inclusive fora de componentes) | `showConfirm` devolve `Promise<boolean>`                      |
| `SharedLayout`                                                       | `components/SharedLayout.tsx`  | Envolve páginas autenticadas: sidebar, cabeçalho, guarda de login     | Menu muda conforme o papel                                    |
| `ThemeToggle` / `ThemeSync`                                          | `components/`                  | Alternância e sincronização do tema                                   | —                                                             |
| `PurchaseModal`                                                      | `components/PurchaseModal.tsx` | Formulário de reserva de lotes                                        | —                                                             |
| `LotSelector`, `InteractiveMap`, `PublicMapViewer`, `ViewOnlyLotMap` | `components/`                  | Visualização e seleção de lotes (privada, pública, somente leitura)   | —                                                             |
| `MapDetails`, `MapManagement`, `LotManagement`, `SVGOverlayEditor`   | `components/`                  | Telas de gestão de mapas, quadras e lotes                             | —                                                             |

Não existem Button, Input, Select, Modal, Card ou Table genéricos. Esses padrões se repetem como
classes Tailwind em cada tela (ver Inconsistências).

## Padrões

- **Layout de página:** `min-h-screen bg-[var(--background)]`; páginas autenticadas dentro de
  `SharedLayout`, sidebar `w-64` com `bg-[var(--card-bg)] border-r border-[var(--border)]`, recolhida no mobile.
- **Card:** `bg-[var(--card-bg)] border border-[var(--border)] rounded-xl|2xl shadow-[var(--shadow-md)]`.
- **Botão primário:** `bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white rounded-lg|xl`.
  Secundário: `bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]`.
- **Formulários:** campos em `bg-[var(--surface)]` com borda `var(--border)`; máscaras e
  validação em `utils/formatters.ts` (`formatCPF`, `validateCPF`, telefone, moeda); lógica de
  formulário em hooks (`usePurchaseForm`). Erros e confirmações pelo `CustomAlert`.
- **Carregando:** texto ("Carregando mapa...", "Carregando...") e `animate-spin`/`animate-pulse`;
  não há componente de skeleton ou spinner.
- **Erro:** `showAlert({ type: 'error' })`; nas rotas de API, `{ error }` em português.
- **Vazio:** texto simples na própria tela, sem componente dedicado.
- **Status de lote:** cores por status, hoje definidas em cada componente de mapa.

## Inconsistências

| Caso                                                                                                                      | Padrão recomendado                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cores Tailwind literais (`bg-red-500`, `text-gray-400`, `bg-blue-600`…) e cerca de 29 hex em TSX (ex.: `#22c55e`)         | Usar `var(--success/danger/warning/primary)` e `var(--foreground)`; se faltar token, perguntar antes de criar |
| `CustomAlert` usa gradientes `from-green-500`, `from-red-500`, `from-amber-500`                                           | Migrar para tokens semânticos quando o componente for tocado                                                  |
| Badge de papel em `SharedLayout` usa `purple/blue/emerald-500`                                                            | Idem; definir tokens de papel numa spec                                                                       |
| Cores de status de lote repetidas por componente                                                                          | Definir uma fonte única (spec) antes de mexer                                                                 |
| Sem componentes base (Button, Input, Modal, Card)                                                                         | Para telas novas, seguir as classes dos padrões acima; propor componente base só com spec aprovada            |
| `animate-fadeIn`/`slideUp` vivem em `CustomAlert.tsx`, `slide-up` em `globals.css`                                        | Keyframes novos em `globals.css`                                                                              |
| `body` com `color: var(--foreground)` comentado; fallback `:root` claro enquanto o comentário diz que o escuro é o padrão | Definir o tema padrão numa spec; documentar                                                                   |
| Transições globais comentadas no CSS                                                                                      | Não reativar sem spec                                                                                         |
| Bloco duplicado de tokens (escuro, claro e `:root`)                                                                       | Manter até haver spec de refatoração                                                                          |
