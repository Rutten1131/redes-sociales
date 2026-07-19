import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET /api/inbox?businessId=xxx&platform=FACEBOOK&type=DM&status=PENDING
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const businessId = searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "businessId requerido" }, { status: 400 });
  }

  // Verificar que el negocio pertenece al usuario
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });
  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  // Filtros opcionales
  const platform = searchParams.get("platform");
  const type = searchParams.get("type"); // "DM" | "COMMENT"
  const status = searchParams.get("status"); // "PENDING" | "ANSWERED" | "IGNORED"

  const items = await prisma.inboxItem.findMany({
    where: {
      socialAccount: { businessId },
      ...(platform ? { platform: platform as any } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      socialAccount: {
        select: {
          id: true,
          displayName: true,
          platform: true,
          externalId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ items });
}

// PATCH /api/inbox — actualizar estado de un InboxItem
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { itemId, status } = body;

  if (!itemId || !["PENDING", "ANSWERED", "IGNORED"].includes(status)) {
    return NextResponse.json({ error: "itemId y status válido requeridos" }, { status: 400 });
  }

  // Verificar que el item pertenece a un negocio del usuario
  const item = await prisma.inboxItem.findUnique({
    where: { id: itemId },
    include: { socialAccount: { include: { business: true } } },
  });

  if (!item || item.socialAccount.business.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const updated = await prisma.inboxItem.update({
    where: { id: itemId },
    data: { status },
  });

  return NextResponse.json({ item: updated });
}
