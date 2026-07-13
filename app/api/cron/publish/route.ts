import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { publishFacebookPost, publishInstagramMedia } from "@/lib/integrations/meta";
import { refreshYoutubeToken, uploadYoutubeVideo } from "@/lib/integrations/youtube";

/**
 * Este endpoint debe llamarse periódicamente (cada 5 min, por ejemplo) desde:
 * - Vercel Cron (vercel.json), o
 * - Un cron job externo (cron-job.org, GitHub Actions, etc.)
 *
 * Protegido con CRON_SECRET para que nadie más pueda dispararlo.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duePosts = await prisma.scheduledPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    include: { socialAccount: true },
    take: 20, // procesa en lotes para no saturar
  });

  const results = [];

  for (const post of duePosts) {
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { status: "PUBLISHING" },
    });

    try {
      const externalId = await publishToPlatform(post);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), externalPostId: externalId },
      });
      results.push({ id: post.id, status: "PUBLISHED" });
    } catch (err: any) {
      console.error(`Error publicando post ${post.id}:`, err);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "FAILED", errorMessage: String(err.message ?? err) },
      });
      results.push({ id: post.id, status: "FAILED", error: String(err.message ?? err) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

async function publishToPlatform(
  post: Awaited<ReturnType<typeof prisma.scheduledPost.findFirst>> & {
    socialAccount: { accessToken: string; refreshToken: string | null; externalId: string; id: string };
  }
): Promise<string> {
  const account = post!.socialAccount;

  switch (post!.platform) {
    case "FACEBOOK": {
      const pageAccessToken = decryptToken(account.accessToken);
      const isVideo = post!.mediaUrl.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|3gp|wmv)($|\?)/) !== null;
      const isReel = post!.type === "REEL";
      const res = await publishFacebookPost({
        pageId: account.externalId,
        pageAccessToken,
        message: post!.caption ?? undefined,
        videoUrl: isVideo ? post!.mediaUrl : undefined,
        imageUrl: !isVideo ? post!.mediaUrl : undefined,
        isReel,
      });
      return res.id ?? res.post_id ?? "unknown";
    }

    case "INSTAGRAM": {
      const accessToken = decryptToken(account.accessToken);
      const isVideo = post!.mediaUrl.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|3gp|wmv)($|\?)/) !== null;
      
      let mediaType: "IMAGE" | "REELS" | "STORIES" = "IMAGE";
      if (post!.type === "STORY") {
        mediaType = "STORIES";
      } else if (isVideo) {
        mediaType = "REELS";
      }

      const res = await publishInstagramMedia({
        igUserId: account.externalId,
        accessToken,
        caption: post!.caption ?? undefined,
        videoUrl: isVideo ? post!.mediaUrl : undefined,
        imageUrl: !isVideo ? post!.mediaUrl : undefined,
        mediaType,
      });
      return res.id ?? "unknown";
    }

    case "YOUTUBE": {
      // Renovar el access token con el refresh token antes de subir
      if (!account.refreshToken) throw new Error("Cuenta de YouTube sin refresh token guardado.");
      const refreshToken = decryptToken(account.refreshToken);
      const { accessToken, expiresInSeconds } = await refreshYoutubeToken(refreshToken);

      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptToken(accessToken),
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        },
      });

      // Descargar el video desde el storage (Cloudinary/S3) para subirlo a YouTube
      const videoRes = await fetch(post!.mediaUrl);
      if (!videoRes.ok) throw new Error("No se pudo descargar el video desde mediaUrl.");
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

      const res = await uploadYoutubeVideo({
        accessToken,
        videoBuffer,
        title: post!.caption?.slice(0, 100) || "Video sin título",
        description: post!.caption ?? undefined,
        isShort: post!.type === "SHORT",
        privacyStatus: "public",
      });
      return res.id ?? "unknown";
    }

    default:
      throw new Error(`Plataforma no soportada: ${post!.platform}`);
  }
}
