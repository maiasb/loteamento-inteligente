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

### Instalação e Migrations

```bash
# Instalar dependências
npm install

# Executar migrations do banco de dados
npm run migrate

# Iniciar servidor de desenvolvimento
npm run dev
```

O servidor estará disponível em http://localhost:3000

> 📚 **Sobre Migrations**: O sistema utiliza migrations para gerenciar alterações no schema do banco de dados.
> Para mais detalhes, consulte [MIGRATIONS.md](./MIGRATIONS.md)

## 📋 Funcionalidades Implementadas

### 1. **Gerenciamento de Mapas** (`/admin/maps`)
- ✅ Upload de imagens ou PDFs como mapas base
- ✅ Listagem de mapas cadastrados
- ✅ Exclusão de mapas (remove lotes associados automaticamente)
- ✅ Navegação para gerenciamento de lotes

### 2. **Importação de Loteamentos** (`/admin/import-map`)
- ✅ **Importação via JSON**: Upload de arquivo JSON com estrutura completa
- ✅ **Importação via Excel**: Upload de planilhas .xlsx com conversão automática
- ✅ Editor de JSON integrado com preview
- ✅ Validação de dados antes da importação
- ✅ Suporte a reservas e vendas na importação
- ✅ Templates e guias de uso disponíveis
- 📚 Ver guia completo: [EXCEL_IMPORT_GUIDE.md](./EXCEL_IMPORT_GUIDE.md)

### 3. **Gerenciamento de Lotes** (`/admin/lots/[mapId]`)
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

### 4. **Página Pública** (`/`)
- ✅ Mapa interativo com lotes coloridos
- ✅ Hover mostra informações rápidas do lote
- ✅ Click em lotes disponíveis abre modal de interesse
- ✅ Estatísticas em tempo real
- ✅ Legenda de cores
- ✅ Suporte a múltiplos mapas

### 5. **Sistema de Manifestação de Interesse**
- ✅ Modal com formulário completo
- ✅ Validação de campos
- ✅ Persistência de dados

## 🎯 Como Usar

### Início Rápido (3 passos)

**Opção 1: Importar Loteamento Completo (Excel ou JSON)**
1. **Preparar Dados**
   ```
   Criar planilha Excel seguindo o modelo ou preparar JSON
   Ver: EXCEL_IMPORT_GUIDE.md ou EXCEL_TEMPLATE.md
   ```

2. **Importar**
   ```
   http://localhost:3000/admin/import-map → Selecionar tipo → Upload
   ```

3. **Visualizar**
   ```
   http://localhost:3000 → Ver mapa com todos os lotes
   ```

**Opção 2: Criar Manualmente**
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
- **Banco de Dados**: MySQL com mysql2
- **Importação**: xlsx para processamento de planilhas Excel
- **PDF**: pdfjs-dist para renderização de PDFs

## 📄 Documentação

### Guias de Uso
- **[QUICKSTART.md](./QUICKSTART.md)**: Guia rápido de início
- **[INSTRUCTIONS.md](./INSTRUCTIONS.md)**: Manual completo do sistema
- **[MIGRATIONS.md](./MIGRATIONS.md)**: Sistema de migrations do banco de dados

### Importação de Dados
- **[EXCEL_IMPORT_GUIDE.md](./EXCEL_IMPORT_GUIDE.md)**: Guia completo de importação via Excel
- **[EXCEL_TEMPLATE.md](./EXCEL_TEMPLATE.md)**: Modelo de planilha Excel
- **[IMPORT_WITH_RESERVATIONS.md](./IMPORT_WITH_RESERVATIONS.md)**: Importação JSON com reservas

### API e Configuração
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: Documentação das rotas da API
- **[ENV_MIGRATION.md](./ENV_MIGRATION.md)**: Configuração de variáveis de ambiente
- **[PDF_SUPPORT.md](./PDF_SUPPORT.md)**: Suporte a PDFs pesados

### Scripts
- **[convert-pdf.sh](./convert-pdf.sh)**: Script conversão PDF

---

**Servidor rodando em**: http://localhost:3000

