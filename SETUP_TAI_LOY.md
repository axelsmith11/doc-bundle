# 🚀 Configuración: Automatización Tai Loy

## Estado Actual
✅ Integración con Tai Loy implementada
✅ Botón "Enviar a Tai Loy" listo
⏳ Requiere: Segurizar credenciales

---

## 📋 Lo que hace

Cuando presionas **"Enviar a Tai Loy"**:
1. ✅ Abre ventana nueva de Tai Loy
2. ✅ Inicia sesión automáticamente
3. ✅ Acepta políticas de privacidad
4. ✅ Navega a "Solicitud de Cita" → "Nueva Cita"
5. ✅ Llena fecha y hora automáticamente
6. ⏸️ Se detiene - **Tú subes el Excel y presionas Guardar**

---

## ⚠️ SEGURIDAD: Credenciales

**Actualmente**: Las credenciales están en el código (temporal)
**Deberías hacer**: Mover a variables de entorno

### Opción 1: Variables de Entorno en Supabase (RECOMENDADO)

1. **Ve a Supabase Dashboard** → Tu proyecto
2. **Settings → Edge Functions → Secrets**
3. **Agrega estas variables:**
   ```
   TAILOY_USER = 20603116021
   TAILOY_PASS = 60014709
   ```

4. **Actualiza el hook** para leer desde variables:
   ```typescript
   // En useTaiLoyAutomation.ts
   const TAILOY_USER = await fetch('/api/get-tailoy-user');
   const TAILOY_PASS = await fetch('/api/get-tailoy-pass');
   ```

### Opción 2: Local .env (Solo Desarrollo)

1. **Crea archivo** `.env.local` en la raíz:
   ```
   VITE_TAILOY_USER=20603116021
   VITE_TAILOY_PASS=60014709
   ```

2. **Usa en el hook:**
   ```typescript
   const user = import.meta.env.VITE_TAILOY_USER;
   const pass = import.meta.env.VITE_TAILOY_PASS;
   ```

---

## 🧪 Pruebas

1. **Ve a la página de Citas**
2. **Crea/abre una cita**
3. **Sube un PDF de OC**
4. **Selecciona fecha de despacho**
5. **Presiona "Enviar a Tai Loy"**
6. **Se abrirá nueva ventana con Tai Loy**
7. **El formulario estará pre-llenado**
8. **Sube el Excel y presiona Guardar**

---

## 🐛 Troubleshooting

### "No se pudo abrir ventana de Tai Loy"
- Verifica que **pop-ups estén permitidos** en tu navegador
- Desactiva **adblockers/extensiones**

### "El formulario no se llena automáticamente"
- Abre **DevTools (F12)** → Console
- Verifica si hay errores
- Es posible que Tai Loy haya cambiado el HTML

### "El login no funciona"
- Las credenciales son correctas: `20603116021 / 60014709`
- Puede ser que Tai Loy requiera captcha (requeriría integración de puppeteer)

---

## 📝 Próximas Mejoras

- [ ] Integrar **Playwright en Edge Function** para automatización completa
- [ ] Soporte para **múltiples usuarios** (cada uno con sus credenciales)
- [ ] Guardar **historial de citas** enviadas
- [ ] Agregar **notificaciones** cuando Tai Loy confirme

---

## 📞 Soporte

Si necesitas ayuda, revisa:
1. **Console del navegador** (F12) para errores
2. **Network tab** para ver requests fallidas
3. Usa **CloudFlare Workers** si necesitas un servidor proxy

---

**Última actualización**: 2 de Abril, 2026
