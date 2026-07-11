import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMetaAuthUrl } from "@/lib/integrations/meta";
import crypto from "crypto";

// GET /api/connect/meta -> redirige al usuario a Facebook para autorizar
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));
  }

  // El "state" lleva el userId firmado para verificar en el callback que
  // la respuesta corresponde al mismo usuario que inició el flujo.
  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, nonce: crypto.randomUUID() })
  ).toString("base64url");

  const authUrl = getMetaAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
