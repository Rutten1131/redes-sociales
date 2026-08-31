import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ---------- Verificación de firma HMAC-SHA256 ----------

function verifyMetaSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("META_APP_SECRET no está configurado");
    return false;
  }
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false; // longitudes diferentes
  }
}

// ---------- GET: Verificación del webhook (hub challenge) ----------

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    console.log("✅ Webhook de Meta verificado correctamente");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// ---------- POST: Recepción de eventos (DMs / comentarios) ----------

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const rawBody = await req.text();

  console.log("📨 Webhook POST recibido con headers:", req.headers.get("x-hub-signature-256"));
  if (!verifyMetaSignature(rawBody, signature)) {
    console.warn("⚠️ Webhook recibido con firma inválida o META_APP_SECRET no coincide");
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  console.log("📦 Webhook payload:", JSON.stringify(payload));

  // Meta envía los eventos en payload.entry[]
  for (const entry of payload.entry ?? []) {
    // --- DMs (Facebook e Instagram) ---
    if (entry.messaging) {
      for (const msg of entry.messaging) {
        await handleIncomingMessage(entry.id, msg);
      }
    }

    // --- Comentarios (Facebook feed changes e Instagram comments) ---
    if (entry.changes) {
      for (const change of entry.changes) {
        // Comentarios de Facebook (llegan como feed changes)
        if (change.field === "feed" && change.value?.item === "comment") {
          await handleIncomingComment(entry.id, change.value);
        }
        // Comentarios de Instagram (llegan como campo 'comments')
        if (change.field === "comments" && change.value) {
          await handleInstagramComment(entry.id, change.value);
        }
        // Menciones de Instagram (llegan como campo 'mention')
        if (change.field === "mention" && change.value) {
          await handleInstagramComment(entry.id, {
            ...change.value,
            comment_id: change.value.comment_id ?? change.value.media_id,
          });
        }
      }
    }
  }

  // Meta espera un 200 rápido — procesamos todo de forma síncrona pero ligera
  return new Response("OK", { status: 200 });
}

import { processInboxItemWithAi } from "@/lib/ai/auto-responder";

// ---------- Handlers internos ----------

async function handleIncomingMessage(
  pageOrIgId: string,
  msg: {
    sender?: { id: string };
    recipient?: { id: string };
    timestamp?: number;
    message?: { mid: string; text?: string };
  }
) {
  if (!msg.message?.mid || !msg.sender?.id) return;

  // Ignorar mensajes enviados por nosotros mismos (echo)
  if (msg.sender.id === pageOrIgId) return;

  const socialAccount = await prisma.socialAccount.findFirst({
    where: { externalId: pageOrIgId },
  });

  if (!socialAccount) {
    console.warn(`No se encontró cuenta social con externalId: ${pageOrIgId}`);
    return;
  }

  try {
    const item = await prisma.inboxItem.upsert({
      where: {
        socialAccountId_externalId: {
          socialAccountId: socialAccount.id,
          externalId: msg.message.mid,
        },
      },
      create: {
        socialAccountId: socialAccount.id,
        platform: socialAccount.platform,
        type: "DM",
        externalId: msg.message.mid,
        fromExternalId: msg.sender.id,
        fromName: null,
        content: msg.message.text ?? "[media]",
        status: "PENDING",
      },
      update: {},
    });

    // Disparar procesamiento con IA en segundo plano
    if (item && item.status === "PENDING") {
      processInboxItemWithAi(item.id).catch((aiErr) => {
        console.error(`[Webhook AI DM Error for ${item.id}]:`, aiErr);
      });
    }
  } catch (err) {
    console.error("Error guardando DM entrante:", err);
  }
}

async function handleIncomingComment(
  pageId: string,
  value: {
    comment_id?: string;
    from?: { id: string; name: string };
    message?: string;
    parent_id?: string;
    post_id?: string;
    created_time?: number;
  }
) {
  if (!value.comment_id || !value.from?.id) return;

  // Ignorar comentarios hechos por la propia página
  if (value.from.id === pageId) return;

  const socialAccount = await prisma.socialAccount.findFirst({
    where: { externalId: pageId, platform: "FACEBOOK" },
  });

  if (!socialAccount) {
    console.warn(`No se encontró cuenta de Facebook con externalId: ${pageId}`);
    return;
  }

  try {
    const item = await prisma.inboxItem.upsert({
      where: {
        socialAccountId_externalId: {
          socialAccountId: socialAccount.id,
          externalId: value.comment_id,
        },
      },
      create: {
        socialAccountId: socialAccount.id,
        platform: "FACEBOOK",
        type: "COMMENT",
        externalId: value.comment_id,
        parentId: value.parent_id ?? value.post_id ?? null,
        fromExternalId: value.from.id,
        fromName: value.from.name,
        content: value.message ?? "",
        status: "PENDING",
      },
      update: {},
    });

    // Disparar procesamiento con IA en segundo plano
    if (item && item.status === "PENDING") {
      processInboxItemWithAi(item.id).catch((aiErr) => {
        console.error(`[Webhook AI Comment Error for ${item.id}]:`, aiErr);
      });
    }
  } catch (err) {
    console.error("Error guardando comentario entrante:", err);
  }
}

async function handleInstagramComment(
  igAccountId: string,
  value: {
    comment_id?: string;
    from?: { id: string; username?: string; name?: string };
    text?: string;
    media_id?: string;
    parent_id?: string;
  }
) {
  if (!value.comment_id || !value.from?.id) return;

  // Ignorar comentarios hechos por la propia cuenta de IG
  if (value.from.id === igAccountId) return;

  const socialAccount = await prisma.socialAccount.findFirst({
    where: { externalId: igAccountId, platform: "INSTAGRAM" },
  });

  if (!socialAccount) {
    console.warn(`No se encontró cuenta de Instagram con externalId: ${igAccountId}`);
    return;
  }

  try {
    const item = await prisma.inboxItem.upsert({
      where: {
        socialAccountId_externalId: {
          socialAccountId: socialAccount.id,
          externalId: value.comment_id,
        },
      },
      create: {
        socialAccountId: socialAccount.id,
        platform: "INSTAGRAM",
        type: "COMMENT",
        externalId: value.comment_id,
        parentId: value.parent_id ?? value.media_id ?? null,
        fromExternalId: value.from.id,
        fromName: value.from.username ?? value.from.name ?? null,
        content: value.text ?? "",
        status: "PENDING",
      },
      update: {},
    });

    // Disparar procesamiento con IA en segundo plano
    if (item && item.status === "PENDING") {
      processInboxItemWithAi(item.id).catch((aiErr) => {
        console.error(`[Webhook AI IG Comment Error for ${item.id}]:`, aiErr);
      });
    }
  } catch (err) {
    console.error("Error guardando comentario de Instagram:", err);
  }
}

