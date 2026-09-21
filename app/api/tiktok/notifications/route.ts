import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tiktok/notifications?businessId=xxx
 * → Lista todas las notificaciones TikTok PENDING para ese negocio.
 *
 * POST /api/tiktok/notifications
 * Body: { postId: string }
 * → Marca la notificación como DONE y el post como PUBLISHED.
 */

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Falta businessId" }, { status: 400 });
  }

  // Verificar que el negocio pertenece al usuario
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });
  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const notifications = await prisma.tikTokNotification.findMany({
    where: {
      status: "PENDING",
      post: {
        socialAccount: { businessId },
        status: "PENDING_TIKTOK",
      },
    },
    include: {
      post: {
        include: {
          socialAccount: true,
          mediaItems: { orderBy: { order: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { postId } = body as { postId: string };
  if (!postId) {
    return NextResponse.json({ error: "Falta postId" }, { status: 400 });
  }

  // Verificar que el post pertenece al usuario
  const post = await prisma.scheduledPost.findFirst({
    where: { id: postId, userId: session.user.id },
  });
  if (!post) {
    return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  }

  // Marcar notificación como completada y post como publicado
  await prisma.$transaction([
    prisma.tikTokNotification.update({
      where: { postId },
      data: { status: "DONE", doneAt: new Date() },
    }),
    prisma.scheduledPost.update({
      where: { id: postId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
