import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getYoutubeAuthUrl } from "@/lib/integrations/youtube";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  const appUrl = process.env.NEXTAUTH_URL!;
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", appUrl));

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.redirect(new URL("/dashboard", appUrl));

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });
  if (!business) return NextResponse.redirect(new URL("/dashboard", appUrl));

  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, businessId, nonce: crypto.randomUUID() })
  ).toString("base64url");

  return NextResponse.redirect(getYoutubeAuthUrl(state));
}
