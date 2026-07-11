import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  socialAccountId: z.string(),
  type: z.enum(["FEED_POST", "REEL", "STORY", "VIDEO", "SHORT"]),
  caption: z.string().optional(),
  mediaUrl: z.string().url(),
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

  const { socialAccountId, type, caption, mediaUrl, thumbnailUrl, scheduledAt } = parsed.data;

  // Verificar que la cuenta social pertenece al usuario autenticado
  const account = await prisma.socialAccount.findFirst({
    where: { id: socialAccountId, userId: session.user.id },
  });
  if (!account) {
    return NextResponse.json({ error: "Cuenta social no encontrada" }, { status: 404 });
  }

  const post = await prisma.scheduledPost.create({
    data: {
      userId: session.user.id,
      socialAccountId,
      platform: account.platform,
      type,
      caption,
      mediaUrl,
      thumbnailUrl,
      scheduledAt: new Date(scheduledAt),
      status: "SCHEDULED",
    },
  });

  return NextResponse.json({ post });
}

// GET /api/posts/schedule -> lista los posts programados del usuario
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const posts = await prisma.scheduledPost.findMany({
    where: { userId: session.user.id },
    include: { socialAccount: true },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json({ posts });
}
