# Otimizações de Memória Implementadas

## Problema Identificado
- Servidor com apenas 1.7GB RAM
- Next.js crashando por falta de memória (OOM)
- Logs mostrando: `upstream timed out` → `connection refused`

## Mudanças no Código

### 1. **next.config.ts** - Otimizações de Build e Runtime
```typescript
- compress: true // Compressão gzip
- generateEtags: false // Reduz processamento
- workerThreads: false // Usa menos memória
- cpus: 1 // Limita threads em produção
- webpack optimization // Minimiza bundle
```

### 2. **lib/db.ts** - Connection Pool
```typescript
- Connection Pool com limite de 5 conexões
- Reutilização de conexões (release vs end)
- Timeout configurado (10s)
- KeepAlive habilitado
```

**Antes:** Criava nova conexão para cada request  
**Depois:** Reutiliza pool de 5 conexões

## Deploy no Servidor

### 1. Atualizar código:
```bash
cd /var/www/imobiliaria
git pull origin main
npm install
npm run build
```

### 2. Configurar PM2 com limite de memória:
```bash
pm2 stop all
pm2 delete all
pm2 start npm --name "next-app" \
  --max-memory-restart 800M \
  --node-args="--max-old-space-size=800" \
  -- start
pm2 save
```

### 3. Configurar sistema para usar swap:
```bash
sudo sysctl vm.swappiness=60
sudo sysctl vm.vfs_cache_pressure=50
echo "vm.swappiness=60" | sudo tee -a /etc/sysctl.conf
echo "vm.vfs_cache_pressure=50" | sudo tee -a /etc/sysctl.conf
```

### 4. Monitorar:
```bash
# Memória em tempo real
watch -n 2 free -h

# Logs do PM2
pm2 logs --lines 100

# CPU e memória do processo
pm2 monit
```

## Resultados Esperados
- ✅ Uso de memória reduzido em ~30-40%
- ✅ Conexões de banco reutilizadas
- ✅ Reinício automático se exceder 800MB
- ✅ Uso do swap antes de crash
- ✅ Menos timeout errors no nginx

## Monitoramento Contínuo
```bash
# Verificar se está usando swap
free -h

# Ver conexões MySQL
mysql -u root -p -e "SHOW PROCESSLIST;"

# Ver logs do nginx
sudo tail -f /var/log/nginx/error.log
```
