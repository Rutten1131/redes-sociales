import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processInboxItemWithAi } from "@/lib/ai/auto-responder";

/**
 * Webhook receptor para Make.com
 * Recibe comentarios y mensajes directos de Facebook, Instagram y YouTube
 * y los almacena en InboxItem para que aparezcan en el panel de control.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-make-secret");
    const cronSecret = process.env.CRON_SECRET;
    
    // Verificación de seguridad opcional si se envía header
    if (cronSecret && authHeader && authHeader !== cronSecret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    console.log("📥 [Make Inbox Webhook] Payload recibido:", JSON.stringify(body));

    const {
      platform,        // "FACEBOOK" | "INSTAGRAM" | "YOUTUBE"
      type,            // "COMMENT" | "DM"
      externalId,      // ID del comentario o mensaje
      parentId,        // ID del post o video padre
      fromName,        // Nombre del autor
      fromExternalId,  // ID del autor
      content,         // Texto del mensaje
      accountExternalId // ID de la página de FB, cuenta de IG o canal de YT
    } = body;

    if (!platform || !type || !externalId || !content) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: platform, type, externalId, content" },
        { status: 400 }
      );
    }

    // 1. Buscar la SocialAccount vinculada
    let socialAccount = null;
    if (accountExternalId) {
      socialAccount = await prisma.socialAccount.findFirst({
        where: {
          platform: platform as any,
          externalId: String(accountExternalId),
        },
      });
    }

    // Si no coincide por externalId, buscar la primera cuenta de esa plataforma
    if (!socialAccount) {
      socialAccount = await prisma.socialAccount.findFirst({
        where: { platform: platform as any },
      });
    }

    if (!socialAccount) {
      console.warn(`[Make Inbox] No se encontró cuenta social para ${platform} (ID: ${accountExternalId})`);
      return NextResponse.json(
        { error: `No hay cuenta social registrada para la plataforma ${platform}` },
        { status: 404 }
      );
    }

    // 2. Guardar o actualizar en la base de datos (InboxItem)
    const item = await prisma.inboxItem.upsert({
      where: {
        socialAccountId_externalId: {
          socialAccountId: socialAccount.id,
          externalId: String(externalId),
        },
      },
      create: {
        socialAccountId: socialAccount.id,
        platform: platform as any,
        type: type.toUpperCase(),
        externalId: String(externalId),
        parentId: parentId ? String(parentId) : null,
        fromName: fromName ? String(fromName) : "Usuario",
        fromExternalId: fromExternalId ? String(fromExternalId) : null,
        content: String(content),
        status: "PENDING",
      },
      update: {
        content: String(content),
      },
    });

    console.log(`✅ [Make Inbox] Guardado item ${item.id} (${item.type} de ${item.fromName})`);

    // 3. Si es nuevo y está PENDING, activar la IA para sugerir respuesta o auto-responder
    if (item.status === "PENDING") {
      processInboxItemWithAi(item.id).catch((err) => {
        console.error(`[Make Inbox AI Error item ${item.id}]:`, err);
      });
    }

    return NextResponse.json({ success: true, itemId: item.id });
  } catch (error: any) {
    console.error("❌ [Make Inbox Webhook Error]:", error);
    return NextResponse.json(
      { error: error.message || "Error procesando webhook de Make" },
      { status: 500 }
    );
  }
}
