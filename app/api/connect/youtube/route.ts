import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getYoutubeAuthUrl } from "@/lib/integrations/youtube";
import crypto from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));
  }

  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, nonce: crypto.randomUUID() })
  ).toString("base64url");

  return NextResponse.redirect(getYoutubeAuthUrl(state));
}
