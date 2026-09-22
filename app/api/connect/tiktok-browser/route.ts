import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
// playwright se importa dinámicamente para evitar que crashee Vercel serverless

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { businessId, manualCookies } = await req.json().catch(() => ({}));
  if (!businessId) {
    return NextResponse.json({ error: "businessId es requerido" }, { status: 400 });
  }
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });
  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }
  if (manualCookies && Array.isArray(manualCookies) && manualCookies.length > 0) {
    try {
      const encrypted = encryptToken(JSON.stringify(manualCookies));
      const sessionCookie = manualCookies.find((c: any) => c.name === "sessionid" || c.name === "sid_guard");
      if (!sessionCookie) {
        return NextResponse.json({ error: "Las cookies no contienen una sesión activa (sessionid)." }, { status: 400 });
      }
      const account = await prisma.socialAccount.upsert({
        where: { businessId_platform_externalId: { businessId, platform: "TIKTOK", externalId: "tiktok_cookies_user" } },
        update: { accessToken: encrypted, displayName: "@tiktok_auto", updatedAt: new Date() },
        create: { businessId, platform: "TIKTOK", externalId: "tiktok_cookies_user", displayName: "@tiktok_auto", accessToken: encrypted },
      });
      return NextResponse.json({ success: true, account });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Error procesando cookies" }, { status: 500 });
    }
  }
  let browser = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled", "--window-size=1000,750"],
    });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1000, height: 750 },
    });
    const page = await context.newPage();
    await page.goto("https://www.tiktok.com/login", { waitUntil: "domcontentloaded" });
    let capturedCookies: any[] = [];
    let detectedUsername = "TikTok Usuario";
    const startTime = Date.now();
    const TIMEOUT_MS = 240000;
    while (Date.now() - startTime < TIMEOUT_MS) {
      const currentCookies = await context.cookies();
      const hasSession = currentCookies.some(c => c.name === "sessionid" && c.value.length > 5);
      if (hasSession) {
        capturedCookies = currentCookies;
        try {
          await page.goto("https://www.tiktok.com/@", { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
          const url = page.url();
          const match = url.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
          if (match && match[1]) {
            detectedUsername = `@${match[1]}`;
          }
        } catch {}
        break;
      }
      await page.waitForTimeout(2000);
    }
    if (capturedCookies.length === 0) {
      return NextResponse.json({ error: "Tiempo agotado. No se detectó inicio de sesión en TikTok." }, { status: 408 });
    }
    const encrypted = encryptToken(JSON.stringify(capturedCookies));
    const account = await prisma.socialAccount.upsert({
      where: { businessId_platform_externalId: { businessId, platform: "TIKTOK", externalId: detectedUsername } },
      update: { accessToken: encrypted, displayName: detectedUsername, updatedAt: new Date() },
      create: { businessId, platform: "TIKTOK", externalId: detectedUsername, displayName: detectedUsername, accessToken: encrypted },
    });
    return NextResponse.json({ success: true, username: detectedUsername, account });
  } catch (err: any) {
    console.error("Error en captura de cookies TikTok:", err);
    return NextResponse.json({ error: err?.message || "Error abriendo ventana de TikTok" }, { status: 500 });
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}