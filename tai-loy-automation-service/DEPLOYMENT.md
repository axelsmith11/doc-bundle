# Deployment Guide - Tai Loy Automation Service

Este documento explica cómo desplegar el servicio de automatización Tai Loy en tu servidor.

## 📋 Requisitos

- **Node.js 18+** (recomendado Node 20 LTS)
- **npm** o **yarn**
- Acceso a internet (para instalar dependencias y ejecutar Puppeteer)

## 🚀 Opción 1: Desplegarlo en tu servidor actual

### Paso 1: Preparar el servicio

```bash
# Ve a la carpeta del servicio
cd tai-loy-automation-service

# Instala las dependencias
npm install

# Copia el archivo de configuración
cp .env.example .env

# Edita el archivo .env con tus credenciales
# nano .env  (o usa tu editor favorito)
```

### Paso 2: Configurar variables de entorno

En el archivo `.env`, establece:

```env
PORT=3000
TAILOY_USER=20603116021
TAILOY_PASS=60014709
AUTHORIZED_ORIGINS=http://localhost:5173,https://tudominio.com
NODE_ENV=production
```

### Paso 3: Ejecutar el servicio

**Opción A: En desarrollo (con hot reload)**
```bash
npm run dev
```

**Opción B: En producción**
```bash
npm start
```

Deberías ver:
```
🚀 Tai Loy Automation Service running on port 3000
📍 User: 20603116021
🔐 Password: ***
```

### Paso 4: Verificar que funciona

```bash
# En otra terminal
curl http://localhost:3000/health

# Deberías ver:
# {"status":"ok","service":"Tai Loy Automation Service"}
```

---

## 🌐 Opción 2: Desplegarlo en un servicio gratuito

### Render.com (RECOMENDADO - Gratuito)

1. **Crea una cuenta en https://render.com**

2. **Conecta tu repositorio GitHub**
   - Ve a Dashboard → New + → Web Service
   - Conecta tu repositorio

3. **Configura el servicio**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

4. **Agrega variables de entorno**
   - Ve a Environment
   - Agrega:
     ```
     TAILOY_USER=20603116021
     TAILOY_PASS=60014709
     NODE_ENV=production
     AUTHORIZED_ORIGINS=https://tuapp.com,https://tudominio.com
     ```

5. **Deploy**
   - Click en "Create Web Service"
   - Espera 5-10 minutos

Tu URL será algo como: `https://tai-loy-automation-xxxxx.onrender.com`

### Railway.app (Alternativa)

1. Ve a https://railway.app
2. New Project → Deploy from GitHub
3. Configura como arriba
4. Agrega variables de entorno en Settings
5. Deploy

---

## 🔗 Configurar la URL en Supabase

Una vez desplegado, necesitas decirle a tu Edge Function dónde está el servicio:

### En Supabase Console:

1. Ve a **Project Settings** → **Edge Functions**
2. Busca la función `trigger-tai-loy-cita`
3. Agrega la variable de entorno:
   ```
   AUTOMATION_SERVICE_URL=https://tu-servicio.onrender.com
   ```
   (o tu URL de Railway, DigitalOcean, etc.)

---

## 🧪 Pruebas

### Test local

```bash
curl -X POST http://localhost:3000/automate-cita \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-04-15",
    "hora": "14:00:00 - 16:00:00"
  }'
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "Cita registrada en Tai Loy automáticamente",
  "data": {
    "fecha": "2026-04-15",
    "hora": "14:00:00 - 16:00:00",
    "timestamp": "2026-04-02T..."
  }
}
```

---

## 📊 Monitoreo

### Ver logs en desarrollo
```bash
npm run dev
# Los logs aparecen en la terminal
```

### Ver logs en producción (Render.com)
- Dashboard → Tu servicio → Logs
- Los logs se actualizan en tiempo real

### Ver logs en Railway
- Project → Deployments → Logs

---

## 🔐 Seguridad

### Variables sensibles
- ⛔ NUNCA commits credenciales en Git
- ✅ Usa `.env` local (en .gitignore)
- ✅ Usa variables de entorno en el servidor

### CORS
- Solo acepta requests de tus dominios autorizados
- Edita `AUTHORIZED_ORIGINS` en `.env`
- Ejemplo:
  ```env
  AUTHORIZED_ORIGINS=https://app.tudominio.com,https://admin.tudominio.com
  ```

---

## ⚠️ Solución de problemas

### "Port already in use"
```bash
# Cambia el puerto en .env
PORT=3001

# O mata el proceso anterior
lsof -i :3000
kill -9 <PID>
```

### "Cannot find module 'puppeteer'"
```bash
npm install
npm install --save puppeteer
```

### "Timeout waiting for page"
- Tai Loy puede estar lento
- Aumenta timeouts en `server.js` (línea ~80, cambia `30000` a `60000`)

### "CORS error"
- Verifica que tu dominio esté en `AUTHORIZED_ORIGINS`
- Recarga la app
- Verifica que la variable se sincronizó

### "Automation service URL not configured"
- Agrega `AUTOMATION_SERVICE_URL` a las variables de Supabase
- El valor debe ser tu URL pública del servicio
- Ejemplo: `https://tai-loy-automation-xxxxx.onrender.com`

---

## 📈 Actualizaciones

Para actualizar el servicio a una nueva versión:

### En tu servidor local:
```bash
# Haz cambios en server.js
# ...

# Commit
git add .
git commit -m "Update automation service"
git push origin main
```

### Render.com / Railway:
- Redeploy automático cuando hagas push a main
- O haz click en "Redeploy" en el dashboard

---

## 💰 Costos

- **Render.com Free:** $0/mes (recomendado)
- **Railway.com Free:** $5 de crédito gratuito/mes
- **DigitalOcean:** $5/mes mínimo
- **Alternativa:** Ejecutar en tu propio servidor

---

## 📞 Soporte

Si hay problemas:

1. Revisa los logs
2. Verifica que `AUTOMATION_SERVICE_URL` está configurada
3. Prueba con `curl` como se muestra en "Pruebas"
4. Verifica credenciales de Tai Loy
5. Verifica permisos de CORS

---

**Última actualización:** 2026-04-02
