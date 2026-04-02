# Automatización Tai Loy - Guía Completa de Setup

## 🎯 Objetivo

Automatizar completamente el proceso de registrar citas en Tai Loy:
1. Usuario presiona botón "Enviar a Tai Loy"
2. Sistema login automáticamente
3. Sistema navega a Nueva Cita
4. Sistema llena fecha y hora
5. Sistema guarda
6. ✅ Cita registrada

---

## 🏗️ Arquitectura

```
┌─────────────────────┐
│  React App          │ (Tu aplicación web)
│  CitaEditor.tsx     │
└──────────┬──────────┘
           │ Presiona "Enviar a Tai Loy"
           │
┌──────────▼──────────────────┐
│  Supabase Edge Function     │ (trigger-tai-loy-cita)
│  - Valida auth              │
│ - Llama Node.js Service     │
└──────────┬──────────────────┘
           │ POST /automate-cita
           │
┌──────────▼──────────────────┐
│  Node.js Service            │ (Puppeteer)
│  +- Puppeteer Browser       │ **EN TU SERVIDOR O RENDER.COM**
│   ├─ Login Tai Loy          │
│   ├─ Navigate Nueva Cita    │
│   ├─ Fill Form              │
│   └─ Save                   │
└──────────┬──────────────────┘
           │
        https://www1.tailoy.com.pe (Browser automático)
```

---

## 📦 Archivos Necesarios

### 1. **Node.js Service** (NEW)
```
tai-loy-automation-service/
├── server.js              ← Código Puppeteer
├── package.json           ← Dependencias
├── .env.example           ← Template variables
└── DEPLOYMENT.md          ← Cómo desplegar
```

### 2. **Supabase Edge Function** (MODIFICADA)
```
supabase/functions/trigger-tai-loy-cita/index.ts
├── Llama al servicio Node.js
└── Retorna resultado
```

### 3. **React App** (MODIFICADA)
```
src/pages/CitaEditor.tsx
├── Botón "Enviar a Tai Loy" llama Edge Function
└── Muestra estado de automatización
```

---

## 🚀 Setup Rápido

### Paso 1: Desplegar el Node.js Service

Elige UNA opción:

#### Opción A: En tu servidor (recomendado si tienes VPS)
```bash
cd tai-loy-automation-service
npm install
cp .env.example .env
# Edita .env con tus credenciales
npm start
```

Tu URL será: `http://tu-servidor.com:3000`

#### Opción B: En Render.com (gratuito, recomendado)
1. Ve a https://render.com/sign-up
2. Crea cuenta gratis
3. Click "New +" → "Web Service"
4. Conecta tu GitHub repo
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Agrega variables de entorno
8. Deploy

Tu URL será algo como: `https://tai-loy-automation-xxxxx.onrender.com`

### Paso 2: Configurar Supabase

1. Ve a tu proyecto Supabase
2. Settings → Edge Functions → Variables
3. Agrega nueva variable:
   ```
   AUTOMATION_SERVICE_URL = https://tu-servicio.onrender.com
   ```
4. Deploy la función (si hay cambios)

### Paso 3: Probar en la App

1. Abre CitaEditor
2. Carga un PDF de OC
3. Selecciona fecha
4. Click "Enviar a Tai Loy"
5. Espera a que diga "✓ Cita registrada"

---

## 🔧 Configuración de Variables de Entorno

### En el Node.js Service (.env)
```env
# Puerto
PORT=3000

# Credenciales Tai Loy
TAILOY_USER=20603116021
TAILOY_PASS=60014709

# CORS - Dominios autorizados
AUTHORIZED_ORIGINS=http://localhost:5173,https://tuapp.com

# Environment
NODE_ENV=production
```

### En Supabase (Settings → Environment Variables)
```
AUTOMATION_SERVICE_URL = https://tai-loy-automation-xxxxx.onrender.com
TAILOY_USER = 20603116021
TAILOY_PASS = 60014709
```

---

## 📋 Cambios en el Código

