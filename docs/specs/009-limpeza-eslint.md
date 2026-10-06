# 009 – Limpeza dos erros de ESLint do código legado

**Status:** implementada
**Autor / data:** Caio Maia / 2026-10-05

## Contexto e problema

O baseline tinha 162 erros e 92 avisos de ESLint em 58 arquivos (142 `no-explicit-any`, 14 `no-unescaped-entities`, 6 `set-state-in-effect`). O pre-commit barra qualquer commit em arquivo com erro, o que obriga a limpar cada arquivo antigo quando alguém o toca.

## Objetivo

`yarn lint` sem erros nem avisos, sem alterar o comportamento nem o visual da aplicação.

## Fora de escopo

Refatorar componentes grandes, trocar a forma de acessar o banco, corrigir as pendências de segurança, afrouxar regras do ESLint.

## Usuários e permissões

Quem desenvolve.

## Regras de negócio

1. Nenhuma regra do ESLint é desativada ou rebaixada; não usar `eslint-disable` nem `@ts-ignore`.
2. `any` é trocado por tipo real: `RowDataPacket`/`ResultSetHeader` do `mysql2` nas consultas, interfaces locais ou em `types/` nos corpos de requisição e props, `unknown` + verificação nos `catch`.
3. Variáveis e imports não usados são removidos; nada de renomear com `_`.
4. `exhaustive-deps` e `set-state-in-effect` só mudam se o comportamento ficar idêntico; se não for possível provar, o caso é tratado numa spec própria e registrado aqui.
5. `yarn typecheck` e `yarn test` passam a cada commit.
6. Commits pequenos por área: rotas de API, libs e hooks, páginas, componentes.

## Fluxos

Corrigir uma área → `yarn lint`, `yarn typecheck`, `yarn test` → commit.

## Critérios de aceite

- [x] `yarn lint` termina com 0 erros e 0 avisos.
- [x] `yarn typecheck` e `yarn test` passam.
- [x] A aplicação sobe no Docker e as telas principais carregam (login, dashboard, mapas, reservas, usuários).
- [x] Nenhum `eslint-disable`, `@ts-ignore` ou `@ts-expect-error` novo.

## Impacto no banco

Nenhum.

## Impacto em telas e no design system

Nenhum visual. Apenas ajustes de tipos e de texto JSX (`&quot;`, `&apos;`).

## Riscos e dúvidas em aberto

- Tipar o que era `any` pode revelar erros reais de tipo; corrigi-los com a menor mudança, sem alterar a lógica.
- `<img>` (4 avisos) e `exhaustive-deps` podem exigir mudança de comportamento; ver resultado na seção abaixo.

## Resultado

`yarn lint` passa com 0 erros e 0 avisos (antes: 162 erros e 92 avisos em 58 arquivos); `yarn typecheck`, `yarn test` e o build de produção no Docker passam. Nenhum `eslint-disable`, `@ts-ignore` ou `@ts-expect-error` foi adicionado.

**Pendência herdada:** o código já tinha 14 comentários `eslint-disable` (12 de `react-hooks/exhaustive-deps`, 1 de `no-img-element`, 1 de `no-unused-vars`, 1 de `no-explicit-any` em `lib/storage.ts`). Eles continuam e escondem alertas; removê-los exige revisar cada efeito e fica para uma spec própria.

**Mudanças que tocam comportamento** (verificadas só por tipos, testes e smoke test HTTP, **sem teste visual no navegador**; conferir manualmente):

1. `LotForm` (em `MapDetails.tsx`): o submit agora usa sempre a descrição e o status atuais. Antes, a função enviada ao pai ficava desatualizada se a descrição ou o status fossem alterados depois do número, área e preço. É uma correção de bug.
2. `SharedLayout`, `ThemeContext`: o valor de "montado" vem de `useSyncExternalStore` (`hooks/useIsMounted.ts`); o menu "Gestão de lotes" é derivado da rota e do `localStorage`; a sidebar mobile fecha ao mudar de rota por ajuste de estado na renderização. Mesmo resultado, sem `setState` em efeito.
3. `useInteractiveMap`: o reset de zoom e posição ao trocar a URL da imagem passou do efeito para a renderização. Mesmas condições (URL vazia, PDF, imagem normal).
4. `useMapSelection`: `loadBlocksForMap` e `loadLotsForBlock` agora são `useCallback` estáveis; a lista de quadras usada como fallback vem de uma ref.
5. Quatro `<img>` viraram `next/image` (logo do login, logo da sidebar, prévia do `import-map`, overlay do `SVGOverlayEditor`). Conferir tamanhos e proporção.
6. Código morto removido: `drawLot` e `isPointInPolygon` (`useInteractiveMap`), `handleDelete` e `deleteLotFromAPI` (`LotManagement`), `getActiveBadge` (`users/page`), `showMigrationsStatus` ficou só criando a tabela de controle.
