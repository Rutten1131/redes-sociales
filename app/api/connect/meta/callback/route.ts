import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  discoverPages,
} from "@/lib/integrations/meta";

// GET /api/connect/meta/callback?code=...&state=...
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
    // 1. Intercambiar code por token corto
    const shortLivedToken = await exchangeCodeForToken(code);

    // 2. Convertir a token de larga duración (60 días)
    const { accessToken: userLongLivedToken } = await getLongLivedToken(shortLivedToken);

    // 3. Descubrir páginas de Facebook + cuentas de Instagram vinculadas
    const pages = await discoverPages(userLongLivedToken);

    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL("/dashboard/connect?error=no_pages_found", appUrl)
      );
    }

    // 4. Guardar cada página como cuenta de Facebook, y su IG vinculado si existe
    for (const page of pages) {
      await prisma.socialAccount.upsert({
        where: {
          userId_platform_externalId: {
            userId,
            platform: "FACEBOOK",
            externalId: page.pageId,
          },
        },
        create: {
          userId,
          platform: "FACEBOOK",
          externalId: page.pageId,
          displayName: page.pageName,
          accessToken: encryptToken(page.pageAccessToken),
        },
        update: {
          displayName: page.pageName,
          accessToken: encryptToken(page.pageAccessToken),
        },
      });

      if (page.instagramBusinessAccountId) {
        await prisma.socialAccount.upsert({
          where: {
            userId_platform_externalId: {
              userId,
              platform: "INSTAGRAM",
              externalId: page.instagramBusinessAccountId,
            },
          },
          create: {
            userId,
            platform: "INSTAGRAM",
            externalId: page.instagramBusinessAccountId,
            displayName: page.instagramUsername ?? page.pageName,
            // IG usa el mismo Page Access Token para publicar vía Graph API
            accessToken: encryptToken(page.pageAccessToken),
          },
          update: {
            displayName: page.instagramUsername ?? page.pageName,
            accessToken: encryptToken(page.pageAccessToken),
          },
        });
      }
    }

    return NextResponse.redirect(new URL("/dashboard/connect?success=meta", appUrl));
  } catch (err: any) {
    console.error("Meta OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/dashboard/connect?error=${encodeURIComponent(err.message)}`, appUrl)
    );
  }
}
