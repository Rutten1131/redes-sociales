import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
 * GET /api/external/analytics/business/[businessId]
 * Obtiene el resumen o histórico de analíticas de los posts de un negocio (ej: Aroma de Montaña)
 * Query params:
 * - limit: número de posts (default 10)
 * - platform: FACEBOOK | INSTAGRAM (opcional)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    if (!validateAuth(req)) {
      return NextResponse.json(
        { error: "No autorizado. Envía x-api-key, Bearer token o ?secret=" },
        { status: 401 }
      );
    }

    const { businessId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const platform = searchParams.get("platform");

    // Verificar si el negocio existe
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    // Buscar posts publicados del negocio con sus analíticas
    const posts = await prisma.scheduledPost.findMany({
      where: {
        socialAccount: { businessId },
        status: "PUBLISHED",
        ...(platform ? { platform: platform as any } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: Math.min(limit, 50),
      include: {
        socialAccount: {
          select: {
            platform: true,
            displayName: true,
          },
        },
        analytics: true,
      },
    });

    // Calcular totales agregados para el CRM
    const summary = posts.reduce(
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
      business,
      totalPostsAnalyzed: posts.length,
      aggregateSummary: summary,
      posts: posts.map((p) => ({
        id: p.id,
        platform: p.platform,
        type: p.type,
        caption: p.caption,
        mediaUrl: p.mediaUrl,
        publishedAt: p.publishedAt,
        externalPostId: p.externalPostId,
        accountName: p.socialAccount.displayName,
        analytics: p.analytics || null,
      })),
    });
  } catch (error: any) {
    console.error("[GET /api/external/analytics/business/[businessId]] Error:", error);
    return NextResponse.json(
      { error: "Error obteniendo resumen del negocio", details: error.message },
      { status: 500 }
    );
  }
}
