# Quick Start - Puppeteer Automation

## ⚡ 5 Minutos para ponerlo funcionando

### Paso 1: Instalar el servicio (1 min)

```bash
cd tai-loy-automation-service
npm install
cp .env.example .env
```

### Paso 2: Configurar credenciales (.env)

Abre `tai-loy-automation-service/.env` y edita:

```env
PORT=3000
TAILOY_USER=20603116021
TAILOY_PASS=60014709
AUTHORIZED_ORIGINS=http://localhost:5173
NODE_ENV=development
```

**⚠️ IMPORTANTE:** Nunca pushees el `.env` a GitHub. Ya está en `.gitignore`.

### Paso 3: Ejecutar localmente (1 min)

```bash
npm run dev
```

Deberías ver:
```
🚀 Tai Loy Automation Service running on port 3000
📍 User: 20603116021
🔐 Password: ***
```

### Paso 4: Configurar Edge Function (1 min)

En Supabase Console → Settings → Environment Variables:

```
AUTOMATION_SERVICE_URL = http://localhost:3000
```

(Si estás en desarrollo. En producción será `https://tu-servicio.onrender.com`)

### Paso 5: Test (1 min)

```bash
# En otra terminal
curl -X POST http://localhost:3000/automate-cita \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-04-15","hora":"14:00:00 - 16:00:00"}'
```

Respuesta esperada:
```json
{"success": true, "message": "Cita registrada en Tai Loy automáticamente"}
```

---

## ✅ ¿Funciona?

Si todo está bien, ahora:

1. Abre tu app React (http://localhost:5173)
2. Carga un PDF de OC
3. Selecciona fecha
4. Click "Enviar a Tai Loy"
5. Espera 10-20 segundos
6. Deberías ver "✓ Cita registrada en Tai Loy automáticamente"

---

## 🚀 Desplegar a Producción

Cuando quieras poner esto en vivo:

### Opción A: Render.com (RECOMENDADO - Gratuito)

1. Copia el contenido de `tai-loy-automation-service/` a tu repo
2. Ve a https://render.com → New Web Service
3. Conecta tu GitHub
4. Build: `npm install`
5. Start: `npm start`
6. Agrega vars de entorno
7. Click Deploy

Tu URL será: `https://tai-loy-automation-xxxxx.onrender.com`

### Opción B: Tu servidor

```bash
ssh tu-servidor.com

# Clona el repo
git clone https://github.com/tu-usuario/tu-repo.git
cd tai-loy-automation-service

# Instala
npm install

# Configura .env
nano .env  # Edita con tus datos

# Ejecuta (opción 1: directo)
npm start

# O (opción 2: con PM2 para background)
npx pm2 start server.js --name "tai-loy"
npx pm2 save
```

---

## 📝 Notas Importantes

- **Credenciales:** Cambia las del usuario Tai Loy por las reales si es diferente
- **CORS:** Agrega tu dominio en `AUTHORIZED_ORIGINS` antes de desplegar
- **Variables Supabase:** La var `AUTOMATION_SERVICE_URL` debe apuntar a tu servicio desplegado
- **Logs:** Mira los logs para debugging:
  - Local: Terminal
  - Render: Dashboard → Logs
  - Tu servidor: `tail -f ~/.pm2/logs/tai-loy-error.log`

---

## 🔥 Cambios Importantes en el Código

### Antes (No funcionaba)
```javascript
// CitaEditor.tsx
await startTaiLoyAutomation({...}) // ❌ Bloqueado por CORS en browser
```

### Después (Funciona)
```typescript
// CitaEditor.tsx
const { data } = await supabase.functions.invoke("trigger-tai-loy-cita", {...})
// Edge Function → Node.js Service → Puppeteer → Tai Loy
```

---

**¡Listo! Ya tienes automatización funcional.**

Para más detalles, ver:
- `TAI_LOY_AUTOMATION_SETUP.md` - Setup completo
- `tai-loy-automation-service/DEPLOYMENT.md` - Deployment detallado
- `tai-loy-automation-service/server.js` - Código Puppeteer
