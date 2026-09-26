import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PostType } from "@prisma/client";

// Esquema para recibir posts desde el otro proyecto / CRM
const mediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(["IMAGE", "VIDEO"]),
});

const externalPostSchema = z.object({
  caption: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaItems: z.array(mediaItemSchema).optional(), // Para carruseles
  type: z.enum(["FEED_POST", "REEL", "STORY", "CAROUSEL", "VIDEO_NORMAL", "SHORT"]).default("FEED_POST"),
  scheduledAt: z.string(), // ISO string (ej: "2026-10-01T15:00:00Z")
  platforms: z.array(z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE", "LINKEDIN"])).optional(),
  secret: z.string().optional(),
});

function validateCesarAuth(req: NextRequest, bodySecret?: string) {
  const expectedSecret = process.env.CESAR_REYES_API_KEY || process.env.INTERNAL_API_SECRET;
  const authHeader = req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("x-api-key");
  const querySecret = req.nextUrl.searchParams.get("secret");

  const providedSecret =
    apiKeyHeader ||
    (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null) ||
    querySecret ||
    bodySecret;

  return Boolean(expectedSecret && providedSecret === expectedSecret);
}

/**
 * POST /api/external/cesar-reyes/schedule
 * Webhook para programar publicaciones exclusivamente en las cuentas de César Reyes Jaramillo
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // 1. Validar autenticación
    if (!validateCesarAuth(req, body.secret)) {
      return NextResponse.json(
        {
          error: "No autorizado. Se requiere un secreto o API key válida para César Reyes Jaramillo.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // 2. Validar payload
    const parsed = externalPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos de publicación inválidos.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { caption, mediaUrl, mediaItems, type, scheduledAt, platforms } = parsed.data;

    if (type === "CAROUSEL" && (!mediaItems || mediaItems.length < 2)) {
      return NextResponse.json(
        { error: "Un post de tipo CAROUSEL requiere 'mediaItems' con al menos 2 imágenes o videos." },
        { status: 400 }
      );
    }

    if (type !== "CAROUSEL" && !mediaUrl) {
      return NextResponse.json(
        { error: "Se requiere 'mediaUrl' (URL pública) para este tipo de post." },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "El formato de 'scheduledAt' debe ser formato ISO válido (ej: 2026-10-01T14:30:00Z)." },
        { status: 400 }
      );
    }

    // 3. AISLAMIENTO ESTRICTO: Buscar ÚNICAMENTE el negocio de César Reyes Jaramillo
    const cesarBusiness = await prisma.business.findFirst({
      where: {
        OR: [
          { id: "cmrp6bdxz000304kzi6c9a467" },
          { name: { contains: "Cesar Reyes" } },
        ],
      },
      include: {
        socialAccounts: true,
      },
    });

    if (!cesarBusiness) {
      return NextResponse.json(
        {
          error: "Negocio de César Reyes Jaramillo no encontrado en la base de datos.",
          code: "BUSINESS_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // 4. Filtrar las cuentas sociales conectadas según las plataformas solicitadas
    // Si no especifica platforms, por defecto publica en FB e IG
    const targetPlatforms = platforms && platforms.length > 0 ? platforms : ["FACEBOOK", "INSTAGRAM"];
    const matchingAccounts = cesarBusiness.socialAccounts.filter((acc) =>
      targetPlatforms.includes(acc.platform as any)
    );

    if (matchingAccounts.length === 0) {
      return NextResponse.json(
        {
          error: `No hay cuentas sociales conectadas para César Reyes en las plataformas solicitadas: ${targetPlatforms.join(", ")}.`,
          code: "NO_ACCOUNTS_FOUND",
          availablePlatforms: cesarBusiness.socialAccounts.map((a) => a.platform),
        },
        { status: 400 }
      );
    }

    // 5. Crear los registros de ScheduledPost
    const createdPosts = [];

    for (const account of matchingAccounts) {
      let dbType: PostType = type as PostType;

      if (account.platform === "TIKTOK") {
        dbType = "TIKTOK_VIDEO";
      } else if (account.platform === "YOUTUBE") {
        dbType = type === "SHORT" ? "SHORT" : "VIDEO";
      } else if (type === "VIDEO_NORMAL") {
        dbType = "FEED_POST";
      }

      const post = await prisma.scheduledPost.create({
        data: {
          userId: cesarBusiness.userId,
          socialAccountId: account.id,
          platform: account.platform,
          type: dbType,
          caption: caption || null,
          mediaUrl: mediaUrl ?? "",
          scheduledAt: scheduledDate,
          status: "SCHEDULED",
          ...(type === "CAROUSEL" && mediaItems
            ? {
                mediaItems: {
                  create: mediaItems.map((item, index) => ({
                    url: item.url,
                    type: item.type,
                    order: index,
                  })),
                },
              }
            : {}),
        },
      });

      createdPosts.push({
        id: post.id,
        platform: post.platform,
        accountName: account.displayName,
        type: post.type,
        scheduledAt: post.scheduledAt,
        status: post.status,
      });
    }

    return NextResponse.json({
      success: true,
      message: `¡Publicación programada exitosamente para César Reyes Jaramillo! (${createdPosts.length} cuentas vinculadas)`,
      business: cesarBusiness.name,
      businessId: cesarBusiness.id,
      scheduledAt: scheduledDate.toISOString(),
      posts: createdPosts,
    });
  } catch (error: any) {
    console.error("[CESAR REYES SCHEDULE ERROR]:", error);
    return NextResponse.json(
      {
        error: "Error interno al programar publicación para César Reyes.",
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
