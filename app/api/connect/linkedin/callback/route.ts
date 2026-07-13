import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { exchangeLinkedInCode, getLinkedInProfile } from "@/lib/integrations/linkedin";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXTAUTH_URL!;

  let userId: string | undefined;
  let businessId: string | undefined;

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      userId = decoded.userId;
      businessId = decoded.businessId;
    } catch {
      // Ignorar, se manejará abajo
    }
  }

  const redirectBase = businessId ? `/dashboard/${businessId}/connect` : "/dashboard";

  if (error) {
    return NextResponse.redirect(
      new URL(`${redirectBase}?error=${encodeURIComponent(error)}`, appUrl)
    );
  }
  if (!code || !state || !userId || !businessId) {
    return NextResponse.redirect(new URL(`${redirectBase}?error=missing_parameters`, appUrl));
  }

  try {
    const { accessToken, expiresInSeconds } = await exchangeLinkedInCode(code);
    const profile = await getLinkedInProfile(accessToken);

    await prisma.socialAccount.upsert({
      where: {
        businessId_platform_externalId: {
          businessId,
          platform: "LINKEDIN",
          externalId: profile.id,
        },
      },
      create: {
        businessId,
        platform: "LINKEDIN",
        externalId: profile.id,
        displayName: profile.name,
        avatarUrl: profile.avatarUrl,
        accessToken: encryptToken(accessToken),
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      },
      update: {
        displayName: profile.name,
        avatarUrl: profile.avatarUrl,
        accessToken: encryptToken(accessToken),
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      },
    });

    return NextResponse.redirect(new URL(`${redirectBase}?success=linkedin`, appUrl));
  } catch (err: any) {
    console.error("LinkedIn OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`${redirectBase}?error=${encodeURIComponent(err.message)}`, appUrl)
    );
  }
}
