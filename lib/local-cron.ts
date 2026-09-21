import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { publishTikTokVideo } from "@/lib/tiktok-publisher";

let isRunning = false;

export async function checkAndPublishDuePosts() {
  if (isRunning) return;
  isRunning = true;

  try {
    const duePosts = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: new Date() }
      },
      include: {
        socialAccount: { include: { business: true } },
        mediaItems: { orderBy: { order: "asc" } }
      },
      take: 10
    });

    for (const post of duePosts) {
      const claimed = await prisma.scheduledPost.updateMany({
        where: { id: post.id, status: "SCHEDULED" },
        data: { status: "PUBLISHING" }
      });
      if (claimed.count === 0) continue;

      console.log(`[AUTOCRON] Procesando post ${post.id} para ${post.platform}...`);

      if (post.platform === "TIKTOK") {
        try {
          let cookies: any[] = [];
          try {
            const decrypted = decryptToken(post.socialAccount.accessToken);
            cookies = JSON.parse(decrypted);
          } catch {
            cookies = [];
          }

          if (Array.isArray(cookies) && cookies.length > 0) {
            const result = await publishTikTokVideo({
              cookies,
              videoUrl: post.mediaUrl,
              caption: post.caption
            });

            if (!result.success) {
              throw new Error(result.error || "Fallo en la publicación automática de TikTok");
            }

            await prisma.scheduledPost.update({
              where: { id: post.id },
              data: { status: "PUBLISHED", publishedAt: new Date(), errorMessage: null }
            });
            console.log(`[AUTOCRON] Post ${post.id} publicado con éxito en TikTok!`);
          } else {
            await prisma.scheduledPost.update({
              where: { id: post.id },
              data: { status: "PENDING_TIKTOK" }
            });
          }
        } catch (err: any) {
          console.error(`[AUTOCRON] Error en TikTok para post ${post.id}:`, err.message);
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: { status: "FAILED", errorMessage: String(err.message || err) }
          });
        }
      }
    }
  } catch (err: any) {
    console.error("[AUTOCRON] Error en verificación:", err.message);
  } finally {
    isRunning = false;
  }
}
