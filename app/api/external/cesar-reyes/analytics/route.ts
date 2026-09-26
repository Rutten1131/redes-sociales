import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { getFacebookPostAnalytics, getInstagramMediaAnalytics } from "@/lib/integrations/meta";

function validateCesarAuth(req: NextRequest) {
  const expectedSecret = process.env.CESAR_REYES_API_KEY || process.env.INTERNAL_API_SECRET;
  const authHeader = req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("x-api-key");
  const querySecret = req.nextUrl.searchParams.get("secret");

  const providedSecret =
    apiKeyHeader ||
    (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null) ||
    querySecret;

  return Boolean(expectedSecret && providedSecret === expectedSecret);
}

const CESAR_BUSINESS_ID = "cmrp6bdxz000304kzi6c9a467";

/**
 * GET /api/external/cesar-reyes/analytics
 * Obtiene el resumen de analíticas y el listado de posts publicados de César Reyes Jaramillo.
 * Opciones de query:
 * - limit: número de publicaciones (default 10)
 * - platform: FACEBOOK | INSTAGRAM | TIKTOK | YOUTUBE | LINKEDIN
 * - syncAll: true (sincroniza en tiempo real con Meta los últimos posts)
 */
export async function GET(req: NextRequest) {
  try {
    if (!validateCesarAuth(req)) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere API Key o Bearer token válido de César Reyes." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const platform = searchParams.get("platform");
    const syncAll = searchParams.get("syncAll") === "true";

    const business = await prisma.business.findFirst({
      where: {
        OR: [
          { id: CESAR_BUSINESS_ID },
          { name: { contains: "Cesar Reyes" } },
        ],
      },
      select: { id: true, name: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio de César Reyes no encontrado." }, { status: 404 });
    }

    // Buscar posts de César Reyes Jaramillo
    const posts = await prisma.scheduledPost.findMany({
      where: {
        socialAccount: { businessId: business.id },
        status: "PUBLISHED",
        ...(platform ? { platform: platform as any } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: Math.min(limit, 50),
      include: {
        socialAccount: true,
        analytics: true,
      },
    });

    // Si se pidió syncAll, sincronizar posts de FB/IG que tengan externalPostId
    if (syncAll) {
      for (const p of posts) {
        if (!p.externalPostId) continue;
        try {
          const decryptedToken = decryptToken(p.socialAccount.accessToken);
          let metricsResult = null;

          if (p.platform === "FACEBOOK") {
            const isVideo = p.type === "REEL" || p.type === "VIDEO" || p.mediaUrl?.match(/\.(mp4|mov|webm)$/i);
            metricsResult = await getFacebookPostAnalytics({
              externalPostId: p.externalPostId,
              pageAccessToken: decryptedToken,
              isVideo: Boolean(isVideo),
            });
          } else if (p.platform === "INSTAGRAM") {
            metricsResult = await getInstagramMediaAnalytics({
              mediaId: p.externalPostId,
              accessToken: decryptedToken,
              isReel: p.type === "REEL",
            });
          }

          if (metricsResult) {
            const updated = await prisma.postAnalytics.upsert({
              where: { postId: p.id },
              create: {
                postId: p.id,
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
            p.analytics = updated;
          }
        } catch (syncErr) {
          console.warn(`[SyncAll] Error sincronizando post ${p.id}:`, syncErr);
        }
      }
    }

    // Métricas totales agregadas
    const totals = posts.reduce(
      (acc, p) => {
        if (p.analytics) {
          acc.totalImpressions += p.analytics.impressions;
          acc.totalReach += p.analytics.reach;
          acc.totalViews += p.analytics.views;
          acc.totalLikes += p.analytics.likes;
          acc.totalComments += p.analytics.comments;
          acc.totalShares += p.analytics.shares;
          acc.totalSaved += p.analytics.saved;
          acc.totalClicks += p.analytics.clicks;
          acc.totalWatchTimeSeconds += p.analytics.watchTimeTotalSeconds;
        }
        return acc;
      },
      {
        totalImpressions: 0,
        totalReach: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalSaved: 0,
        totalClicks: 0,
        totalWatchTimeSeconds: 0,
      }
    );

    return NextResponse.json({
      success: true,
      business: business.name,
      businessId: business.id,
      postsCount: posts.length,
      aggregateTotals: totals,
      posts: posts.map((p) => ({
        id: p.id,
        platform: p.platform,
        accountName: p.socialAccount.displayName,
        type: p.type,
        caption: p.caption,
        mediaUrl: p.mediaUrl,
        publishedAt: p.publishedAt,
        externalPostId: p.externalPostId,
        analytics: p.analytics
          ? {
              impressions: p.analytics.impressions,
              reach: p.analytics.reach,
              views: p.analytics.views,
              likes: p.analytics.likes,
              comments: p.analytics.comments,
              shares: p.analytics.shares,
              saved: p.analytics.saved,
              clicks: p.analytics.clicks,
              watchTimeTotalSeconds: p.analytics.watchTimeTotalSeconds,
              avgWatchTimeSeconds: p.analytics.avgWatchTimeSeconds,
              retentionRate: p.analytics.retentionRate,
              syncedAt: p.analytics.syncedAt,
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error("[CESAR REYES ANALYTICS ERROR]:", error);
    return NextResponse.json(
      { error: "Error obteniendo analíticas de César Reyes.", details: error?.message },
      { status: 500 }
    );
  }
}
