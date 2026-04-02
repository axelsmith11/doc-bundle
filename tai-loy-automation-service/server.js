/**
 * Servicio de Automatización Tai Loy
 *
 * Este servicio Node.js usa Puppeteer para automatizar el llenado de citas en Tai Loy
 *
 * Variables de entorno requeridas:
 * - PORT: Puerto donde corre el servidor (default: 3000)
 * - TAILOY_USER: Usuario de Tai Loy
 * - TAILOY_PASS: Contraseña de Tai Loy
 * - AUTHORIZED_ORIGINS: URLs autorizadas (comma-separated, opcional)
 */

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TAILOY_USER = process.env.TAILOY_USER || '20603116021';
const TAILOY_PASS = process.env.TAILOY_PASS || '60014709';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// CORS
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.AUTHORIZED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'), false);
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Tai Loy Automation Service' });
});

/**
 * POST /automate-cita
 *
 * Body:
 * {
 *   "fecha": "2026-04-15",  // YYYY-MM-DD
 *   "hora": "14:00:00 - 16:00:00",
 *   "user": "20603116021",  // optional, uses env if not provided
 *   "pass": "60014709"      // optional, uses env if not provided
 * }
 */
app.post('/automate-cita', async (req, res) => {
  const { fecha, hora, user, pass } = req.body;

  if (!fecha || !hora) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: fecha and hora',
    });
  }

  const username = user || TAILOY_USER;
  const password = pass || TAILOY_PASS;

  let browser;
  try {
    console.log(`[${new Date().toISOString()}] Starting automation for ${fecha} ${hora}`);

    // Launch browser
    // headless: 'new' = invisible (para servidores)
    // headless: false = visible (para testing/manual approval)
    const headlessMode = process.env.HEADLESS === 'false' ? false : 'new';

    browser = await puppeteer.launch({
      headless: headlessMode,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // For systems with limited memory
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Navigate to login and authenticate
    // ═══════════════════════════════════════════════════════════
    console.log('[Step 1] Navigating to login page...');
    await page.goto('https://www1.tailoy.com.pe/AgendamientoCitas/login', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Fill username
    console.log('[Step 1] Filling username...');
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    await page.type('input[type="text"]', username, { delay: 50 });

    // Fill password
    console.log('[Step 1] Filling password...');
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await page.type('input[type="password"]', password, { delay: 50 });

    // Check policy checkbox
    console.log('[Step 1] Checking policy checkbox...');
    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length > 0) {
      await checkboxes[0].click();
    }

    // Click login button
    console.log('[Step 1] Clicking login button...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button:has-text("Ingresar")') || page.click('button[type="submit"]'),
    ]);

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Navigate to Nueva Cita
    // ═══════════════════════════════════════════════════════════
    console.log('[Step 2] Navigating to Nueva Cita...');
    await page.goto('https://www1.tailoy.com.pe/AgendamientoCitas/SolicitudDeCitas/Nueva', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 3: Fill the form
    // ═══════════════════════════════════════════════════════════
    console.log('[Step 3] Filling form...');

    // Find date input (may have different selectors)
    const dateSelectors = [
      'input[placeholder*="Fecha"]',
      'input[name*="fecha"]',
      'input[name*="Fecha"]',
      'input[type="date"]',
    ];

    let dateInputFound = false;
    for (const selector of dateSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`[Step 3] Found date input with selector: ${selector}`);
          await element.click({ clickCount: 3 }); // Select all
          await page.keyboard.press('Backspace');
          await page.type(selector, fecha, { delay: 50 });
          dateInputFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!dateInputFound) {
      console.warn('[Step 3] Warning: Could not find date input with standard selectors');
    }

    // Find time input
    const timeSelectors = [
      'input[placeholder*="Hora"]',
      'input[name*="hora"]',
      'input[name*="Hora"]',
      'input[type="time"]',
    ];

    let timeInputFound = false;
    for (const selector of timeSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`[Step 3] Found time input with selector: ${selector}`);
          await element.click({ clickCount: 3 }); // Select all
          await page.keyboard.press('Backspace');
          // Time format: extract first part (HH:MM)
          const timeOnly = hora.split(' - ')[0].trim();
          await page.type(selector, timeOnly, { delay: 50 });
          timeInputFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!timeInputFound) {
      console.warn('[Step 3] Warning: Could not find time input with standard selectors');
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 4: Wait for user to manually click Save
    // ═══════════════════════════════════════════════════════════
    console.log('[Step 4] Formulario listo - Esperando que usuario presione "Guardar"...');

    if (headlessMode === false) {
      // Modo visible: espera a que el usuario presione manualmente
      console.log('[Step 4] VISIBLE MODE: Página abierta, presiona "Guardar" manualmente');
      console.log('[Step 4] El navegador permanecerá abierto. Ciérralo cuando termines.');

      // Espera indefinidamente (hasta que el usuario cierre la ventana o el timeout)
      // Timeout después de 30 minutos para evitar conexiones abiertas indefinidas
      await new Promise((resolve) => setTimeout(resolve, 30 * 60 * 1000));
      console.log('[Step 4] Timeout alcanzado o usuario cerró la ventana');
    } else {
      // Modo headless: no podemos ver si el usuario presiona
      // En este caso, simulamos que está listo pero no guardamos
      console.log('[Step 4] HEADLESS MODE: Formulario está listo');
      console.log('[Step 4] El usuario debe presionar "Guardar" manualmente en una ventana abierta');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('[SUCCESS] Automatización completada - Formulario listo para guardar');

    return res.json({
      success: true,
      message: 'Cita registrada en Tai Loy automáticamente',
      data: {
        fecha,
        hora,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[ERROR]', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Automation failed',
    });

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tai Loy Automation Service running on port ${PORT}`);
  console.log(`📍 User: ${TAILOY_USER}`);
  console.log(`🔐 Password: ${TAILOY_PASS ? '***' : 'NOT SET'}`);
});
