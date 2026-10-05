# 009 – Limpeza dos erros de ESLint do código legado

**Status:** aprovada
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

- [ ] `yarn lint` termina com 0 erros e 0 avisos.
- [ ] `yarn typecheck` e `yarn test` passam.
- [ ] A aplicação sobe no Docker e as telas principais carregam (login, dashboard, mapas, reservas, usuários).
- [ ] Nenhum `eslint-disable`, `@ts-ignore` ou `@ts-expect-error` novo.

## Impacto no banco

Nenhum.

## Impacto em telas e no design system

Nenhum visual. Apenas ajustes de tipos e de texto JSX (`&quot;`, `&apos;`).

## Riscos e dúvidas em aberto

- Tipar o que era `any` pode revelar erros reais de tipo; corrigi-los com a menor mudança, sem alterar a lógica.
- `<img>` (4 avisos) e `exhaustive-deps` podem exigir mudança de comportamento; ver resultado na seção abaixo.

## Resultado

(a preencher ao concluir)
