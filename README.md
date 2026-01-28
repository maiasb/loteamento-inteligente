# 🏡 Plataforma de Gerenciamento de Lotes - Imobiliária Vale dos Carajás

## ✅ Sistema Implementado com Sucesso!

### 🚀 Status
- ✅ Servidor rodando em **http://localhost:3000**
- ✅ Todos os componentes implementados
- ✅ Sistema funcional e pronto para uso
- ⚠️ Deploy automático requer configuração - [Ver Status](./DEPLOY_SUMMARY.md)

### 📚 Documentação de Deploy e Testes
- **[DEPLOY_SUMMARY.md](./DEPLOY_SUMMARY.md)** - Resumo executivo do status de deploy
- **[DEPLOY_STATUS.md](./DEPLOY_STATUS.md)** - Análise completa do deploy automático
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Guia completo de testes
- **[check-deploy-status.sh](./check-deploy-status.sh)** - Script de verificação de status

## ⚙️ Configuração Inicial

### Variáveis de Ambiente

O sistema utiliza variáveis de ambiente para configurações sensíveis como credenciais do banco de dados.

1. **Copie o arquivo de exemplo**:
   ```bash
   cp .env.example .env.local
   ```

2. **Configure suas credenciais** no arquivo `.env.local`:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   DB_NAME=vale_dos_carajas
   NEXT_PUBLIC_API_URL=/api
   ```

3. **Nunca commite o arquivo `.env.local`** - ele está no `.gitignore` para sua segurança.

### Instalação

```bash
npm install
npm run dev
```

O servidor estará disponível em http://localhost:3000

## 📋 Funcionalidades Implementadas

### 1. **Gerenciamento de Mapas** (`/admin/maps`)
- ✅ Upload de imagens ou PDFs como mapas base
- ✅ Listagem de mapas cadastrados
- ✅ Exclusão de mapas (remove lotes associados automaticamente)
- ✅ Navegação para gerenciamento de lotes

### 2. **Gerenciamento de Lotes** (`/admin/lots/[mapId]`)
- ✅ Canvas interativo para desenhar áreas de lotes
- ✅ Criação de polígonos com múltiplos pontos
- ✅ CRUD completo de lotes:
  - Número do lote
  - Área em m²
  - Preço
  - Status (Disponível/Reservado/Vendido)
  - Descrição
  - Características/amenidades
- ✅ Visualização em tempo real no mapa
- ✅ Edição de lotes existentes
- ✅ Exclusão de lotes
- ✅ Cores diferenciadas por status

### 3. **Página Pública** (`/`)
- ✅ Mapa interativo com lotes coloridos
- ✅ Hover mostra informações rápidas do lote
- ✅ Click em lotes disponíveis abre modal de interesse
- ✅ Estatísticas em tempo real
- ✅ Legenda de cores
- ✅ Suporte a múltiplos mapas

### 4. **Sistema de Manifestação de Interesse**
- ✅ Modal com formulário completo
- ✅ Validação de campos
- ✅ Persistência de dados

## 🎯 Como Usar

### Início Rápido (3 passos)

1. **Upload do Mapa**
   ```
   http://localhost:3000/admin/maps → Novo Mapa → Upload
   ```

2. **Criar Lotes**
   ```
   Gerenciar Lotes → Novo Lote → Desenhar área → Salvar
   ```

3. **Visualizar Página Pública**
   ```
   http://localhost:3000 → Ver mapa interativo
   ```

Para instruções completas, veja **[QUICKSTART.md](./QUICKSTART.md)**

## 🛠️ Stack Tecnológica

- **Framework**: Next.js 16 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS 4
- **Canvas**: HTML5 Canvas API
- **Persistência**: localStorage

## 📄 Documentação

- **[INSTRUCTIONS.md](./INSTRUCTIONS.md)**: Manual completo
- **[QUICKSTART.md](./QUICKSTART.md)**: Guia rápido
- **[convert-pdf.sh](./convert-pdf.sh)**: Script conversão PDF

---

**Servidor rodando em**: http://localhost:3000

