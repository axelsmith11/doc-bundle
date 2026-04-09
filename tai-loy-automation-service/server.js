const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TAILOY_USER = process.env.TAILOY_USER || '';
const TAILOY_PASS = process.env.TAILOY_PASS || '';

app.use(express.json({ limit: '50mb' }));

// CORS - permitir origenes configurados + cualquier lovable/localhost
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = (process.env.AUTHORIZED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (
      allowed.includes(origin) ||
      origin.includes('localhost') ||
      origin.includes('lovable.app') ||
      origin.includes('lovableproject.com')
    ) {
      return callback(null, true);
    }
    callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
}));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Tai Loy Automation' });
});

/**
 * Helper: lanza Puppeteer, hace login y devuelve { browser, page }
 */
async function loginTaiLoy(username, password) {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  // 1. Ir al login
  console.log('[Login] Navigating...');
  await page.goto('https://www1.tailoy.com.pe/AgendamientoCitas/login', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // 2. Llenar usuario
  await page.waitForSelector('input[type="text"]', { timeout: 5000 });
  await page.type('input[type="text"]', username, { delay: 30 });

  // 3. Llenar contraseña
  await page.waitForSelector('input[type="password"]', { timeout: 5000 });
  await page.type('input[type="password"]', password, { delay: 30 });

  // 4. Marcar checkbox politicas
  const checkboxes = await page.$$('input[type="checkbox"]');
  if (checkboxes.length > 0) await checkboxes[0].click();

  // 5. Click en "Ingresar"
  const loginBtn = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.find(b => b.textContent.toLowerCase().includes('ingresar')) || buttons[0];
  });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    loginBtn.click(),
  ]);

  console.log('[Login] Success!');
  return { browser, page };
}

/**
 * POST /login
 *
 * Solo hace login y devuelve confirmación.
 * Body opcional: { user, pass }
 */
app.post('/login', async (req, res) => {
  const username = req.body?.user || TAILOY_USER;
  const password = req.body?.pass || TAILOY_PASS;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Credenciales no configuradas' });
  }

  let browser;
  try {
    const result = await loginTaiLoy(username, password);
    browser = result.browser;

    // Verificar que el login fue exitoso chequeando la URL
    const currentUrl = result.page.url();
    const loginOk = !currentUrl.includes('/login');

    await browser.close();
    browser = null;

    if (loginOk) {
      res.json({ success: true, message: 'Login exitoso en Tai Loy' });
    } else {
      res.json({ success: false, error: 'Login falló. Verifica credenciales.' });
    }

  } catch (error) {
    console.error('[LOGIN ERROR]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

/**
 * POST /automate-cita
 *
 * Hace login + navega a nueva cita + llena formulario.
 * Body: { fecha: "YYYY-MM-DD", hora: "HH:MM:00 - HH:MM:00" }
 */
app.post('/automate-cita', async (req, res) => {
  const { fecha, hora, user, pass } = req.body;

  if (!fecha || !hora) {
    return res.status(400).json({ success: false, error: 'Faltan campos: fecha y hora' });
  }

  const username = user || TAILOY_USER;
  const password = pass || TAILOY_PASS;

  let browser;
  try {
    console.log(`[Cita] Starting for ${fecha} ${hora}`);

    const result = await loginTaiLoy(username, password);
    browser = result.browser;
    const page = result.page;

    // Navegar a Nueva Cita
    console.log('[Cita] Navigating to Nueva Cita...');
    await page.goto('https://www1.tailoy.com.pe/AgendamientoCitas/SolicitudDeCitas/Nueva', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Tomar screenshot para debug
    const screenshot = await page.screenshot({ encoding: 'base64' });

    // Intentar llenar fecha
    const dateSelectors = ['input[placeholder*="Fecha"]', 'input[name*="fecha"]', 'input[name*="Fecha"]', 'input[type="date"]'];
    let dateOk = false;
    for (const sel of dateSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(sel, fecha, { delay: 30 });
        dateOk = true;
        break;
      }
    }

    // Intentar llenar hora
    const timeSelectors = ['input[placeholder*="Hora"]', 'input[name*="hora"]', 'input[name*="Hora"]', 'input[type="time"]'];
    let timeOk = false;
    for (const sel of timeSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(sel, hora.split(' - ')[0].trim(), { delay: 30 });
        timeOk = true;
        break;
      }
    }

    await browser.close();
    browser = null;

    res.json({
      success: true,
      message: 'Formulario de cita procesado',
      data: { fecha, hora, dateOk, timeOk },
      screenshot: `data:image/png;base64,${screenshot}`,
    });

  } catch (error) {
    console.error('[CITA ERROR]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`Tai Loy Automation running on port ${PORT}`);
});
