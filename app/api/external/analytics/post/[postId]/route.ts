import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { getFacebookPostAnalytics, getInstagramMediaAnalytics } from "@/lib/integrations/meta";

// Helper para validar autenticación de la petición
function validateAuth(req: NextRequest) {
  const expectedSecret = process.env.INTERNAL_API_SECRET || process.env.AGENDA_CULTURAL_API_KEY || process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("x-api-key");
  const querySecret = req.nextUrl.searchParams.get("secret");

  const providedSecret =
    apiKeyHeader ||
    (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null) ||
    querySecret;

  if (expectedSecret && providedSecret === expectedSecret) {
    return true;
  }
  return false;
}

/**
 * GET /api/external/analytics/post/[postId]
 * Obtiene las analíticas almacenadas o sincronizadas en vivo de un post publicado.
 * Parámetros opcionales: ?sync=true (fuerza consulta en vivo a Meta y actualiza BD)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    if (!validateAuth(req)) {
      return NextResponse.json(
        { error: "No autorizado. Envía x-api-key, Bearer token o ?secret=" },
        { status: 401 }
      );
    }

    const { postId } = await params;
    const { searchParams } = new URL(req.url);
    const forceSync = searchParams.get("sync") === "true";

    const post = await prisma.scheduledPost.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          include: { business: true },
        },
        analytics: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
    }

    if (post.status !== "PUBLISHED" || !post.externalPostId) {
      return NextResponse.json(
        {
          error: "El post aún no ha sido publicado o no tiene externalPostId",
          status: post.status,
        },
        { status: 400 }
      );
    }

    // Si ya tiene analíticas y no se pidió sync forzado, devolver las de la base de datos
    if (post.analytics && !forceSync) {
      return NextResponse.json({
        success: true,
        source: "database",
        post: {
          id: post.id,
          platform: post.platform,
          type: post.type,
          publishedAt: post.publishedAt,
          externalPostId: post.externalPostId,
          businessName: post.socialAccount.business.name,
        },
        analytics: post.analytics,
      });
    }

    // Sincronizar en vivo desde la red social
    const account = post.socialAccount;
    const decryptedToken = decryptToken(account.accessToken);
    let metricsResult = null;

    if (post.platform === "FACEBOOK") {
      const isVideo = post.type === "REEL" || post.type === "VIDEO" || post.mediaUrl.match(/\.(mp4|mov|webm)$/i);
      metricsResult = await getFacebookPostAnalytics({
        externalPostId: post.externalPostId,
        pageAccessToken: decryptedToken,
        isVideo: Boolean(isVideo),
      });
    } else if (post.platform === "INSTAGRAM") {
      const isReel = post.type === "REEL";
      metricsResult = await getInstagramMediaAnalytics({
        mediaId: post.externalPostId,
        accessToken: decryptedToken,
        isReel,
      });
    } else {
      return NextResponse.json(
        {
          error: `Analytics aún no configuradas para la plataforma ${post.platform}`,
        },
        { status: 400 }
      );
    }

    // Guardar o actualizar en base de datos
    const savedAnalytics = await prisma.postAnalytics.upsert({
      where: { postId: post.id },
      create: {
        postId: post.id,
        impressions: metricsResult.impressions,
        reach: metricsResult.reach,
        views: metricsResult.views,
        likes: metricsResult.likes,
        comments: metricsResult.comments,
        shares: metricsResult.shares,
        saved: metricsResult.saved,
        clicks: metricsResult.clicks,
        watchTimeTotalSeconds: metricsResult.watchTimeTotalSeconds,
        avgWatchTimeSeconds: metricsResult.avgWatchTimeSeconds,
        retentionRate: metricsResult.retentionRate,
        rawMetrics: JSON.stringify(metricsResult.raw),
        syncedAt: new Date(),
      },
      update: {
        impressions: metricsResult.impressions,
        reach: metricsResult.reach,
        views: metricsResult.views,
        likes: metricsResult.likes,
        comments: metricsResult.comments,
        shares: metricsResult.shares,
        saved: metricsResult.saved,
        clicks: metricsResult.clicks,
        watchTimeTotalSeconds: metricsResult.watchTimeTotalSeconds,
        avgWatchTimeSeconds: metricsResult.avgWatchTimeSeconds,
        retentionRate: metricsResult.retentionRate,
        rawMetrics: JSON.stringify(metricsResult.raw),
        syncedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      source: "live_sync",
      post: {
        id: post.id,
        platform: post.platform,
        type: post.type,
        publishedAt: post.publishedAt,
        externalPostId: post.externalPostId,
        businessName: post.socialAccount.business.name,
      },
      analytics: savedAnalytics,
    });
  } catch (error: any) {
    console.error("[GET /api/external/analytics/post/[postId]] Error:", error);
    return NextResponse.json(
      { error: "Error obteniendo analíticas", details: error.message },
      { status: 500 }
    );
  }
}
