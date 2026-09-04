/**
 * Despacha respuestas de inbox (comentarios y DMs) a través del
 * webhook de Make.com "Responder Comentarios y DMs (Meta e IG)".
 *
 * Esto evita la necesidad de Meta App Review, ya que Make usa su propia
 * app verificada para interactuar con la Graph API.
 *
 * El escenario de Make recibe estos campos y enruta al módulo correcto:
 * - platform: "FACEBOOK" | "INSTAGRAM"
 * - type: "COMMENT" | "DM"
 * - externalId: ID del comentario/conversación
 * - fromExternalId: ID del usuario al que responder (para DMs)
 * - replyMessage: Texto de la respuesta
 */

export interface MakeInboxReplyPayload {
  platform: string;   // "FACEBOOK" | "INSTAGRAM"
  type: string;       // "COMMENT" | "DM"
  externalId: string;
  fromExternalId: string;
  replyMessage: string;
  accessToken?: string;
  pageAccessToken?: string;
}

/**
 * Envía la respuesta al webhook de Make para que este la despache
 * al módulo correcto (FB Comment, FB DM, IG Reply, IG DM).
 */
export async function dispatchReplyViaMake(
  payload: MakeInboxReplyPayload
): Promise<void> {
  const webhookUrl = process.env.MAKE_INBOX_REPLY_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error(
      "MAKE_INBOX_REPLY_WEBHOOK_URL no está configurada en las variables de entorno."
    );
  }

  console.log(
    `[Make Inbox] Despachando respuesta vía Make:`,
    JSON.stringify({
      platform: payload.platform,
      type: payload.type,
      externalId: payload.externalId,
    })
  );

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Make Inbox] Error de Make:`, errorText);
    throw new Error(
      `Error despachando respuesta vía Make (${res.status}): ${errorText}`
    );
  }

  const responseText = await res.text();
  console.log(`[Make Inbox] Respuesta de Make:`, responseText);
}
