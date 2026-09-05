import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { getFacebookRecentComments, getInstagramRecentComments } from "@/lib/integrations/meta";
import { processInboxItemWithAi } from "@/lib/ai/auto-responder";

/**
 * Cron Job para sincronizar comentarios de Facebook e Instagram directamente
 * sin necesidad de Meta App Review ni consumo de operaciones de Make.
 * 
 * Se ejecuta periódicamente mediante Vercel Cron (ej. cada 1 hora).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 1. Obtener todas las cuentas activas de Facebook e Instagram
    const accounts = await prisma.socialAccount.findMany({
      where: {
        platform: {
          in: ["FACEBOOK", "INSTAGRAM"],
        },
      },
    });

    let totalSaved = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        const decryptedToken = decryptToken(account.accessToken);

        if (account.platform === "FACEBOOK") {
          const postsWithComments = await getFacebookRecentComments({
            pageId: account.externalId,
            pageAccessToken: decryptedToken,
            postLimit: 5,
            commentLimit: 15,
          });

          for (const post of postsWithComments) {
            for (const comment of post.comments) {
              const existing = await prisma.inboxItem.findUnique({
                where: {
                  socialAccountId_externalId: {
                    socialAccountId: account.id,
                    externalId: comment.id,
                  },
                },
              });

              if (!existing) {
                const newItem = await prisma.inboxItem.create({
                  data: {
                    socialAccountId: account.id,
                    platform: "FACEBOOK",
                    type: "COMMENT",
                    externalId: comment.id,
                    parentId: post.postId,
                    fromName: comment.from?.name || "Usuario",
                    fromExternalId: comment.from?.id || null,
                    content: comment.message,
                    status: "PENDING",
                  },
                });

                totalSaved++;

                // Opcional: procesar sugerencia con IA
                processInboxItemWithAi(newItem.id).catch((err) => {
                  console.error(`[Cron Sync FB AI Error ${newItem.id}]:`, err);
                });
              } else {
                totalSkipped++;
              }
            }
          }
        } else if (account.platform === "INSTAGRAM") {
          const mediaWithComments = await getInstagramRecentComments({
            igUserId: account.externalId,
            accessToken: decryptedToken,
            mediaLimit: 5,
            commentLimit: 15,
          });

          for (const media of mediaWithComments) {
            for (const comment of media.comments) {
              const existing = await prisma.inboxItem.findUnique({
                where: {
                  socialAccountId_externalId: {
                    socialAccountId: account.id,
                    externalId: comment.id,
                  },
                },
              });

              if (!existing) {
                const newItem = await prisma.inboxItem.create({
                  data: {
                    socialAccountId: account.id,
                    platform: "INSTAGRAM",
                    type: "COMMENT",
                    externalId: comment.id,
                    parentId: media.postId,
                    fromName: comment.from?.name || "Usuario de Instagram",
                    fromExternalId: comment.from?.id || null,
                    content: comment.message,
                    status: "PENDING",
                  },
                });

                totalSaved++;

                processInboxItemWithAi(newItem.id).catch((err) => {
                  console.error(`[Cron Sync IG AI Error ${newItem.id}]:`, err);
                });
              } else {
                totalSkipped++;
              }
            }
          }
        }
      } catch (accError: any) {
        console.error(`[Cron Sync Error cuenta ${account.displayName}]:`, accError);
        errors.push(`${account.displayName}: ${accError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      totalSaved,
      totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[Cron Sync Inbox Fatal Error]:", error);
    return NextResponse.json(
      { error: error.message || "Error al sincronizar comentarios" },
      { status: 500 }
    );
  }
}
