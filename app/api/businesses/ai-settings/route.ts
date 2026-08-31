import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/businesses/ai-settings?businessId=xxx
 * Obtiene la configuración de IA del negocio.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId requerido" }, { status: 400 });
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
    select: {
      id: true,
      name: true,
      aiPrompt: true,
      aiDMsPrompt: true,
      aiCommentsPrompt: true,
      aiTone: true,
      autoReplyDMs: true,
      autoReplyComments: true,
    },
  });

  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ settings: business });
}

/**
 * PATCH /api/businesses/ai-settings
 * Actualiza las instrucciones, tono y toggles de auto-respuesta.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { businessId, aiPrompt, aiDMsPrompt, aiCommentsPrompt, aiTone, autoReplyDMs, autoReplyComments } = body;

  if (!businessId) {
    return NextResponse.json({ error: "businessId requerido" }, { status: 400 });
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });

  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: {
      aiPrompt: aiPrompt !== undefined ? aiPrompt : undefined,
      aiDMsPrompt: aiDMsPrompt !== undefined ? aiDMsPrompt : undefined,
      aiCommentsPrompt: aiCommentsPrompt !== undefined ? aiCommentsPrompt : undefined,
      aiTone: aiTone !== undefined ? aiTone : undefined,
      autoReplyDMs: autoReplyDMs !== undefined ? Boolean(autoReplyDMs) : undefined,
      autoReplyComments: autoReplyComments !== undefined ? Boolean(autoReplyComments) : undefined,
    },
    select: {
      id: true,
      name: true,
      aiPrompt: true,
      aiDMsPrompt: true,
      aiCommentsPrompt: true,
      aiTone: true,
      autoReplyDMs: true,
      autoReplyComments: true,
    },
  });

  return NextResponse.json({ success: true, settings: updated });
}
