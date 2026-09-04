import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { decryptToken } from "@/lib/crypto";
import {
  replyFacebookMessage,
  replyInstagramMessage,
  replyToComment,
} from "@/lib/integrations/meta";
import { dispatchReplyViaMake } from "@/lib/integrations/make-inbox";

// POST /api/inbox/reply — enviar respuesta a un DM o comentario
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { itemId, message } = body;

  if (!itemId || !message?.trim()) {
    return NextResponse.json(
      { error: "itemId y message son requeridos" },
      { status: 400 }
    );
  }

  // Obtener el item con su cuenta social asociada
  const item = await prisma.inboxItem.findUnique({
    where: { id: itemId },
    include: {
      socialAccount: {
        include: { business: true },
      },
    },
  });

  if (!item || item.socialAccount.business.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  try {
    const accessToken = decryptToken(item.socialAccount.accessToken);

    // Estrategia: si MAKE_INBOX_REPLY_WEBHOOK_URL está configurada, despachar vía Make.
    // Esto evita la necesidad de Meta App Review.
    const makeWebhookUrl = process.env.MAKE_INBOX_REPLY_WEBHOOK_URL;

    if (makeWebhookUrl) {
      await dispatchReplyViaMake({
        platform: item.platform,
        type: item.type,
        externalId: item.externalId,
        fromExternalId: item.fromExternalId || "",
        replyMessage: message.trim(),
        accessToken,
        pageAccessToken: accessToken,
      });
    } else {
      // Fallback: llamar directamente a Meta Graph API (requiere App Review aprobado)

      if (item.type === "DM") {
        if (!item.fromExternalId) {
          return NextResponse.json(
            { error: "No se puede responder: falta el ID del remitente" },
            { status: 400 }
          );
        }

        if (item.platform === "INSTAGRAM") {
          await replyInstagramMessage({
            pageAccessToken: accessToken,
            recipientId: item.fromExternalId,
            message: message.trim(),
          });
        } else {
          await replyFacebookMessage({
            pageAccessToken: accessToken,
            recipientId: item.fromExternalId,
            message: message.trim(),
          });
        }
      } else if (item.type === "COMMENT") {
        await replyToComment({
          commentId: item.externalId,
          accessToken,
          message: message.trim(),
        });
      } else {
        return NextResponse.json(
          { error: `Tipo no soportado: ${item.type}` },
          { status: 400 }
        );
      }
    }

    // Marcar como respondido
    const updated = await prisma.inboxItem.update({
      where: { id: itemId },
      data: { status: "ANSWERED" },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error("Error enviando respuesta:", err);
    return NextResponse.json(
      { error: err.message || "Error enviando respuesta" },
      { status: 500 }
    );
  }
}
