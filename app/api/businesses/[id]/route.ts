import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  // Verificar que el negocio pertenece al usuario logueado
  const business = await prisma.business.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  // No permitir borrar si es el único negocio restante
  const count = await prisma.business.count({
    where: { userId: session.user.id },
  });
  if (count <= 1) {
    return NextResponse.json(
      { error: "No puedes eliminar tu único negocio" },
      { status: 400 }
    );
  }

  try {
    // Eliminar negocio (la relación onDelete: Cascade borra automáticamente socialAccounts, etc.)
    await prisma.business.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error eliminando negocio:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el negocio" },
      { status: 500 }
    );
  }
}
