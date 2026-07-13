import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PostType } from "@prisma/client";

const mediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(["IMAGE", "VIDEO"]),
});

const schema = z.object({
  socialAccountIds: z.array(z.string()).min(1),
  type: z.enum(["FEED_POST", "REEL", "STORY", "VIDEO", "SHORT", "CAROUSEL", "VIDEO_NORMAL"]),
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
    // Mapeo inteligente de formato conceptual a formato específico de base de datos
    let dbType: PostType;

    // Validar que los formatos de video contengan un archivo de video
    const isVideo = (mediaUrl || "").toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|3gp|wmv)($|\?)/) !== null;
    if ((type === "VIDEO_NORMAL" || type === "REEL") && !isVideo) {
      return NextResponse.json({ error: "Este formato requiere que subas un archivo de video." }, { status: 400 });
    }

    if (account.platform === "YOUTUBE") {
      if (type === "VIDEO_NORMAL") {
        dbType = "VIDEO";
      } else if (type === "REEL") {
        dbType = "SHORT";
      } else {
        return NextResponse.json({ error: `YouTube no soporta el formato ${type}.` }, { status: 400 });
      }
    } else if (account.platform === "LINKEDIN") {
      if (type === "VIDEO_NORMAL" || type === "REEL") {
        dbType = "FEED_POST"; // En LinkedIn todo video es una publicación (FEED_POST)
      } else if (type === "STORY") {
        return NextResponse.json({ error: "LinkedIn no soporta Historias." }, { status: 400 });
      } else {
        dbType = type as PostType;
      }
    } else {
      // Facebook e Instagram
      if (type === "VIDEO_NORMAL") {
        dbType = "FEED_POST"; // En FB/IG, un video largo es un post en el feed
      } else {
        dbType = type as PostType;
      }
    }

    const post = await prisma.scheduledPost.create({
      data: {
        userId: session.user.id,
        socialAccountId: account.id,
        platform: account.platform,
        type: dbType,
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

// DELETE /api/posts/schedule?id=postId -> elimina la publicación programada
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  // Verificar propiedad
  const post = await prisma.scheduledPost.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!post) {
    return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  }

  await prisma.scheduledPost.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}

// PATCH /api/posts/schedule -> edita la publicación programada
const patchSchema = z.object({
  id: z.string(),
  caption: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  scheduledAt: z.string(), // ISO date string
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, caption, mediaUrl, scheduledAt } = parsed.data;

  // Verificar propiedad
  const post = await prisma.scheduledPost.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!post) {
    return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  }

  const updated = await prisma.scheduledPost.update({
    where: { id },
    data: {
      caption,
      mediaUrl: mediaUrl !== undefined ? mediaUrl : undefined,
      scheduledAt: new Date(scheduledAt),
    },
  });

  return NextResponse.json({ post: updated });
}
