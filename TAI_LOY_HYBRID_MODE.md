# Modo Híbrido - Automatización + Aprobación Manual

## 🎯 Flujo

```
Usuario presiona "Enviar a Tai Loy"
         ↓
Backend abre Chrome visible
         ↓
Chrome hace login automático
         ↓
Chrome navega a Nueva Cita
         ↓
Chrome llena Fecha y Hora
         ↓
🔴 SE DETIENE AQUÍ
         ↓
Usuario VE el formulario llenado
         ↓
Usuario presiona manualmente "Guardar"
         ↓
✅ Cita registrada en Tai Loy
```

---

## 🚀 Cómo Activar Modo Híbrido

### Paso 1: Configurar `.env`

En `tai-loy-automation-service/.env`:

```env
PORT=3000
TAILOY_USER=20603116021
TAILOY_PASS=60014709
AUTHORIZED_ORIGINS=http://localhost:5173
NODE_ENV=development
HEADLESS=false        ← 🔴 IMPORTANTE: false = visible
```

### Paso 2: Ejecutar el servicio

```bash
cd tai-loy-automation-service
npm install
npm run dev
```

Deberías ver:
```
🚀 Tai Loy Automation Service running on port 3000
```

### Paso 3: Configurar Supabase

En Supabase Console → Settings → Environment Variables:

```
AUTOMATION_SERVICE_URL = http://localhost:3000
```

### Paso 4: Probar en la app

1. Abre tu app React (http://localhost:5173)
2. Carga un PDF de OC
3. Selecciona fecha
4. Click "Enviar a Tai Loy"
5. **Una ventana de Chrome se abrirá automáticamente** mostrando:
   - Login completado ✅
   - Nueva Cita abierta ✅
   - Formulario con fecha/hora llenados ✅
6. **Presiona "Guardar" manualmente** en esa ventana
7. De vuelta en tu app, verás "✓ Cita registrada"

---

## 🔄 Cambiar entre Modos

### Modo Visible (para testing)
```env
HEADLESS=false  ← Ves todo lo que hace el navegador
```

### Modo Invisible (para producción)
```env
HEADLESS=true   ← Corre en background, más rápido
```

---

## ⚙️ Detalles Técnicos

### Headless: false
- ✅ Abre Chrome visible en tu pantalla
- ✅ Ves exactamente qué está pasando
- ✅ Puedes intervenir si algo falla
- ❌ **SOLO funciona en tu máquina local** (servidor con pantalla)
- ❌ NO funciona en Render.com o servidores sin interfaz gráfica
- ⏱️ Timeout: 30 minutos (se cierra automáticamente después)

### Headless: true (o 'new')
- ✅ Corre invisible en el servidor
- ✅ Funciona en cualquier servidor (Render, DigitalOcean, etc)
- ❌ No ves nada (pero los logs muestran el progreso)
- ⏱️ Más rápido (5-10 segundos)

---

## 📋 Casos de Uso

### Local Development (Recomendado: headless: false)
```env
HEADLESS=false
```
- Desarrollas y pruebas
- Ves todo en tiempo real
- Puedes debugguear fácilmente

### Production (Render.com, etc): headless: true o 'new'
```env
HEADLESS=true
```
- Servidor automático
- Sin interfaz gráfica
- Más rápido y eficiente

---

## 🧪 Ejemplo de Flujo Completo

1. **Terminal 1** (servicio Node.js):
   ```bash
   npm run dev
   ```

2. **Terminal 2** (app React):
   ```bash
   npm run dev
   ```

3. **Browser**:
   - Abre http://localhost:5173
   - Carga PDF
   - Selecciona fecha
   - Click "Enviar a Tai Loy"

4. **Chrome popup se abre automáticamente**:
   - Login completado
   - Formulario llenado
   - Espera tu clic en "Guardar"

5. **Después de presionar "Guardar"**:
   - Chrome cierra (o espera)
   - App muestra "✓ Cita registrada"

---

## 🛑 Troubleshooting

### "Chrome no abre"
- Verifica que `HEADLESS=false` en .env
- Verifica que tienes Chrome/Chromium instalado
- En servidor remoto: esto no funciona (usa `HEADLESS=true`)

### "No llena el formulario"
- Mira los logs en la ventana de Chrome (DevTools)
- Verifica credenciales en .env
- Verifica que Tai Loy no cambió su HTML

### "Se queda abierto para siempre"
- Timeout es 30 minutos
- O presiona "Guardar" para completar la automatización
- O cierra la ventana manualmente

### "Error: Edge Function returned non-2xx"
- Verifica que `AUTOMATION_SERVICE_URL` está configurada en Supabase
- Verifica que el servicio está corriendo (`npm run dev`)
- Verifica que no hay errores en los logs

---

## 📊 Comparación de Modos

| Característica | Visible | Invisible |
|---|---|---|
| **Abre Chrome** | ✅ Sí | ❌ No |
| **Ves el proceso** | ✅ Sí | ❌ No |
| **Presionas Guardar** | ✅ Manualmente | ❓ Backend lo hace |
| **Funciona local** | ✅ Sí | ✅ Sí |
| **Funciona en Render** | ❌ No | ✅ Sí |
| **Velocidad** | 🟡 Más lento | 🟢 Rápido |
| **Recursos** | 🔴 Alto | 🟢 Bajo |

---

**¡Listo! Ya tienes todo configurado.** 🚀

¿Necesitas ayuda con algo más?
