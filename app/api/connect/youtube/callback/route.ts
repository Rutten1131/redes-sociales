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

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/connect?error=${encodeURIComponent(error)}`, appUrl)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard/connect?error=missing_code", appUrl));
  }

  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect(new URL("/dashboard/connect?error=invalid_state", appUrl));
  }

  try {
    const { accessToken, refreshToken, expiresInSeconds } = await exchangeYoutubeCode(code);

    if (!refreshToken) {
      // Pasa si el usuario ya había autorizado antes sin "prompt=consent".
      // Con prompt=consent forzado en getYoutubeAuthUrl esto no debería ocurrir.
      return NextResponse.redirect(
        new URL("/dashboard/connect?error=no_refresh_token", appUrl)
      );
    }

    const channel = await getYoutubeChannel(accessToken);

    await prisma.socialAccount.upsert({
      where: {
        userId_platform_externalId: {
          userId,
          platform: "YOUTUBE",
          externalId: channel.channelId,
        },
      },
      create: {
        userId,
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

    return NextResponse.redirect(new URL("/dashboard/connect?success=youtube", appUrl));
  } catch (err: any) {
    console.error("YouTube OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/dashboard/connect?error=${encodeURIComponent(err.message)}`, appUrl)
    );
  }
}
