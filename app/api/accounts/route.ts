import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "Falta businessId" }, { status: 400 });

  // Verifica que el negocio sea del usuario logueado
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });
  if (!business) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const accounts = await prisma.socialAccount.findMany({
    where: { businessId },
    select: {
      id: true,
      platform: true,
      displayName: true,
      avatarUrl: true,
      externalId: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ accounts });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, businessId } = await req.json();
  if (!businessId) return NextResponse.json({ error: "Falta businessId" }, { status: 400 });

  // Verifica que el negocio sea del usuario logueado
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });
  if (!business) return NextResponse.json({ error: "Negocio no encontrado o sin permisos" }, { status: 404 });

  await prisma.socialAccount.deleteMany({
    where: { id, businessId },
  });

  return NextResponse.json({ ok: true });
}
