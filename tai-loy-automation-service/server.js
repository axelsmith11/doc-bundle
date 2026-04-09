const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const TAILOY_USER = process.env.TAILOY_USER || '20603116021';
const TAILOY_PASS = process.env.TAILOY_PASS || '60014709';

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Reutilizar browser para no abrir uno nuevo cada vez
let activeBrowser = null;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/login', async (req, res) => {
  const username = req.body?.user || TAILOY_USER;
  const password = req.body?.pass || TAILOY_PASS;
  const fecha = req.body?.fecha || '';
  const hora = req.body?.hora || '';
  const excelBase64 = req.body?.excelBase64 || '';
  const excelFileName = req.body?.excelFileName || 'plantilla.xlsx';

  try {
    // Cerrar browser anterior si existe
    if (activeBrowser) {
      try { await activeBrowser.close(); } catch (e) {}
      activeBrowser = null;
    }

    console.log('[Start] Abriendo Chrome...');
    activeBrowser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
        '--disable-extensions',
        '--disable-background-timer-throttling',
      ],
      defaultViewport: null,
    });

    const page = await activeBrowser.newPage();

    // Login
    console.log('[1] Login...');
    await page.goto('https://www1.tailoy.com.pe/AgendamientoCitas/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('input[type="text"]', username, { delay: 20 });
    await page.type('input[type="password"]', password, { delay: 20 });
    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length > 0) await checkboxes[0].click();

    await new Promise(r => setTimeout(r, 300));
    const clicked = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, input[type="submit"], a, span')];
      for (const el of all) {
        if ((el.textContent || el.value || '').toLowerCase().includes('ingresar')) { el.click(); return true; }
      }
      const form = document.querySelector('form');
      if (form) { form.submit(); return true; }
      return false;
    });
    if (clicked) await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    // Solicitud de Citas
    console.log('[2] Solicitud de Citas...');
    await page.goto('https://www1.tailoy.com.pe/AgendamientoCitas/Solicitud', { waitUntil: 'networkidle2', timeout: 30000 });

    // Click +
    console.log('[3] Click +...');
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('a, button, i, span')];
      for (const el of candidates) {
        const cls = el.className || '';
        const text = (el.textContent || '').trim();
        if (cls.includes('fa-plus') || cls.includes('btn-success') || text === '+' || text === 'Nuevo' || text === 'Nueva') { el.click(); return; }
      }
      const links = [...document.querySelectorAll('a[href]')];
      for (const a of links) {
        if (a.href.includes('Nueva') || a.href.includes('Create') || a.href.includes('Add')) { a.click(); return; }
      }
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

    // Esperar modal
    await new Promise(r => setTimeout(r, 1500));

    // Fecha
    if (fecha) {
      console.log('[4] Fecha:', fecha);
      await page.evaluate((f) => {
        const inputs = [...document.querySelectorAll('input')];
        for (const inp of inputs) {
          if (inp.value && /\d{2}\/\d{2}\/\d{4}/.test(inp.value)) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(inp, f);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }, fecha);
    }

    // Hora
    if (hora) {
      console.log('[5] Hora:', hora);
      await page.evaluate((h) => {
        const selects = [...document.querySelectorAll('select')];
        for (const sel of selects) {
          for (const opt of sel.options) {
            if (opt.text.includes(h.split(':')[0] + ':')) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
      }, hora);
    }

    // Excel
    if (excelBase64) {
      console.log('[6] Subiendo Excel...');
      const tmpFile = path.join(os.tmpdir(), excelFileName);
      fs.writeFileSync(tmpFile, Buffer.from(excelBase64, 'base64'));

      // Buscar input file y subir
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(tmpFile);
        console.log('[6] Archivo cargado en input');

        // Disparar eventos manualmente para que la app lo detecte
        await page.evaluate(() => {
          const input = document.querySelector('input[type="file"]');
          if (input) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });

        await new Promise(r => setTimeout(r, 1000));

        // Click en Procesar - buscar el botón exacto al lado del input file
        console.log('[7] Click Procesar...');
        await page.evaluate(() => {
          // Buscar todos los elementos que digan "Procesar"
          const all = document.querySelectorAll('*');
          for (const el of all) {
            if (el.children.length === 0 || el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT') {
              const text = (el.textContent || el.value || '').trim();
              if (text === 'Procesar') {
                el.click();
                return;
              }
            }
          }
        });

        // Esperar a que Tai Loy procese el archivo
        await new Promise(r => setTimeout(r, 8000));
        console.log('[7] Procesamiento completado');
      } else {
        console.log('[6] No se encontró input file');
      }

      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }

    // Cuando el usuario cierre el navegador, matar todos los procesos
    activeBrowser.on('disconnected', async () => {
      console.log('[Browser] Cerrado por el usuario, limpiando procesos...');
      try {
        if (activeBrowser && activeBrowser.process()) {
          activeBrowser.process().kill('SIGKILL');
        }
      } catch (e) {}
      activeBrowser = null;
    });

    console.log('[Done] Listo!');
    res.json({ success: true, message: 'Cita lista.' });

  } catch (error) {
    console.error('[Error]', error.message);
    // Si hay error, cerrar browser para no dejar zombies
    if (activeBrowser) {
      try { await activeBrowser.close(); } catch (e) {}
      activeBrowser = null;
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Tai Loy Automation en puerto ${PORT}`);
});

// Al cerrar el servicio, matar Chrome
process.on('SIGINT', async () => {
  if (activeBrowser) {
    try { await activeBrowser.close(); } catch (e) {}
  }
  process.exit();
});
process.on('SIGTERM', async () => {
  if (activeBrowser) {
    try { await activeBrowser.close(); } catch (e) {}
  }
  process.exit();
});
