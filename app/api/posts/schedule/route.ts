import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const mediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(["IMAGE", "VIDEO"]),
});

const schema = z.object({
  socialAccountIds: z.array(z.string()).min(1),
  type: z.enum(["FEED_POST", "REEL", "STORY", "VIDEO", "SHORT", "CAROUSEL"]),
  caption: z.string().optional(),
  mediaUrl: z.string().url().optional(),       // opcional para CAROUSEL
  mediaItems: z.array(mediaItemSchema).optional(), // solo para CAROUSEL
  thumbnailUrl: z.string().url().optional(),
  scheduledAt: z.string(), // ISO date string
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { socialAccountIds, type, caption, mediaUrl, mediaItems, thumbnailUrl, scheduledAt } = parsed.data;

  // Validación: CAROUSEL necesita mediaItems, el resto necesita mediaUrl
  if (type === "CAROUSEL" && (!mediaItems || mediaItems.length < 2)) {
    return NextResponse.json({ error: "Un carrusel necesita al menos 2 archivos." }, { status: 400 });
  }
  if (type !== "CAROUSEL" && !mediaUrl) {
    return NextResponse.json({ error: "Se requiere mediaUrl para este tipo de post." }, { status: 400 });
  }

  // Verificar que todas las cuentas sociales pertenecen a un negocio propiedad del usuario autenticado
  const accounts = await prisma.socialAccount.findMany({
    where: {
      id: { in: socialAccountIds },
      business: {
        userId: session.user.id,
      },
    },
  });

  if (accounts.length === 0) {
    return NextResponse.json({ error: "Cuentas sociales no encontradas" }, { status: 404 });
  }

  const createdPosts = [];

  for (const account of accounts) {
    const post = await prisma.scheduledPost.create({
      data: {
        userId: session.user.id,
        socialAccountId: account.id,
        platform: account.platform,
        type,
        caption,
        mediaUrl: mediaUrl ?? "",
        thumbnailUrl,
        scheduledAt: new Date(scheduledAt),
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
    createdPosts.push(post);
  }

  return NextResponse.json({ posts: createdPosts });
}

// GET /api/posts/schedule -> lista los posts programados del negocio
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Falta businessId" }, { status: 400 });
  }

  const posts = await prisma.scheduledPost.findMany({
    where: {
      userId: session.user.id,
      socialAccount: {
        businessId,
      },
    },
    include: {
      socialAccount: true,
      mediaItems: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json({ posts });
}
