import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateAiReply } from "@/lib/ai/groq";

/**
 * POST /api/ai/generate-reply
 * Genera una sugerencia de respuesta con Groq para un InboxItem o para pruebas.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    itemId,
    businessId,
    type = "DM",
    platform = "FACEBOOK",
    fromName,
    content,
    aiPrompt,
    aiDMsPrompt,
    aiCommentsPrompt,
    aiTone,
  } = body;

  try {
    let business;
    let finalType = type;
    let finalPlatform = platform;
    let finalFromName = fromName;
    let finalContent = content;

    let postCaption: string | null = null;
    if (itemId) {
      const item = await prisma.inboxItem.findUnique({
        where: { id: itemId },
        include: {
          socialAccount: {
            include: {
              business: true,
            },
          },
        },
      });

      if (!item || item.socialAccount.business.userId !== session.user.id) {
        return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
      }

      business = item.socialAccount.business;
      finalType = item.type as "DM" | "COMMENT";
      finalPlatform = item.platform as "FACEBOOK" | "INSTAGRAM";
      finalFromName = item.fromName;
      finalContent = item.content;

      // Buscar contexto del post
      if (item.type === "COMMENT" && item.parentId) {
        const localPost = await prisma.scheduledPost.findFirst({
          where: { externalPostId: item.parentId },
          select: { caption: true },
        });
        if (localPost?.caption) {
          postCaption = localPost.caption;
        }
      }
    } else if (businessId) {
      business = await prisma.business.findFirst({
        where: { id: businessId, userId: session.user.id },
      });

      if (!business) {
        return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "itemId o businessId requerido" }, { status: 400 });
    }

    const aiResult = await generateAiReply({
      businessName: business.name,
      aiPrompt: aiPrompt !== undefined ? aiPrompt : business.aiPrompt,
      aiDMsPrompt: aiDMsPrompt !== undefined ? aiDMsPrompt : business.aiDMsPrompt,
      aiCommentsPrompt: aiCommentsPrompt !== undefined ? aiCommentsPrompt : business.aiCommentsPrompt,
      aiTone: aiTone !== undefined ? aiTone : business.aiTone,
      type: finalType,
      platform: finalPlatform,
      fromName: finalFromName,
      content: finalContent,
      postCaption,
    });

    // Si viene de un itemId, guardamos la sugerencia en la base de datos
    if (itemId) {
      const suggestionText = aiResult.needsHuman
        ? `⚠️ [REQUIERE ATENCIÓN HUMANA: ${aiResult.reason}]\nSugerencia: ${aiResult.replyMessage}`
        : aiResult.replyMessage;

      await prisma.inboxItem.update({
        where: { id: itemId },
        data: { aiSuggestedReply: suggestionText },
      });
    }

    return NextResponse.json({
      reply: aiResult.replyMessage,
      needsHuman: aiResult.needsHuman,
      reason: aiResult.reason,
    });
  } catch (error: any) {
    console.error("[API generate-reply error]:", error);
    return NextResponse.json({ error: error.message || "Error generando respuesta" }, { status: 500 });
  }
}
