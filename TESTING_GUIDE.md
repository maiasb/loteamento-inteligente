# Guia de Testes - Vale dos Carajás

Este documento fornece um guia completo de como testar o sistema Vale dos Carajás em diferentes cenários e ambientes.

---

## 📋 Índice

1. [Testes de Desenvolvimento Local](#1-testes-de-desenvolvimento-local)
2. [Testes de Build](#2-testes-de-build)
3. [Testes de Deploy](#3-testes-de-deploy)
4. [Testes Funcionais](#4-testes-funcionais)
5. [Testes de Performance](#5-testes-de-performance)
6. [Solução de Problemas](#6-solução-de-problemas)

---

## 1. Testes de Desenvolvimento Local

### 1.1 Configuração Inicial

```bash
# Clone o repositório (se ainda não tiver)
git clone https://github.com/Dreams-Consult/vale-dos-carajas.git
cd vale-dos-carajas

# Verifique a versão do Node.js (deve ser 18+)
node --version

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
```

**Edite o arquivo `.env.local`:**
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=vale_dos_carajas
NEXT_PUBLIC_API_URL=/api
```

### 1.2 Iniciar Servidor de Desenvolvimento

```bash
# Inicie o servidor
npm run dev

# Você deve ver:
# ✓ Starting...
# ✓ Ready in XXXms
# ○ Local: http://localhost:3000
# ○ Network: http://0.0.0.0:3000
```

### 1.3 Testes Básicos de Funcionalidade

**Abra o navegador e teste cada URL:**

1. **Página Principal**
   ```
   http://localhost:3000/
   ```
   ✅ Deve carregar o mapa interativo
   
2. **Admin - Mapas**
   ```
   http://localhost:3000/admin/map-management
   ```
   ✅ Deve mostrar lista de mapas
   
3. **Admin - Lotes**
   ```
   http://localhost:3000/admin/lot-management?mapId=1
   ```
   ✅ Deve carregar gerenciamento de lotes

4. **Admin - Quadras**
   ```
   http://localhost:3000/admin/blocks
   ```
   ✅ Deve carregar gerenciamento de quadras

5. **Dashboard**
   ```
   http://localhost:3000/dashboard
   ```
   ✅ Deve carregar dashboard com estatísticas

6. **Login**
   ```
   http://localhost:3000/login
   ```
   ✅ Deve carregar tela de login

### 1.4 Teste de API Routes

Use `curl` ou ferramentas como Postman/Insomnia:

```bash
# Teste 1: Listar mapas
curl http://localhost:3000/api/mapas

# Teste 2: Estatísticas do dashboard
curl http://localhost:3000/api/dashboard/stats

# Teste 3: Listar usuários
curl http://localhost:3000/api/usuarios

# Teste 4: Stats de lotes
curl http://localhost:3000/api/mapas/lotes/stats

# Teste 5: Listar reservas
curl http://localhost:3000/api/reservas
```

**Resultado Esperado:** JSON com dados ou mensagens de erro apropriadas

### 1.5 Teste de Hot Reload

```bash
# Com o servidor rodando, edite um arquivo
echo "// Test comment" >> app/page.tsx

# Observe o terminal
# Você deve ver:
# ⚡ Compiling...
# ✓ Compiled successfully
```

---

## 2. Testes de Build

### 2.1 Build de Produção (Com API Routes)

```bash
# Limpe builds anteriores
rm -rf .next

# Execute o build
npm run build

# Você deve ver:
# ✓ Creating an optimized production build
# ✓ Compiled successfully
# ✓ Collecting page data
# ✓ Generating static pages
# ✓ Finalizing page optimization

# Verifique se a pasta .next foi criada
ls -la .next/

# Inicie o servidor de produção
npm start

# Teste no navegador
# http://localhost:3000
```

**Checklist de Verificação:**
- [ ] Build completa sem erros
- [ ] Pasta `.next/` foi criada
- [ ] Servidor inicia sem erros
- [ ] Todas as páginas carregam
- [ ] API Routes funcionam
- [ ] Console do navegador sem erros críticos

### 2.2 Build Estático (Sem API Routes)

**⚠️ ATENÇÃO:** Requer modificações no código!

```bash
# Passo 1: Backup do next.config.ts
cp next.config.ts next.config.ts.backup

# Passo 2: Edite next.config.ts e adicione:
# output: 'export',

# Passo 3: Execute o build
npm run build

# Resultado esperado:
# ❌ Erro: API Routes são incompatíveis com 'output: export'
# OU (se APIs foram removidas)
# ✓ Exported as static HTML

# Passo 4: Verifique a pasta out/
ls -la out/

# Passo 5: Restaure o config
mv next.config.ts.backup next.config.ts
```

### 2.3 Análise do Bundle

```bash
# Veja o tamanho dos arquivos gerados
npm run build 2>&1 | grep "Route (app)"

# Para análise detalhada, instale:
npm install --save-dev @next/bundle-analyzer

# Adicione ao next.config.ts:
# const withBundleAnalyzer = require('@next/bundle-analyzer')({
#   enabled: process.env.ANALYZE === 'true',
# })

# Execute:
ANALYZE=true npm run build
```

---

## 3. Testes de Deploy

### 3.1 Teste de Deploy Manual (GitHub Pages)

**⚠️ Só funciona com `output: 'export'` habilitado!**

```bash
# Verifique se gh-pages está instalado
npm list gh-pages

# Execute o deploy
npm run deploy

# Monitore o processo:
# > vale-dos-carajas@0.1.0 deploy
# > next build && gh-pages -d out -t
# 
# Published
```

### 3.2 Teste de Workflow Local

Use `act` para testar workflows GitHub Actions localmente:

```bash
# Instale act (GitHub Actions local runner)
# macOS: brew install act
# Linux: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Execute o workflow de deploy localmente
act push -W .github/workflows/deploy.yml

# Ou teste apenas o job de build
act -j build-and-deploy
```

### 3.3 Verificar Deploy no GitHub

```bash
# Abra o navegador em:
# https://github.com/Dreams-Consult/vale-dos-carajas/actions

# Ou use GitHub CLI:
gh workflow list
gh run list --workflow=deploy.yml
gh run view <run-id>
```

---

## 4. Testes Funcionais

### 4.1 Teste de Criação de Mapa

1. Acesse: `http://localhost:3000/admin/map-management`
2. Clique em "Novo Mapa" ou "Importar Mapa"
3. Faça upload de uma imagem ou PDF
4. Preencha os campos obrigatórios
5. Clique em "Salvar"

**✅ Resultado Esperado:**
- Mapa aparece na lista
- Imagem é carregada corretamente
- Possível navegar para gerenciamento de lotes

### 4.2 Teste de Criação de Lote

1. Acesse: `http://localhost:3000/admin/lot-management?mapId=X`
2. Clique em "Novo Lote"
3. Desenhe a área do lote no canvas
4. Preencha os campos (número, área, preço, status)
5. Clique em "Salvar Lote"

**✅ Resultado Esperado:**
- Lote aparece no mapa com cor correspondente ao status
- Lote aparece na lista lateral
- Possível editar ou deletar o lote

### 4.3 Teste de Visualização Pública

1. Acesse: `http://localhost:3000/`
2. Selecione um mapa no dropdown
3. Passe o mouse sobre os lotes
4. Clique em um lote disponível

**✅ Resultado Esperado:**
- Mapa carrega corretamente
- Tooltip mostra informações do lote no hover
- Modal de interesse abre ao clicar
- Estatísticas são exibidas corretamente

### 4.4 Teste de Reserva de Lote

1. Na página pública, clique em um lote disponível
2. Preencha o formulário de interesse
3. Clique em "Enviar"

**✅ Resultado Esperado:**
- Formulário valida campos obrigatórios
- Mensagem de sucesso é exibida
- Lote muda de status (se configurado)
- Dados são salvos no banco/localStorage

### 4.5 Teste de Autenticação

```bash
# Teste de Login
curl -X POST http://localhost:3000/api/usuarios/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"senha123"}'

# Teste de Criação de Usuário
curl -X POST http://localhost:3000/api/usuarios/criar \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste","email":"teste@example.com","senha":"senha123","role":"user"}'

# Teste de Reset de Senha
curl -X POST http://localhost:3000/api/password/reset \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@example.com"}'
```

---

## 5. Testes de Performance

### 5.1 Lighthouse (Chrome DevTools)

1. Abra o site no Chrome
2. Abra DevTools (F12)
3. Vá para aba "Lighthouse"
4. Selecione "Performance", "Accessibility", "Best Practices", "SEO"
5. Clique em "Analyze page load"

**Metas:**
- Performance: > 80
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 80

### 5.2 WebPageTest

```bash
# Acesse: https://www.webpagetest.org/
# Insira a URL do site
# Selecione localização de teste
# Execute o teste
```

### 5.3 Teste de Carga com Artillery

```bash
# Instale artillery
npm install -g artillery

# Crie arquivo de teste: load-test.yml
cat > load-test.yml << EOF
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: "/"
      - get:
          url: "/admin/map-management"
      - get:
          url: "/api/mapas"
EOF

# Execute o teste
artillery run load-test.yml
```

---

## 6. Solução de Problemas

### Problema 1: `npm install` falha

```bash
# Limpe cache do npm
npm cache clean --force

# Delete node_modules e package-lock.json
rm -rf node_modules package-lock.json

# Reinstale
npm install
```

### Problema 2: Erro de conexão com banco de dados

```bash
# Verifique se MySQL está rodando
mysql -u seu_usuario -p

# Verifique as variáveis de ambiente
cat .env.local

# Teste a conexão manualmente
mysql -h localhost -u seu_usuario -p -e "SHOW DATABASES;"
```

### Problema 3: Porta 3000 já em uso

```bash
# Encontre o processo usando a porta
lsof -i :3000

# Mate o processo
kill -9 <PID>

# Ou use outra porta
PORT=3001 npm run dev
```

### Problema 4: Build falha

```bash
# Limpe builds anteriores
rm -rf .next out

# Verifique erros de TypeScript
npx tsc --noEmit

# Execute build com logs detalhados
npm run build -- --debug
```

### Problema 5: Deploy GitHub Pages falha

```bash
# Verifique os logs no GitHub Actions
# https://github.com/Dreams-Consult/vale-dos-carajas/actions

# Principais causas:
# 1. output: 'export' não habilitado no next.config.ts
# 2. API Routes presentes (incompatível com export)
# 3. Rotas dinâmicas sem fallback adequado

# Solução: Use servidor Node.js ou remova API Routes
```

### Problema 6: Páginas 404 no GitHub Pages

```bash
# Causa: basePath não configurado corretamente

# Verifique next.config.ts:
# basePath: '/vale-dos-carajas'

# URLs devem incluir o basePath:
# ✅ https://dreams-consult.github.io/vale-dos-carajas/
# ❌ https://dreams-consult.github.io/
```

---

## 📊 Checklist de Testes Completo

### Antes de cada Deploy:
- [ ] `npm install` sem erros
- [ ] `npm run dev` funciona
- [ ] `npm run build` completa com sucesso
- [ ] `npm start` funciona após build
- [ ] Todas as páginas principais carregam
- [ ] API Routes respondem corretamente
- [ ] Console do navegador sem erros críticos
- [ ] Lighthouse score aceitável
- [ ] Testes funcionais passam
- [ ] Documentação atualizada

### Após Deploy:
- [ ] URL de produção acessível
- [ ] Todas as rotas funcionam
- [ ] Assets carregam corretamente
- [ ] SSL/HTTPS funciona (se aplicável)
- [ ] Banco de dados conecta corretamente
- [ ] Monitoramento configurado
- [ ] Logs sendo coletados

---

## 🔗 Links Úteis

- [Next.js Documentation](https://nextjs.org/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Deployment](https://vercel.com/docs)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

---

**Última Atualização:** 28 de Janeiro de 2026  
**Responsável:** GitHub Copilot - Análise Automática
