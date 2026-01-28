#!/bin/bash

# Script de Verificação de Status do Deploy
# Vale dos Carajás - Dreams Consult
# 
# Este script verifica o status atual do sistema e configurações de deploy

set -e

echo "=============================================="
echo "  Status do Deploy - Vale dos Carajás"
echo "=============================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Verificar Node.js
echo -e "${BLUE}[1/10]${NC} Verificando Node.js..."
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js instalado: $NODE_VERSION"
    
    # Verificar versão mínima (18+)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        echo -e "  ${GREEN}✓${NC} Versão adequada (≥ 18)"
    else
        echo -e "  ${RED}✗${NC} Versão muito antiga (< 18)"
    fi
else
    echo -e "  ${RED}✗${NC} Node.js não encontrado"
fi
echo ""

# 2. Verificar npm
echo -e "${BLUE}[2/10]${NC} Verificando npm..."
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "  ${GREEN}✓${NC} npm instalado: v$NPM_VERSION"
else
    echo -e "  ${RED}✗${NC} npm não encontrado"
fi
echo ""

# 3. Verificar dependências
echo -e "${BLUE}[3/10]${NC} Verificando dependências..."
if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} node_modules existe"
    MODULE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo -e "  ${GREEN}✓${NC} $MODULE_COUNT módulos instalados"
else
    echo -e "  ${RED}✗${NC} node_modules não encontrado"
    echo -e "  ${YELLOW}→${NC} Execute: npm install"
fi
echo ""

# 4. Verificar arquivos de configuração
echo -e "${BLUE}[4/10]${NC} Verificando arquivos de configuração..."

if [ -f "package.json" ]; then
    echo -e "  ${GREEN}✓${NC} package.json existe"
else
    echo -e "  ${RED}✗${NC} package.json não encontrado"
fi

if [ -f "next.config.ts" ]; then
    echo -e "  ${GREEN}✓${NC} next.config.ts existe"
    
    # Verificar se output: 'export' está habilitado
    if grep -q "output.*:.*'export'" next.config.ts && ! grep -q "//.*output.*:.*'export'" next.config.ts; then
        echo -e "  ${GREEN}✓${NC} output: 'export' está HABILITADO (modo estático)"
    else
        echo -e "  ${YELLOW}⚠${NC} output: 'export' está DESABILITADO (modo servidor)"
    fi
else
    echo -e "  ${RED}✗${NC} next.config.ts não encontrado"
fi

if [ -f ".env.local" ]; then
    echo -e "  ${GREEN}✓${NC} .env.local existe"
else
    echo -e "  ${YELLOW}⚠${NC} .env.local não encontrado"
    echo -e "  ${YELLOW}→${NC} Execute: cp .env.example .env.local"
fi
echo ""

# 5. Verificar build anterior
echo -e "${BLUE}[5/10]${NC} Verificando builds anteriores..."
if [ -d ".next" ]; then
    echo -e "  ${GREEN}✓${NC} .next/ existe (build de servidor)"
    NEXT_SIZE=$(du -sh .next 2>/dev/null | cut -f1)
    echo -e "  ${GREEN}✓${NC} Tamanho: $NEXT_SIZE"
else
    echo -e "  ${YELLOW}⚠${NC} .next/ não encontrado"
fi

if [ -d "out" ]; then
    echo -e "  ${GREEN}✓${NC} out/ existe (build estático)"
    OUT_SIZE=$(du -sh out 2>/dev/null | cut -f1)
    echo -e "  ${GREEN}✓${NC} Tamanho: $OUT_SIZE"
else
    echo -e "  ${YELLOW}⚠${NC} out/ não encontrado"
fi
echo ""

# 6. Verificar scripts disponíveis
echo -e "${BLUE}[6/10]${NC} Verificando scripts npm..."
if [ -f "package.json" ]; then
    if grep -q '"dev"' package.json; then
        echo -e "  ${GREEN}✓${NC} npm run dev"
    fi
    if grep -q '"build"' package.json; then
        echo -e "  ${GREEN}✓${NC} npm run build"
    fi
    if grep -q '"start"' package.json; then
        echo -e "  ${GREEN}✓${NC} npm start"
    fi
    if grep -q '"deploy"' package.json; then
        echo -e "  ${GREEN}✓${NC} npm run deploy"
    fi
fi
echo ""

