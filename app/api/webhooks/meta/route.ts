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

  if (!verifyMetaSignature(rawBody, signature)) {
    console.warn("⚠️ Webhook recibido con firma inválida");
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Meta envía los eventos en payload.entry[]
  for (const entry of payload.entry ?? []) {
    // --- DMs (Facebook e Instagram) ---
    if (entry.messaging) {
      for (const msg of entry.messaging) {
        await handleIncomingMessage(entry.id, msg);
      }
    }

    // --- Comentarios (Facebook feed changes) ---
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === "feed" && change.value?.item === "comment") {
          await handleIncomingComment(entry.id, change.value);
        }
      }
    }
  }

  // Meta espera un 200 rápido — procesamos todo de forma síncrona pero ligera
  return new Response("OK", { status: 200 });
}

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
  // En la API de Meta, si el sender.id === page id, es un echo
  if (msg.sender.id === pageOrIgId) return;

  // Buscar la cuenta social por externalId (puede ser FB Page ID o IG Account ID)
  const socialAccount = await prisma.socialAccount.findFirst({
    where: { externalId: pageOrIgId },
  });

  if (!socialAccount) {
    console.warn(`No se encontró cuenta social con externalId: ${pageOrIgId}`);
    return;
  }

  try {
    await prisma.inboxItem.upsert({
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
        fromName: null, // Meta no envía el nombre en el webhook; se puede obtener después
        content: msg.message.text ?? "[media]",
        status: "PENDING",
      },
      update: {}, // Si ya existe, no actualizar
    });
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
    await prisma.inboxItem.upsert({
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
  } catch (err) {
    console.error("Error guardando comentario entrante:", err);
  }
}
