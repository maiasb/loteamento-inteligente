# Status do Deploy Automático - Vale dos Carajás

**Data da Análise:** 28 de Janeiro de 2026  
**Branch Analisada:** main

---

## 📊 Resumo Executivo

O projeto **Vale dos Carajás** possui configuração de deploy automático via GitHub Actions, porém está **ATUALMENTE COM FALHAS** devido a conflito de configuração entre API Routes dinâmicas e exportação estática.

### Status Atual
- ❌ **GitHub Pages Deploy**: FALHANDO
- ❓ **HostGator VPS Deploy**: Não verificado (requer credenciais SSH)
- ✅ **Desenvolvimento Local**: FUNCIONANDO

---

## 🔍 Análise Detalhada

### 1. Workflows Configurados

O repositório possui **1 workflow ativo** no diretório `.github/workflows/`:

#### Deploy to GitHub Pages (`deploy.yml`)
```yaml
Trigger: Push para branch main
Node Version: 20
Steps:
  1. Checkout do código
  2. Setup Node.js com cache npm
  3. Install dependencies (npm ci)
  4. Build (npm run build)
  5. Criar .nojekyll
  6. Deploy para branch gh-pages
```

**Status:** ❌ FALHANDO  
**Último erro:** `touch: cannot touch 'out/.nojekyll': No such file or directory`

### 2. Problema Identificado

O workflow espera que o comando `npm run build` gere um diretório `out/` com arquivos estáticos, mas a configuração atual do Next.js **NÃO** está gerando esse diretório.

**Causa raiz:** O arquivo `next.config.ts` tem a linha `output: 'export'` comentada:

```typescript
const nextConfig: NextConfig = {
  // Remover 'output: export' para permitir API Routes dinâmicas
  // output: 'export', // Desabilitado - incompatível com API Routes
  images: {
    unoptimized: true,
  },
  // ...
};
```

**Conflito:** O sistema usa API Routes (`/api/*`) que são **incompatíveis** com exportação estática do GitHub Pages.

---

## 🎯 Opções de Deploy Disponíveis

### Opção 1: Deploy com Servidor Node.js (Recomendado)
**Plataformas:** Vercel, Railway, Render, HostGator VPS, AWS, etc.

✅ **Vantagens:**
- Suporta todas as API Routes
- Server-Side Rendering (SSR)
- Rotas dinâmicas funcionam
- Funcionalidade completa

❌ **Desvantagens:**
- Requer servidor Node.js
- Pode ter custo mensal
- Configuração mais complexa

### Opção 2: Deploy Estático (GitHub Pages)
**Plataformas:** GitHub Pages, Netlify, Vercel (static)

✅ **Vantagens:**
- Gratuito
- Deploy automático
- CDN global
- Alta performance

❌ **Desvantagens:**
- **NÃO suporta API Routes**
- Precisa migrar dados para localStorage ou API externa
- Sem autenticação server-side
- Rotas dinâmicas limitadas

### Opção 3: Híbrido (Frontend estático + API externa)
**Plataformas:** GitHub Pages + Vercel Functions / Supabase / Firebase

✅ **Vantagens:**
- Frontend gratuito no GitHub Pages
- Backend serverless separado
- Escalável

❌ **Desvantagens:**
- Arquitetura mais complexa
- Requer refatoração significativa
- CORS e configurações adicionais

---

## 🚀 Como Testar o Deploy

### Teste 1: Build Local (Desenvolvimento)

```bash
# 1. Clone o repositório
git clone https://github.com/Dreams-Consult/vale-dos-carajas.git
cd vale-dos-carajas

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do banco de dados

# 4. Execute em modo desenvolvimento
npm run dev

# 5. Acesse no navegador
# http://localhost:3000
```

**Resultado Esperado:** ✅ Aplicação deve carregar com todas as funcionalidades

---

### Teste 2: Build de Produção (Com API Routes)

```bash
# 1. Faça o build de produção
npm run build

# 2. Inicie o servidor de produção
npm start

# 3. Acesse no navegador
# http://localhost:3000
```

**Resultado Esperado:** ✅ Aplicação deve funcionar igual ao modo desenvolvimento

**Notas:**
- Este é o formato esperado para deploy em servidores Node.js
- Gera arquivos otimizados na pasta `.next/`
- **NÃO** gera pasta `out/`

---

### Teste 3: Build Estático (Sem API Routes)

**⚠️ ATENÇÃO:** Este teste vai falhar com a configuração atual!

```bash
# 1. Temporariamente habilite export no next.config.ts
# Edite o arquivo e descomente: output: 'export',

# 2. Comente todas as API Routes ou mova para serviço externo

# 3. Execute o build
npm run build

# 4. Verifique se a pasta out/ foi criada
ls -la out/

# 5. Teste localmente com servidor estático
npx serve out/
```

**Resultado Esperado:**
- ✅ Pasta `out/` deve ser criada
- ❌ API Routes não funcionarão
- ⚠️ Funcionalidade limitada (sem banco de dados)

---

### Teste 4: Deploy Manual para GitHub Pages