### 1. CitaEditor.tsx
```diff
- import { useTaiLoyAutomation } from "@/hooks/useTaiLoyAutomation";
+ // Removido, ahora usa Edge Function directamente

- const { startTaiLoyAutomation } = useTaiLoyAutomation();
+ const [isAutomating, setIsAutomating] = useState(false);

- await startTaiLoyAutomation({...})
+ const { data, error } = await supabase.functions.invoke("trigger-tai-loy-cita", {...})
```

### 2. Edge Function (trigger-tai-loy-cita/index.ts)
```typescript
// Ahora llama al servicio Node.js
const automationResponse = await fetch(
  `${AUTOMATION_SERVICE_URL}/automate-cita`,
  { method: "POST", body: JSON.stringify({...}) }
);
```

### 3. Node.js Service (NEW - server.js)
```javascript
// Usa Puppeteer para automatizar Tai Loy
const page = await browser.newPage();
await page.goto('https://www1.tailoy.com.pe/...');
// ... fill form, save, etc
```

---

## 🧪 Testing

### Test del servicio Node.js
```bash
curl -X POST http://localhost:3000/automate-cita \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-04-15","hora":"14:00:00 - 16:00:00"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Cita registrada en Tai Loy automáticamente",
  "data": {"fecha": "2026-04-15", "hora": "..."}
}
```

### Test en la app React
1. Abre DevTools (F12)
2. Ve a Network
3. Click "Enviar a Tai Loy"
4. Observa los requests:
   - `POST /functions/v1/trigger-tai-loy-cita` → a Supabase
   - La Edge Function llama → a tu Node.js Service
5. Mira la respuesta en Console

---

## ⚠️ Común Problemas

### "Connection refused" en localhost:3000
- El servicio no está corriendo
- Ejecuta: `npm start` en la carpeta del servicio

### "CORS error"
- El dominio no está en `AUTHORIZED_ORIGINS`
- Añade tu dominio en .env del servicio
- Redeploy

### "AUTOMATION_SERVICE_URL not configured"
- No definiste la variable en Supabase
- Agrega en Settings → Environment Variables
- Redeploy la Edge Function

### "Timeout" en Tai Loy
- El sitio es lento
- Aumenta timeout en server.js (línea ~80)
- O ejecuta en horarios menos congestionados

### "Login fails"
- Verifica credenciales en .env
- Prueba login manual en Tai Loy
- Verifica si Tai Loy cambió HTML (selectors)

---

## 📊 Estado Actual

✅ = Hecho
🔄 = En progreso
❌ = No hecho

| Tarea | Estado | Detalles |
|-------|--------|----------|
| Node.js Service creado | ✅ | Puppeteer listo en server.js |
| Edge Function actualizada | ✅ | Llama al servicio |
| CitaEditor.tsx actualizado | ✅ | Usa Edge Function |
| Servicio desplegado | ❌ | Falta elegir hosting y desplegar |
| Variables de entorno configuradas | ❌ | Falta en Supabase |
| Testing manual | ❌ | Falta probar de extremo a extremo |

---

## 🎓 Próximos Pasos

1. **Elige hosting** (Render.com es recomendado)
2. **Deploy el Node.js Service** (ver DEPLOYMENT.md)
3. **Configura AUTOMATION_SERVICE_URL** en Supabase
4. **Test completo** en la app
5. **Monitores** logs en producción

---

## 📞 Debugging

Si algo no funciona:

1. **Mira los logs**
   - App React: F12 → Console
   - Node.js Service: Terminal o Render.com Logs
   - Supabase: Supabase Dashboard → Logs

2. **Prueba cada capa**
   ```bash
   # 1. ¿Funciona el servicio?
   curl http://localhost:3000/health

   # 2. ¿Se llamó la Edge Function?
   # Ver en Supabase Console Logs

   # 3. ¿El navegador de Puppeteer abre Tai Loy?
   # Ver en los logs del servicio
   ```

3. **Revisa permisos**
   - ¿CORS está permitiendo tu dominio?
   - ¿Credenciales son correctas?
   - ¿Tai Loy no cambió su HTML?

---

**Última actualización:** 2026-04-02
**Versión:** 1.0 (Puppeteer, Node.js + Supabase Edge Functions)
