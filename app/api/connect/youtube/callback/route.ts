import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { exchangeYoutubeCode, getYoutubeChannel } from "@/lib/integrations/youtube";

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
    const { accessToken, refreshToken, expiresInSeconds } = await exchangeYoutubeCode(code);

    if (!refreshToken) {
      // Pasa si el usuario ya había autorizado antes sin "prompt=consent".
      // Con prompt=consent forzado en getYoutubeAuthUrl esto no debería ocurrir.
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=no_refresh_token`, appUrl)
      );
    }

    const channel = await getYoutubeChannel(accessToken);

    await prisma.socialAccount.upsert({
      where: {
        businessId_platform_externalId: {
          businessId,
          platform: "YOUTUBE",
          externalId: channel.channelId,
        },
      },
      create: {
        businessId,
        platform: "YOUTUBE",
        externalId: channel.channelId,
        displayName: channel.title,
        avatarUrl: channel.thumbnailUrl,
        accessToken: encryptToken(accessToken),
        refreshToken: encryptToken(refreshToken),
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      },
      update: {
        displayName: channel.title,
        avatarUrl: channel.thumbnailUrl,
        accessToken: encryptToken(accessToken),
        refreshToken: encryptToken(refreshToken),
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      },
    });

    return NextResponse.redirect(new URL(`${redirectBase}?success=youtube`, appUrl));
  } catch (err: any) {
    console.error("YouTube OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`${redirectBase}?error=${encodeURIComponent(err.message)}`, appUrl)
    );
  }
}
