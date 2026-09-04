import { prisma } from "@/lib/prisma";
import { generateAiReply } from "./groq";
import { decryptToken } from "@/lib/crypto";
import {
  replyFacebookMessage,
  replyInstagramMessage,
  replyToComment,
} from "@/lib/integrations/meta";
import { dispatchReplyViaMake } from "@/lib/integrations/make-inbox";

/**
 * Procesa un InboxItem entrante (DM o Comentario) con el motor de IA.
 * Si el auto-responder está activo para el negocio, envía la respuesta automáticamente.
 * Si está apagado, guarda la sugerencia de IA para revisión del usuario.
 */
export async function processInboxItemWithAi(inboxItemId: string): Promise<{
  repliedAutomatically: boolean;
  replyText: string;
}> {
  const item = await prisma.inboxItem.findUnique({
    where: { id: inboxItemId },
    include: {
      socialAccount: {
        include: {
          business: true,
        },
      },
    },
  });

  if (!item) {
    throw new Error(`InboxItem no encontrado: ${inboxItemId}`);
  }

  const business = item.socialAccount.business;
  const isDM = item.type === "DM";
  const shouldAutoReply = isDM
    ? Boolean(business.autoReplyDMs)
    : Boolean(business.autoReplyComments);

  // 1. Generar respuesta con Groq
  const replyText = await generateAiReply({
    businessName: business.name,
    aiPrompt: business.aiPrompt,
    aiDMsPrompt: business.aiDMsPrompt,
    aiCommentsPrompt: business.aiCommentsPrompt,
    aiTone: business.aiTone,
    type: item.type as "DM" | "COMMENT",
    platform: item.platform,
    fromName: item.fromName,
    content: item.content,
  });

  // 2. Si no está activado el auto-despacho automático, solo guardar la sugerencia
  if (!shouldAutoReply) {
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        aiSuggestedReply: replyText,
      },
    });
    return {
      repliedAutomatically: false,
      replyText,
    };
  }

  // 3. Despachar la respuesta automáticamente
  try {
    const accessToken = decryptToken(item.socialAccount.accessToken);
    const makeWebhookUrl = process.env.MAKE_INBOX_REPLY_WEBHOOK_URL;

    if (makeWebhookUrl) {
      // Despachar vía Make.com (evita App Review)
      await dispatchReplyViaMake({
        platform: item.platform,
        type: item.type,
        externalId: item.externalId,
        fromExternalId: item.fromExternalId || "",
        replyMessage: replyText,
        accessToken,
        pageAccessToken: accessToken,
      });
    } else {
      // Fallback: llamar directamente a Meta Graph API

      if (isDM) {
        if (!item.fromExternalId) {
          throw new Error("Falta fromExternalId para responder DM");
        }

        if (item.platform === "INSTAGRAM") {
          await replyInstagramMessage({
            pageAccessToken: accessToken,
            recipientId: item.fromExternalId,
            message: replyText,
          });
        } else {
          await replyFacebookMessage({
            pageAccessToken: accessToken,
            recipientId: item.fromExternalId,
            message: replyText,
          });
        }
      } else {
        // COMMENT
        await replyToComment({
          commentId: item.externalId,
          accessToken,
          message: replyText,
        });
      }
    }

    // Marcar como respondido por la IA
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        status: "ANSWERED",
        aiReplied: true,
        aiSuggestedReply: replyText,
      },
    });

    return {
      repliedAutomatically: true,
      replyText,
    };
  } catch (dispatchError: any) {
    console.error(`[Auto-Responder Dispatch Error]:`, dispatchError);
    // Guardar sugerencia aunque falle el envío
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        aiSuggestedReply: replyText,
      },
    });
    throw dispatchError;
  }
}

