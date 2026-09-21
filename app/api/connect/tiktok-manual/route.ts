import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { encryptToken } from "@/lib/crypto";

const schema = z.object({
  businessId: z.string(),
  displayName: z.string().min(1, "Ingresa el nombre de usuario de TikTok"),
  profileUrl: z.string().optional(),
});

/**
 * POST /api/connect/tiktok-manual
 * Registra una cuenta TikTok de forma manual (sin OAuth).
 * No requiere tokens ni App Review — solo el nombre de la cuenta para mostrar en UI.
 */
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

  const { businessId, displayName, profileUrl } = parsed.data;

  // Verificar que el negocio pertenece al usuario
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });
  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  // Usar el nombre como externalId (sin token real, encriptamos un placeholder)
  const normalizedName = displayName.replace(/^@/, "").trim().toLowerCase();

  // Evitar duplicados
  const existing = await prisma.socialAccount.findFirst({
    where: { businessId, platform: "TIKTOK", externalId: normalizedName },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Ya tienes una cuenta TikTok "@${normalizedName}" conectada.` },
      { status: 409 }
    );
  }

  const account = await prisma.socialAccount.create({
    data: {
      businessId,
      platform: "TIKTOK",
      externalId: normalizedName,
      displayName: `@${normalizedName}`,
      avatarUrl: profileUrl
        ? `https://www.tiktok.com/@${normalizedName}`
        : null,
      // Guardamos un placeholder en el token (no se usa para publicar)
      accessToken: encryptToken("tiktok-manual-no-token"),
    },
  });

  return NextResponse.json({ account });
}