```bash
# Pré-requisito: Ter completado o Teste 3 com sucesso

# 1. Execute o comando de deploy
npm run deploy

# 2. Aguarde o processo terminar (pode levar alguns minutos)

# 3. Acesse a URL do GitHub Pages
# https://dreams-consult.github.io/vale-dos-carajas/
```

**Resultado Esperado:**
- Se `output: 'export'` estiver habilitado: ✅ Deploy bem-sucedido (funcionalidade limitada)
- Com configuração atual: ❌ Falha (pasta out/ não existe)

---

### Teste 5: Verificar Workflows no GitHub Actions

```bash
# 1. Acesse a página de Actions do repositório
# https://github.com/Dreams-Consult/vale-dos-carajas/actions

# 2. Verifique os últimos runs do workflow "Deploy to GitHub Pages"

# 3. Clique em um run falhado para ver os logs

# 4. Procure por erros na etapa "Build" ou "Add .nojekyll"
```

**Resultado Atual:** ❌ Todos os deploys recentes estão falhando

---

## 🔧 Como Corrigir o Deploy Automático

### Solução A: Manter API Routes (Recomendado)

Se você quer manter todas as funcionalidades com API Routes:

1. **Remover o workflow de GitHub Pages** (não é compatível)
2. **Configurar deploy em servidor Node.js**:
   - Vercel (gratuito para projetos pequenos)
   - Railway
   - Render
   - HostGator VPS (já tem workflow configurado)

3. **Passos:**
   ```bash
   # Opção 1: Deploy na Vercel
   npm i -g vercel
   vercel login
   vercel --prod
   
   # Opção 2: Configurar HostGator (requer SSH)
   # Já existe workflow: .github/workflows/deploy-hostgator.yml
   # Necessita configurar secrets no GitHub
   ```

### Solução B: Converter para Site Estático

Se você quer usar GitHub Pages (gratuito):

1. **Migrar dados de API para localStorage ou serviço externo**
2. **Habilitar export no next.config.ts**:
   ```typescript
   const nextConfig: NextConfig = {
     output: 'export',
     images: { unoptimized: true },
     trailingSlash: true,
   };
   ```

3. **Remover ou externalizar todas as API Routes**
4. **Testar o build:** `npm run build`
5. **Fazer push para main** (deploy automático será acionado)

---

## 📝 Logs de Deploy Recentes

### Últimos 5 Deploys (Branch main)

| Data/Hora | Workflow | Status | Mensagem |
|-----------|----------|--------|----------|
| 2026-01-28 01:05 | Deploy to GitHub Pages | ❌ Falhou | No such file or directory: out/.nojekyll |
| 2026-01-28 01:05 | Deploy to HostGator VPS | ❌ Falhou | (logs não verificados) |
| 2026-01-28 00:05 | Deploy to GitHub Pages | ❌ Falhou | No such file or directory: out/.nojekyll |
| 2026-01-28 00:05 | Deploy to HostGator VPS | ❌ Falhou | (logs não verificados) |
| 2026-01-27 23:48 | Deploy to GitHub Pages | ❌ Falhou | No such file or directory: out/.nojekyll |

**Padrão:** Falhas consistentes desde que o `output: 'export'` foi removido do `next.config.ts`.

---

## 🎓 Recomendações

### Para Produção Imediata
1. ✅ **Use deploy com servidor Node.js** (Vercel, Railway, ou HostGator VPS)
2. ✅ **Mantenha todas as funcionalidades** (API Routes, SSR, etc.)
3. ✅ **Desabilite o workflow de GitHub Pages** até decidir sobre arquitetura

### Para GitHub Pages (Futuro)
1. ⚠️ **Planeje a migração de API Routes**
2. ⚠️ **Considere usar Supabase ou Firebase** para backend
3. ⚠️ **Teste extensivamente** antes de fazer deploy

### Para Desenvolvimento
1. ✅ **Continue usando `npm run dev`** - está funcionando perfeitamente
2. ✅ **Mantenha .env.local** com configurações locais
3. ✅ **Documente dependências** do banco de dados MySQL

---

## 📞 Próximos Passos

1. **Decidir arquitetura de deploy:**
   - Servidor Node.js com todas as funcionalidades?
   - Site estático com funcionalidades limitadas?
   - Arquitetura híbrida?

2. **Configurar ambiente de produção escolhido**

3. **Atualizar workflows do GitHub Actions** conforme necessário

4. **Documentar URL de produção** no README.md

5. **Configurar monitoramento** e alertas de deploy

---

## 📚 Documentação Relacionada

- [DEPLOY.md](./DEPLOY.md) - Configuração de deploy (desatualizado)
- [README.md](./README.md) - Documentação principal do projeto
- [QUICKSTART.md](./QUICKSTART.md) - Guia rápido de desenvolvimento
- [GitHub Actions Workflows](.github/workflows/) - Configurações de CI/CD

---

**Última Atualização:** 28 de Janeiro de 2026  
**Responsável:** GitHub Copilot - Análise Automática
