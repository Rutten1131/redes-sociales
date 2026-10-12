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

  // 1. Prioridad: Verificar si es un COMENTARIO y si el Post específico tiene auto-respuesta configurada
  let postCaption: string | null = null;
  if (!isDM && item.parentId) {
    try {
      // Búsqueda flexible de post: exacta o por sufijo/prefijo (Facebook a veces antepone PAGE_ID_)
      const cleanParentId = item.parentId.includes("_") ? item.parentId.split("_").pop()! : item.parentId;
      let localPost = await prisma.scheduledPost.findFirst({
        where: {
          OR: [
            { externalPostId: item.parentId },
            { externalPostId: cleanParentId },
            { externalPostId: { endsWith: cleanParentId } },
          ],
        },
        select: {
          id: true,
          caption: true,
          autoCommentReplyEnabled: true,
          autoCommentReplyText: true,
        },
      });

      // Fallback para posts publicados vía Make (cuyo externalPostId es "make_id"):
      // Si no hubo coincidencia directa de ID, buscamos el post publicado más reciente
      // en esta misma cuenta social que tenga autoCommentReplyEnabled activo.
      if (!localPost) {
        const fallbackPost = await prisma.scheduledPost.findFirst({
          where: {
            socialAccountId: item.socialAccountId,
            status: "PUBLISHED",
            autoCommentReplyEnabled: true,
          },
          orderBy: { publishedAt: "desc" },
          select: {
            id: true,
            caption: true,
            autoCommentReplyEnabled: true,
            autoCommentReplyText: true,
          },
        });

        if (fallbackPost) {
          localPost = fallbackPost;
          console.log(`[Auto-Responder 🎯 MATCH MAKE] Post vinculado por cuenta social para item ${inboxItemId} (Post ID BD: ${fallbackPost.id})`);
          // Enlazar de forma permanente el externalPostId real para futuras consultas y analíticas
          prisma.scheduledPost.update({
            where: { id: fallbackPost.id },
            data: { externalPostId: item.parentId },
          }).catch((err) => console.warn("[Auto-Responder] No se pudo actualizar externalPostId:", err));
        }
      }

      // JERARQUÍA NIVEL 1: Si el post tiene respuesta configurada propia
      if (localPost?.autoCommentReplyEnabled && localPost.autoCommentReplyText?.trim()) {
        const replyText = localPost.autoCommentReplyText.trim();
        console.log(`[Auto-Responder 🎯 POST RULE] Post ${item.parentId} tiene respuesta automática propia configurada.`);

        // Marcamos de inmediato para evitar que otro cron intente procesar
        await prisma.inboxItem.update({
          where: { id: inboxItemId },
          data: {
            aiSuggestedReply: replyText,
            aiReplied: true,
            status: "ANSWERED",
          },
        });

        // Retardo natural de 2 a 4 segundos
        const delayMs = Math.floor(Math.random() * 2000) + 2000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        const accessToken = decryptToken(item.socialAccount.accessToken);
        const makeWebhookUrl = process.env.MAKE_INBOX_REPLY_WEBHOOK_URL;

        if (makeWebhookUrl) {
          await dispatchReplyViaMake({
            platform: item.platform,
            type: item.type,
            externalId: item.externalId,
            fromExternalId: item.fromExternalId || "",
            replyMessage: replyText,
            businessId: business.id,
            businessName: business.name,
            accessToken,
            pageAccessToken: accessToken,
          });
        } else {
          await replyToComment({
            commentId: item.externalId,
            accessToken,
            message: replyText,
          });
        }

        console.log(`[Auto-Responder 🎯 POST RULE] Respondido exitosamente a comentario ${item.externalId} con la plantilla del post.`);
        return {
          repliedAutomatically: true,
          replyText,
        };
      }

      if (localPost?.caption) {
        postCaption = localPost.caption;
        console.log(`[Auto-Responder] Contexto obtenido de ScheduledPost para item ${inboxItemId}: "${postCaption.slice(0, 60)}..."`);
      } else {
        // Fallback: Si el post fue publicado fuera de la app (en Meta Business Suite o app móvil),
        // consultamos directamente a la Graph API para obtener el texto del post
        try {
          const accessToken = decryptToken(item.socialAccount.accessToken);
          const postUrl = item.platform === "INSTAGRAM"
            ? `https://graph.facebook.com/v19.0/${item.parentId}?fields=caption&access_token=${accessToken}`
            : `https://graph.facebook.com/v19.0/${item.parentId}?fields=message&access_token=${accessToken}`;

          const pRes = await fetch(postUrl);
          if (pRes.ok) {
            const pData = await pRes.json();
            postCaption = pData.caption || pData.message || null;
            if (postCaption) {
              console.log(`[Auto-Responder] Contexto obtenido directo de Graph API para ${item.parentId}: "${postCaption.slice(0, 60)}..."`);
            }
          }
        } catch (metaErr) {
          console.warn(`[Auto-Responder] No se pudo consultar Graph API para post ${item.parentId}:`, metaErr);
        }
      }
    } catch (postErr) {
      console.warn(`[Auto-Responder] No se pudo obtener post caption para ${item.parentId}:`, postErr);
    }
  }

  // 2. Generar respuesta estructurada con Groq
  const aiResult = await generateAiReply({
    businessName: business.name,
    aiPrompt: business.aiPrompt,
    aiDMsPrompt: business.aiDMsPrompt,
    aiCommentsPrompt: business.aiCommentsPrompt,
    aiTone: business.aiTone,
    type: item.type as "DM" | "COMMENT",
    platform: item.platform,
    fromName: item.fromName,
    content: item.content,
    postCaption,
  });

  const { replyMessage, needsHuman, reason } = aiResult;

  // 3. Si la IA detectó que REQUIERE ATENCIÓN HUMANA (queja, reembolso, cliente enojado)
  if (needsHuman) {
    console.warn(`[Auto-Responder 🚨 NEEDS HUMAN] Item ${inboxItemId} requiere atención humana. Motivo: ${reason}`);
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        aiSuggestedReply: `⚠️ [REQUIERE ATENCIÓN HUMANA: ${reason}]\nSugerencia: ${replyMessage}`,
      },
    });

    return {
      repliedAutomatically: false,
      replyText: replyMessage,
    };
  }

  // 4. Si el auto-reply está apagado en settings, solo guardar la sugerencia para revisión del usuario
  if (!shouldAutoReply) {
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        aiSuggestedReply: replyMessage,
      },
    });
    return {
      repliedAutomatically: false,
      replyText: replyMessage,
    };
  }

  // 5. Retardo humano natural (3 a 5 segundos) para no parecer un bot instantáneo
  const delayMs = Math.floor(Math.random() * 2000) + 3000; // entre 3000ms y 5000ms
  console.log(`[Auto-Responder] Esperando ${delayMs}ms para simular respuesta humana natural...`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  // 6. Despachar la respuesta automáticamente
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
        replyMessage: replyMessage,
        businessId: business.id,
        businessName: business.name,
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
            message: replyMessage,
          });
        } else {
          await replyFacebookMessage({
            pageAccessToken: accessToken,
            recipientId: item.fromExternalId,
            message: replyMessage,
          });
        }
      } else {
        // COMMENT
        await replyToComment({
          commentId: item.externalId,
          accessToken,
          message: replyMessage,
        });
      }
    }

    // Marcar como respondido por la IA
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        status: "ANSWERED",
        aiReplied: true,
        aiSuggestedReply: replyMessage,
      },
    });

    return {
      repliedAutomatically: true,
      replyText: replyMessage,
    };
  } catch (dispatchError: any) {
    console.error(`[Auto-Responder Dispatch Error]:`, dispatchError);
    // Guardar sugerencia aunque falle el envío
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        aiSuggestedReply: replyMessage,
      },
    });
    throw dispatchError;
  }
}

