import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processInboxItemWithAi } from "@/lib/ai/auto-responder";

/**
 * Cron job para procesar InboxItems PENDING que no hayan sido procesados.
 * Este cron actúa como red de seguridad en caso de que el proceso del webhook
 * haya fallado o sido cortado por Next.js.
 *
 * Frecuencia recomendada: cada 1-2 minutos.
 * Configurar en Vercel Cron Jobs o llamar manualmente para testing.
 */
export async function GET(req: NextRequest) {
  // Verificar secret de cron (Vercel o llamada manual)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron Process Inbox] Starting PENDING items processing...");

  // Obtener todos los items PENDING, ordenados por más antiguos primero
  // Limitar a 10 por ejecución para no saturar
  const pendingItems = await prisma.inboxItem.findMany({
    where: {
      status: "PENDING",
      // Solo items que tengan contenido
      content: { not: "" },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: {
      id: true,
      type: true,
      platform: true,
      content: true,
      createdAt: true,
    },
  });

  if (pendingItems.length === 0) {
    console.log("[Cron Process Inbox] No PENDING items found.");
    return NextResponse.json({ processed: 0, message: "No pending items" });
  }

  console.log(`[Cron Process Inbox] Found ${pendingItems.length} PENDING items`);

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const item of pendingItems) {
    try {
      console.log(`[Cron Process Inbox] Processing ${item.type} item ${item.id} (${item.platform})`);
      await processInboxItemWithAi(item.id);
      results.push({ id: item.id, success: true });
    } catch (err: any) {
      console.error(`[Cron Process Inbox] Error processing ${item.id}:`, err.message);
      results.push({ id: item.id, success: false, error: err.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`[Cron Process Inbox] Done. Success: ${successCount}, Failed: ${failCount}`);

  return NextResponse.json({
    processed: pendingItems.length,
    success: successCount,
    failed: failCount,
    results,
  });
}
