import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const businesses = await prisma.business.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { socialAccounts: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { name } = await req.json();
  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const business = await prisma.business.create({
    data: { userId: session.user.id, name: name.trim() },
  });
  return NextResponse.json({ business });
}
