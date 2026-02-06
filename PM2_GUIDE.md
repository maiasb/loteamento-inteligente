# 🚀 Guia PM2 - Vale dos Carajás

## Comandos rápidos

### Desenvolvimento local
```bash
npm run dev           # Modo desenvolvimento
```

### Produção com PM2
```bash
npm run build         # Compilar para produção
npm run pm2:start     # Iniciar com PM2
npm run pm2:restart   # Reiniciar aplicação
npm run pm2:stop      # Parar aplicação
npm run pm2:logs      # Ver últimas 100 linhas de logs
npm run pm2:monit     # Monitoramento em tempo real
npm run pm2:status    # Status das aplicações
```

## Deploy em produção

### Primeira vez
```bash
# No servidor (via SSH)
cd /var/www/vale-dos-carajas

# 1. Atualizar código
git pull

# 2. Instalar dependências
npm install --production

# 3. Build
npm run build

# 4. Criar diretório de logs
mkdir -p logs

# 5. Iniciar com PM2
pm2 start ecosystem.config.js

# 6. Salvar configuração (auto-start no boot)
pm2 save
pm2 startup
```

### Atualizações subsequentes
```bash
cd /var/www/vale-dos-carajas
git pull
npm install --production
npm run build
pm2 restart vale-dos-carajas
```

## Comandos PM2 úteis

### Status e monitoramento
```bash
pm2 status                    # Lista todas as apps
pm2 describe vale-dos-carajas # Detalhes da aplicação
pm2 monit                     # Dashboard em tempo real
pm2 list                      # Lista processos
```

### Logs
```bash
pm2 logs vale-dos-carajas           # Logs em tempo real
pm2 logs vale-dos-carajas --lines 50 # Últimas 50 linhas
pm2 logs vale-dos-carajas --err      # Só erros
pm2 flush vale-dos-carajas          # Limpar logs
```

### Controle
```bash
pm2 restart vale-dos-carajas    # Reiniciar
pm2 reload vale-dos-carajas     # Reload (sem downtime)
pm2 stop vale-dos-carajas       # Parar
pm2 start vale-dos-carajas      # Iniciar
pm2 delete vale-dos-carajas     # Remover do PM2
```

### Memória e performance
```bash
pm2 describe vale-dos-carajas   # Ver uso de memória/CPU
pm2 monit                       # Dashboard interativo
pm2 reset vale-dos-carajas      # Resetar contadores
```

## Configuração atual (ecosystem.config.js)

- **Modo**: Fork (1 instância)
- **Memória máxima**: 350MB (ideal para VPS 2GB)
- **Auto-restart**: Habilitado
- **Max restarts**: 10 por minuto
- **Logs**: `/var/www/vale-dos-carajas/logs/`

## Troubleshooting

### App não inicia
```bash
# Ver erros
pm2 logs vale-dos-carajas --err --lines 50

# Verificar porta
sudo lsof -i :3000

# Verificar memória
free -h
```

### Erro de memória
```bash
# Verificar uso
pm2 describe vale-dos-carajas

# Ajustar limite no ecosystem.config.js
max_memory_restart: "400M"  # Aumentar se necessário
```

### Muitos restarts
```bash
# Ver quantidade de restarts
pm2 status

# Ver causa
pm2 logs vale-dos-carajas --err --lines 100

# Possíveis causas:
# - Erro no código
# - Memória insuficiente
# - Porta já em uso
# - DB connection falhou
```

### Logs gigantes
```bash
# Limpar logs
pm2 flush vale-dos-carajas

# Configurar rotação de logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Health checks

### Manual
```bash
# Verificar se está rodando
curl http://localhost:3000/api/health/

# Deve retornar:
# {"status":"healthy","database":"connected","timestamp":"..."}
```

### Automatizado (cron)
```bash
# Adicionar ao crontab
crontab -e

# Adicionar linha:
*/5 * * * * curl -f http://localhost:3000/api/health/ || pm2 restart vale-dos-carajas
```

## Cluster mode (para servidores maiores)

Se tiver **4GB+ RAM**, pode usar cluster:

```javascript
// ecosystem.config.js
{
  exec_mode: "cluster",
  instances: 2,  // ou "max" para usar todas CPUs
  max_memory_restart: "700M",
}
```

## Backup e rollback

### Antes de atualizar
```bash
# Fazer backup do build
cp -r .next .next.backup

# Se algo der errado
rm -rf .next
mv .next.backup .next
pm2 restart vale-dos-carajas
```

## Configuração nginx (se usar)

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Alertas e notificações

### Instalar PM2 Plus (opcional, mas recomendado)
```bash
pm2 install pm2-server-monit
# Ou usar Keymetrics/PM2 Plus para alertas via web
```

## Checklist de deploy

- [ ] `git pull` executado
- [ ] `npm install --production` sem erros
- [ ] `npm run build` completou com sucesso
- [ ] Variáveis `.env.production` estão corretas
- [ ] `pm2 restart vale-dos-carajas` executado
- [ ] `pm2 logs vale-dos-carajas` sem erros
- [ ] `curl http://localhost:3000/api/health/` retorna OK
- [ ] Site acessível no navegador
- [ ] `pm2 save` para persistir mudanças

## Comandos avançados

### Executar script único
```bash
# Rodar migração e depois sair
pm2 start npm --name "migrate" -- run migrate:prod
```

### Variáveis de ambiente runtime
```bash
# Alterar variável sem editar arquivo
pm2 restart vale-dos-carajas --update-env
```

### Fork vs Cluster
- **Fork**: 1 processo (melhor para <2GB RAM)
- **Cluster**: Múltiplos processos (melhor para 4GB+ RAM)

Dúvidas? Consulte: https://pm2.keymetrics.io/docs/usage/quick-start/
