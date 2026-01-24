# Fluxo de Polígonos e Lotes

## 📍 Contextos Diferentes

### 1. `/admin/map-details/?mapId=XXX` (Administração)

**Objetivo:** Gerenciar loteamento, quadras e lotes

#### Configurar Área do Loteamento:
1. Clique em "Configurar Área" no header
2. Busque o endereço do loteamento
3. Desenhe o polígono da área total
4. Salve as coordenadas

#### Vincular Lote a Área:
1. Cadastre o lote (número, tamanho, preço, etc.)
2. No seletor de lotes, clique no lote desejado
3. Clique no botão **"Definir Área"** ou **"Editar Área"**
4. Modal LotPolygonEditor abre mostrando:
   - Polígono verde do loteamento (contexto)
   - Ferramentas para desenhar o polígono do lote
5. Desenhe o polígono do lote dentro da área
6. Clique em "Salvar Coordenadas"
7. As coordenadas são salvas no banco: `lot.coordinates`

**✅ Importante:**
- Lotes podem ser cadastrados SEM coordenadas
- Coordenadas são opcionais nesta fase
- Use "Definir Área" apenas para lotes que aparecerão no mapa público

---

### 2. `/maps/` (Página Pública)

**Objetivo:** Usuários visualizam e reservam lotes

#### O que aparece:
- ✅ Polígono verde: Área total do loteamento (NÃO clicável)
- ✅ Polígonos coloridos: Apenas lotes com `coordinates` definidas
  - 🔵 Azul: Disponível
  - 🟡 Amarelo: Reservado
  - 🔴 Vermelho: Vendido
  - ⚫ Cinza: Bloqueado

#### Interação:
1. Passe o mouse sobre polígono do lote → Destaque visual
2. Clique no polígono → Modal com informações do lote
3. No modal: Veja detalhes e adicione à lista de compra
4. Selecione múltiplos lotes e finalize reserva

**✅ Importante:**
- Apenas lotes com `lot.coordinates` aparecem
- Lotes sem coordenadas ficam invisíveis
- Não é possível clicar no polígono verde (área do loteamento)

---

## 🔄 Fluxo Completo

```
1. Admin: Criar Loteamento
   ↓
2. Admin: Configurar Área do Loteamento (polígono verde)
   ↓
3. Admin: Cadastrar Quadras
   ↓
4. Admin: Cadastrar Lotes (número, tamanho, preço)
   ↓
5. Admin: Definir Área de cada Lote (polígonos coloridos)
   ↓
6. Público: Ver lotes no mapa e fazer reservas
```

---

## 🐛 Troubleshooting

### "Não vejo lotes no mapa em /maps/"
- ✅ Verifique se os lotes têm coordenadas definidas
- ✅ Abra console (F12) e veja: `[PublicMapViewer] Lotes com coordenadas: X`
- ✅ Se for 0, vá em `/admin/map-details/` e defina áreas

### "Não consigo clicar no polígono verde em /maps/"
- ✅ Isso é esperado! O polígono verde é apenas visual
- ✅ Clique nos polígonos coloridos (dos lotes)

### "Como vincular lote a área?"
- ✅ `/admin/map-details/?mapId=XXX`
- ✅ Clique no lote → Botão "Definir Área"
- ✅ Desenhe polígono → Salvar

---

## 📊 Verificar Status

### Console do Navegador (F12):
```
[Maps Page] Renderizando PublicMapViewer com: {
  lotsTotal: 30,
  lotsComCoordenadas: 5,  ← Apenas 5 lotes têm áreas definidas
  selectedMap: "Vale dos Carajás"
}

[PublicMapViewer] Lotes com coordenadas: 5  ← Confirmação
```

### Banco de Dados:
```sql
SELECT lotNumber, status, 
       CASE WHEN coordinates IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_area
FROM lots 
WHERE mapId = 'XXX';
```
