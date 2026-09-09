import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostType } from "@prisma/client";

/**
 * Endpoints seguros para el Agente Hermes en el VPS.
 * Protegido mediante header: Authorization: Bearer <INTERNAL_API_SECRET>
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || req.headers.get("x-internal-secret");
  const secret = process.env.INTERNAL_API_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action") || "status";

  // 1. Listar Negocios y Cuentas Conectadas
  if (action === "accounts") {
    const businesses = await prisma.business.findMany({
      include: {
        socialAccounts: {
          select: {
            id: true,
            platform: true,
            displayName: true,
            externalId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ businesses });
  }

  // 2. Listar Publicaciones Programadas pendientes
  if (action === "pending-posts") {
    const posts = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gte: new Date() },
      },
      include: {
        socialAccount: {
          select: { displayName: true, platform: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    });
    return NextResponse.json({ posts });
  }

  // 3. Listar DMs o Comentarios recientes no respondidos (Inbox)
  if (action === "unread-inbox") {
    const unread = await prisma.inboxItem.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        socialAccount: {
          select: { displayName: true, platform: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ unread });
  }

  return NextResponse.json({
    status: "online",
    message: "Hermes Gateway Activo",
    available_actions: ["accounts", "pending-posts", "unread-inbox"],
  });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || req.headers.get("x-internal-secret");
  const secret = process.env.INTERNAL_API_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Acción: Programar Post
    if (action === "schedule-post") {
      const {
        businessId,
        socialAccountIds,
        caption,
        mediaUrl,
        type = "FEED_POST",
        scheduledAt,
      } = body;

      if (!scheduledAt) {
        return NextResponse.json({ error: "Falta scheduledAt" }, { status: 400 });
      }

      // Buscar cuentas destino
      let targetAccounts = [];
      if (socialAccountIds && socialAccountIds.length > 0) {
        targetAccounts = await prisma.socialAccount.findMany({
          where: { id: { in: socialAccountIds } },
          include: { business: true },
        });
      } else if (businessId) {
        targetAccounts = await prisma.socialAccount.findMany({
          where: { businessId },
          include: { business: true },
        });
      } else {
        // Por defecto usar las cuentas del primer negocio activo
        const firstBiz = await prisma.business.findFirst({
          include: { socialAccounts: true },
        });
        if (firstBiz) targetAccounts = firstBiz.socialAccounts;
      }

      if (targetAccounts.length === 0) {
        return NextResponse.json({ error: "No se encontraron cuentas sociales para programar" }, { status: 404 });
      }

      const created = [];
      for (const acc of targetAccounts) {
        let dbType: PostType = "FEED_POST";
        if (acc.platform === "YOUTUBE") {
          dbType = "VIDEO";
        } else if (type === "REEL" || type === "STORY" || type === "CAROUSEL") {
          dbType = type as PostType;
        }

        const post = await prisma.scheduledPost.create({
          data: {
            userId: (acc as any).business?.userId || (await prisma.user.findFirst())?.id || "",
            socialAccountId: acc.id,
            platform: acc.platform,
            type: dbType,
            caption: caption || null,
            mediaUrl: mediaUrl || "",
            scheduledAt: new Date(scheduledAt),
            status: "SCHEDULED",
          },
        });
        created.push({ id: post.id, platform: acc.platform, scheduledAt: post.scheduledAt });
      }

      return NextResponse.json({
        success: true,
        message: `Programadas ${created.length} publicaciones con éxito`,
        posts: created,
      });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
