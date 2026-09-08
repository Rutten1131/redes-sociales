import { NextRequest, NextResponse } from "next/server";
import { processInboxItemWithAi } from "@/lib/ai/auto-responder";

/**
 * Endpoint interno para procesar un InboxItem con IA.
 * Es llamado por el webhook de Meta inmediatamente después de guardar el item.
 * Al ser una solicitud HTTP real, Next.js no la corta como haría con un fire-and-forget.
 *
 * Protegido con un secret interno para evitar llamadas externas.
 */
export async function POST(req: NextRequest) {
  // Verificar secret interno
  const authHeader = req.headers.get("x-internal-secret");
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!internalSecret || authHeader !== internalSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let inboxItemId: string;
  try {
    const body = await req.json();
    inboxItemId = body.inboxItemId;
    if (!inboxItemId) throw new Error("Missing inboxItemId");
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    console.log(`[Internal Process Inbox] Processing item: ${inboxItemId}`);
    const result = await processInboxItemWithAi(inboxItemId);
    console.log(`[Internal Process Inbox] Done for ${inboxItemId}:`, result);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error(`[Internal Process Inbox] Error for ${inboxItemId}:`, err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
