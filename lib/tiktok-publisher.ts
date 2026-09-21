import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import os from "os";

export interface TikTokCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

interface PublishOptions {
  cookies: TikTokCookie[];
  videoUrl: string;
  caption?: string | null;
}

export interface PublishResult {
  success: boolean;
  error?: string;
}

async function downloadVideoToTemp(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error al descargar video (${res.status} ${res.statusText})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const tempFilePath = path.join(os.tmpdir(), `tiktok_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);
  await fs.promises.writeFile(tempFilePath, buffer);
  return tempFilePath;
}

export async function publishTikTokVideo({ cookies, videoUrl, caption }: PublishOptions): Promise<PublishResult> {
  let tempVideoPath: string | null = null;
  let browser = null;
  try {
    tempVideoPath = await downloadVideoToTemp(videoUrl);
    const validCookies = cookies
      .filter(c => c.name && c.value)
      .map(c => {
        let domain = c.domain || ".tiktok.com";
        if (!domain.startsWith(".") && !domain.includes("localhost")) {
          domain = "." + domain;
        }
        return {
          name: c.name,
          value: c.value,
          domain,
          path: c.path || "/",
          secure: c.secure ?? true,
          httpOnly: c.httpOnly ?? false,
          sameSite: (c.sameSite === "Strict" || c.sameSite === "Lax" || c.sameSite === "None") ? c.sameSite : ("None" as const),
        };
      });
    if (validCookies.length === 0) {
      return { success: false, error: "No se proporcionaron cookies validas de TikTok." };
    }
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "es-ES",
      timezoneId: "America/Guayaquil",
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await context.addCookies(validCookies);
    const page = await context.newPage();
    await page.goto("https://www.tiktok.com/tiktokstudio/upload?from=webapp&tab=video", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      return { success: false, error: "La sesion de TikTok ha caducado o las cookies no contenian 'sessionid'. Vuelve a exportar y pegar tus cookies." };
    }
    let fileInput = await page.$("input[type=\"file\"]");
    if (!fileInput) {
      for (const frame of page.frames()) {
        fileInput = await frame.$("input[type=\"file\"]");
        if (fileInput) break;
      }
    }
    if (!fileInput) {
      try {
        fileInput = await page.waitForSelector("input[type=\"file\"]", { state: "attached", timeout: 25000 });
      } catch {
        for (const frame of page.frames()) {
          try {
            fileInput = await frame.waitForSelector("input[type=\"file\"]", { timeout: 5000 });
            if (fileInput) break;
          } catch {}
        }
      }
    }
    if (!fileInput) {
      return { success: false, error: "No se encontro el selector de carga de archivos en TikTok Creator Center." };
    }
    await fileInput.setInputFiles(tempVideoPath);
    // Esperar a que el video cargue y TikTok termine de rellenar el nombre de archivo automático
    await page.waitForTimeout(12000);

    // 1. Cerrar popup 'Turn on automatic content checks' haciendo click en Turn on o Cancel
    try {
      const modalTurnOn = await page.$('.TUXModal-overlay ~ div button:has-text("Turn on"), button:has-text("Turn on"), button:has-text("Activar"), button:has-text("Cancel")');
      if (modalTurnOn) {
        await modalTurnOn.click({ force: true });
        await page.waitForTimeout(1500);
      }
    } catch {}

    // Remover del DOM cualquier overlay restante que intercepte clics
    try {
      await page.evaluate(() => {
        document.querySelectorAll('.TUXModal-overlay, [data-floating-ui-portal]').forEach((el) => {
          const text = (el as HTMLElement).innerText || el.textContent || '';
          if (text.includes('automatic content checks') || text.includes('New editing features')) {
            el.remove();
          }
        });
      });
      await page.waitForTimeout(500);
    } catch {}

    // 2. Cerrar tooltip de sonido 'Got it'
    try {
      const gotItBtn = await page.$('button:has-text("Got it"), button:has-text("Entendido")');
      if (gotItBtn && (await gotItBtn.isVisible())) {
        await gotItBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
    } catch {}

    // 3. Escribir caption limpio en el editor
    if (caption && caption.trim()) {
      try {
        console.log("Escribiendo caption limpio en TikTok:", caption);
        const editorSelector = '.public-DraftEditor-content';
        const captionEditor = await page.waitForSelector(editorSelector, { timeout: 15000 });
        if (captionEditor) {
          await captionEditor.click({ force: true });
          await page.waitForTimeout(500);

          // Seleccionar todo el contenido en Draft.js usando selection API y teclado
          await page.evaluate(() => {
            const el = document.querySelector('.public-DraftEditor-content');
            if (el) {
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(el);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          });
          await page.waitForTimeout(200);
          await page.keyboard.press("Backspace");
          await page.keyboard.press("Delete");
          await page.waitForTimeout(300);

          // Escribir el caption real
          await page.keyboard.insertText(caption.trim());
          await page.waitForTimeout(1000);
        }
      } catch (err) {
        console.warn("Error escribiendo caption:", err);
      }
    }
    // 4. Click definitivo en el botón Post/Publicar mediante DOM evaluate
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const postBtn = btns.find(b => b.innerText.trim() === 'Post' || b.innerText.trim() === 'Publicar');
      if (postBtn) {
        postBtn.scrollIntoView();
        postBtn.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      return { success: false, error: "No se encontro el boton Post/Publicar en TikTok Studio." };
    }

    // Esperar redirección a /tiktokstudio/content o mensaje de confirmación
    try {
      await page.waitForURL(/tiktokstudio\/content/, { timeout: 35000 });
    } catch {
      await page.waitForTimeout(10000);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error en publishTikTokVideo:", error);
    return { success: false, error: error?.message || "Error al publicar en TikTok" };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      try { await fs.promises.unlink(tempVideoPath); } catch {}
    }
  }
}