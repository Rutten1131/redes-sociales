import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tiktok/count?businessId=xxx
 * → Devuelve el conteo de notificaciones TikTok PENDING para mostrar el badge en el sidebar.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 });
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.tikTokNotification.count({
    where: {
      status: "PENDING",
      post: {
        socialAccount: { businessId },
        status: "PENDING_TIKTOK",
      },
    },
  });

  return NextResponse.json({ count });
}
