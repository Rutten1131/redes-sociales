import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PostType } from "@prisma/client";

// Esquema flexible para que el tercero envíe publicaciones fácilmente
const mediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(["IMAGE", "VIDEO"]),
});

const externalPostSchema = z.object({
  caption: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaItems: z.array(mediaItemSchema).optional(), // Para carruseles
  type: z.enum(["FEED_POST", "REEL", "STORY", "CAROUSEL", "VIDEO_NORMAL"]).default("FEED_POST"),
  scheduledAt: z.string(), // ISO string (ej: "2026-09-30T15:00:00Z")
  platforms: z.array(z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK"])).optional(), // Por defecto FB e IG
  secret: z.string().optional(), // Permite pasar el secreto en el body o cabecera
});

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación por API Key / Secreto de Webhook
    const expectedSecret = process.env.AGENDA_CULTURAL_API_KEY || process.env.INTERNAL_API_SECRET;
    const authHeader = req.headers.get("authorization");
    const apiKeyHeader = req.headers.get("x-api-key");
    const querySecret = req.nextUrl.searchParams.get("secret");

    const body = await req.json().catch(() => ({}));

    const providedSecret =
      apiKeyHeader ||
      (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null) ||
      querySecret ||
      body.secret;

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json(
        {
          error: "No autorizado. Se requiere un secreto o API key válida.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // 2. Validar payload del tercero
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
        { error: "Se requiere 'mediaUrl' (URL pública de imagen o video) para este tipo de post." },
        { status: 400 }
      );
    }

    // Validar fecha futura válida
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "El formato de 'scheduledAt' no es válido. Debe ser formato ISO (ej: 2026-10-01T14:30:00Z)." },
        { status: 400 }
      );
    }

    // 3. AISLAMIENTO ESTRICTO: Buscar ÚNICAMENTE el negocio de Agenda Cultural
    const agendaBusiness = await prisma.business.findFirst({
      where: {
        OR: [
          { name: { contains: "agenda" } },
          { name: { contains: "cultural" } },
          { id: process.env.AGENDA_CULTURAL_BUSINESS_ID || "" },
        ],
      },
      include: {
        socialAccounts: true,
      },
    });

    if (!agendaBusiness) {
      return NextResponse.json(
        {
          error: "Negocio de Agenda Cultural no encontrado en el sistema. Asegúrate de haberlo creado.",
          code: "BUSINESS_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // 4. Filtrar las cuentas sociales conectadas que aplican
    const targetPlatforms = platforms && platforms.length > 0 ? platforms : ["FACEBOOK", "INSTAGRAM"];
    const matchingAccounts = agendaBusiness.socialAccounts.filter((acc) =>
      targetPlatforms.includes(acc.platform as any)
    );

    if (matchingAccounts.length === 0) {
      return NextResponse.json(
        {
          error: `No hay cuentas sociales conectadas en Agenda Cultural para las plataformas solicitadas: ${targetPlatforms.join(", ")}.`,
          code: "NO_ACCOUNTS_FOUND",
        },
        { status: 400 }
      );
    }

    // 5. Crear los registros de ScheduledPost para cada cuenta
    const createdPosts = [];

    for (const account of matchingAccounts) {
      let dbType: PostType = type as PostType;

      if (account.platform === "TIKTOK") {
        dbType = "TIKTOK_VIDEO";
      } else if (type === "VIDEO_NORMAL") {
        dbType = "FEED_POST";
      }

      const post = await prisma.scheduledPost.create({
        data: {
          userId: agendaBusiness.userId,
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
        type: post.type,
        scheduledAt: post.scheduledAt,
        status: post.status,
      });
    }

    return NextResponse.json({
      success: true,
      message: `¡Publicación programada exitosamente en el calendario de Agenda Cultural! (${createdPosts.length} cuentas vinculadas)`,
      business: agendaBusiness.name,
      businessId: agendaBusiness.id,
      scheduledAt: scheduledDate.toISOString(),
      posts: createdPosts,
    });
  } catch (error: any) {
    console.error("[AGENDA CULTURAL TUNNEL ERROR]:", error);
    return NextResponse.json(
      {
        error: "Error interno al programar la publicación.",
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
