# 003 – Hospedagem na Vercel com banco MySQL externo

**Status:** aceita (2026-10-13), decisão do dono. A escolha do provedor do banco continua **pendente**.
**Contexto de origem:** spec [010](../specs/010-autenticacao-autorizacao-servidor.md), decisões 11 e 12.

## Contexto

A produção atual é uma VPS da HostGator (PM2, 1 instância, acesso por IP em HTTP, deploy por SSH em `.github/workflows/deploy-hostgator-main.yml`). O dono decidiu hospedar o sistema novo na **Vercel**, com **banco novo** (sem migração de usuários nem de senhas) e, inicialmente, no domínio `*.vercel.app`.

## Decisão

- O app Next.js roda na Vercel como **funções serverless** (rotas de `app/api`) e `proxy.ts` como middleware. HTTPS e proxy da plataforma ficam na frente.
- O banco é **MySQL externo gerenciado** (a Vercel não hospeda MySQL). **Provedor não escolhido**: `dev-infra` recomenda opções (limite de conexões, TLS, proxy/pool, região, backup, custo) e o dono decide. Este ADR será atualizado com a escolha.
- Consequências de projeto adotadas: cookie `Secure` ligado em produção; IP do cliente por `x-forwarded-for`/`x-real-ip`; **nenhum estado em memória** (sessões, rate limit, códigos no banco); pool pequeno e conexões curtas; migrations aplicadas **fora do deploy** (`yarn migrate` contra o banco remoto, nunca no build); `ALLOWED_ORIGINS` e `NEXT_PUBLIC_SITE_URL` por ambiente; limites de tempo/memória/corpo das funções tratados em `upload-svg` e `importar`.
- O workflow da HostGator fica **obsoleto** (registrado, **não apagado** sem decisão do dono). O usuário dev inicial é criado por script Node (scrypt), não por `db-init.sh`.

**Nota do `dev-infra` (2026-10-13): recomendado, aguardando decisão do dono.** Banco: **AWS RDS for MySQL 8.4 (Single-AZ) em `sa-east-1`**, com as funções da Vercel em `gru1` (≈ US$ 29 a 55 por mês). Plano B: Aiven for MySQL (Startup, `aws-sa-east-1`, ≥ US$ 75/mês). Pontos que o dono precisa decidir: banco acessível pela internet com TLS (a Vercel não tem IP fixo; IP estático custa ~US$ 100/mês por projeto), plano Vercel Pro (Hobby é só uso não comercial) e RTO/RPO. MySQL 8.0 já está fora do suporte padrão (usar 8.4). Análise, fontes e checklist em [../tecnico/provedores.md](../tecnico/provedores.md). Este ADR segue "provedor não escolhido" até a resposta.

## Alternativas consideradas

| Alternativa                                            | Por que não (ou por que ficou de lado)                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Manter a VPS (PM2) e só colocar domínio/HTTPS          | Decisão do dono foi migrar; manteria operação de servidor e HTTP por IP                 |
| Container (Docker) em PaaS/VPS com banco no mesmo host | Não escolhida pelo dono; continua válida para desenvolvimento local                     |
| Banco na própria Vercel                                | Não há MySQL gerenciado pela Vercel (conferir no momento da escolha: oferta pode mudar) |

## Consequências

- (+) HTTPS desde o início; sem servidor para manter; deploy por Git.
- (−) Conexões ao banco são o ponto frágil (R15); latência extra do banco externo (R18); limites de função para uploads (R16); custo de dois fornecedores (hospedagem + banco); migrations manuais (R17).
- As ~40 rotas que abrem `mysql.createConnection` precisam migrar para o pool (spec 010, tarefa 1.9) antes do deploy.
- Valores, planos e limites da Vercel e do provedor de banco **podem estar desatualizados**: conferir nas fontes oficiais antes de decidir.

## Quando revisitar

- Ao escolher o provedor do banco (E1) ou se o limite de conexões/latência causar erros.
- Se os limites de função inviabilizarem upload/importação de arquivos reais.
- Se o dono quiser domínio próprio ou trazer outro canal (e-mail) que exija nova infraestrutura.