# 7. Verificar workflows do GitHub Actions
echo -e "${BLUE}[7/10]${NC} Verificando workflows GitHub Actions..."
if [ -d ".github/workflows" ]; then
    WORKFLOW_COUNT=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
    echo -e "  ${GREEN}✓${NC} $WORKFLOW_COUNT workflow(s) encontrado(s)"
    
    for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
        if [ -f "$workflow" ]; then
            WORKFLOW_NAME=$(basename "$workflow")
            echo -e "     - $WORKFLOW_NAME"
        fi
    done
else
    echo -e "  ${YELLOW}⚠${NC} .github/workflows/ não encontrado"
fi
echo ""

# 8. Verificar Git
echo -e "${BLUE}[8/10]${NC} Verificando Git..."
if command_exists git; then
    echo -e "  ${GREEN}✓${NC} Git instalado"
    
    if [ -d ".git" ]; then
        echo -e "  ${GREEN}✓${NC} Repositório Git inicializado"
        
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
        echo -e "  ${GREEN}✓${NC} Branch atual: $CURRENT_BRANCH"
        
        REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "none")
        echo -e "  ${GREEN}✓${NC} Remote: $REMOTE_URL"
    else
        echo -e "  ${RED}✗${NC} Não é um repositório Git"
    fi
else
    echo -e "  ${RED}✗${NC} Git não encontrado"
fi
echo ""

# 9. Testar build rápido (opcional - comentado por padrão)
echo -e "${BLUE}[9/10]${NC} Teste de build..."
echo -e "  ${YELLOW}⚠${NC} Teste de build desabilitado (muito lento)"
echo -e "  ${YELLOW}→${NC} Para testar: npm run build"
echo ""

# 10. Verificar conectividade
echo -e "${BLUE}[10/10]${NC} Verificando conectividade..."
if command_exists curl; then
    echo -e "  ${GREEN}✓${NC} curl instalado"
    
    # Testar conexão com GitHub
    if curl -s --head --request GET https://github.com | grep "200 OK" > /dev/null; then
        echo -e "  ${GREEN}✓${NC} Conectividade com GitHub: OK"
    else
        echo -e "  ${YELLOW}⚠${NC} Conectividade com GitHub: FALHOU"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} curl não encontrado"
fi
echo ""

# Resumo e recomendações
echo "=============================================="
echo "  RESUMO E RECOMENDAÇÕES"
echo "=============================================="
echo ""

# Determinar modo de deploy
if grep -q "output.*:.*'export'" next.config.ts 2>/dev/null && ! grep -q "//.*output.*:.*'export'" next.config.ts 2>/dev/null; then
    echo -e "${GREEN}Modo de Deploy:${NC} Estático (GitHub Pages)"
    echo ""
    echo "Comandos para testar:"
    echo "  1. npm run build        # Gera pasta out/"
    echo "  2. npm run deploy       # Publica no GitHub Pages"
    echo ""
    echo "Limitações:"
    echo "  - API Routes não funcionarão"
    echo "  - Sem Server-Side Rendering"
    echo "  - Dados em localStorage apenas"
else
    echo -e "${YELLOW}Modo de Deploy:${NC} Servidor Node.js"
    echo ""
    echo "Comandos para testar:"
    echo "  1. npm run dev          # Desenvolvimento"
    echo "  2. npm run build        # Build de produção"
    echo "  3. npm start            # Servidor de produção"
    echo ""
    echo "Plataformas recomendadas:"
    echo "  - Vercel (gratuito)"
    echo "  - Railway"
    echo "  - Render"
    echo "  - HostGator VPS"
fi

echo ""
echo -e "${BLUE}Para mais informações, consulte:${NC}"
echo "  - DEPLOY_STATUS.md    # Status completo do deploy"
echo "  - TESTING_GUIDE.md    # Guia de testes"
echo "  - README.md           # Documentação geral"
echo ""

# Verificação final
echo "=============================================="
echo ""

if [ -d "node_modules" ] && [ -f "next.config.ts" ]; then
    echo -e "${GREEN}✓ Sistema pronto para desenvolvimento!${NC}"
    echo ""
    echo "Execute: npm run dev"
else
    echo -e "${RED}✗ Sistema requer configuração${NC}"
    echo ""
    echo "Execute: npm install"
fi

echo ""
echo "=============================================="
