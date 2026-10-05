# Specs

Todo desenvolvimento é guiado por specs (spec-driven development).

## Processo

1. **Rascunho.** Copie `_template.md` para `docs/specs/NNN-nome-curto.md` (próximo número livre) e
   preencha. Status: `rascunho`.
2. **Aprovação.** A spec é revisada por uma pessoa responsável. Só depois de aprovada
   (status `aprovada`) o código pode começar. Dúvidas em aberto precisam estar resolvidas ou
   explicitamente fora do escopo.
3. **Implementação.** Quem implementa (humano ou agente) segue a spec, não fora dela. Se algo
   faltar ou estiver errado, pare, atualize a spec e peça nova aprovação.
4. **Atualização.** Se a implementação mudar o comportamento, a spec é atualizada no mesmo PR.
5. **Conclusão.** Com os critérios de aceite verificados, o status passa a `implementada`.

## Quando é obrigatória

Funcionalidade nova ou mudança relevante de comportamento, banco, permissões ou telas. Correções
pequenas e ajustes de texto não precisam de spec.

## Specs "as-built"

Descrevem o que já existia quando a prática começou. Têm status `implementada` e documentam o
comportamento atual, inclusive problemas conhecidos; não são um pedido de mudança.

## Índice

| Spec                                         | Módulo                           | Status       |
| -------------------------------------------- | -------------------------------- | ------------ |
| [001](001-autenticacao-usuarios.md)          | Autenticação e usuários          | implementada |
| [002](002-mapas-importacao.md)               | Mapas e importação               | implementada |
| [003](003-quadras-lotes.md)                  | Quadras e lotes                  | implementada |
| [004](004-reservas.md)                       | Reservas                         | implementada |
| [005](005-dashboard-visualizacao-publica.md) | Dashboard e visualização pública | implementada |

## Testes

Ainda não há testes automatizados. Criar a infraestrutura de testes é uma etapa própria, que
precisa de spec (framework, o que cobrir primeiro, script `test` e inclusão no `pre-push`). Toda
spec nova deve manter seus critérios de aceite verificáveis para que virem testes depois.
