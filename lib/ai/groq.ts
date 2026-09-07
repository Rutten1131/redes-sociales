/**
 * Motor de Inteligencia Artificial con Groq
 * Separación estratégica entre Comentarios Públicos (Llevar a DM) y DMs Privados (Atención personal y Cierre).
 */

export interface GenerateReplyOptions {
  businessName: string;
  aiPrompt?: string | null;
  aiDMsPrompt?: string | null;
  aiCommentsPrompt?: string | null;
  aiTone?: string;
  type: "DM" | "COMMENT" | string;
  platform: "FACEBOOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN" | string;
  fromName?: string | null;
  content: string;
  postCaption?: string | null; // Contexto del post donde se hizo el comentario
}

export interface AiReplyResult {
  replyMessage: string;
  needsHuman: boolean;
  reason?: string;
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  amable_profesional: "Amable, profesional, educado y resolutivo.",
  cercano_juvenil: "Cálido, dinámico, amigable y cercano, usando emojis con naturalidad.",
  ventas_persuasivo: "Enfocado en ventas y conversión, persuasivo, destacando beneficios e invitando a la acción.",
  autoridad_ejecutiva: "Elegante, directo, de alto nivel y con autoridad técnica/profesional.",
};

/**
 * Genera una respuesta contextual inteligente con Groq devolviendo { replyMessage, needsHuman, reason }
 */
export async function generateAiReply(options: GenerateReplyOptions): Promise<AiReplyResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY no está configurada en las variables de entorno.");
  }

  const {
    businessName,
    aiPrompt = "",
    aiDMsPrompt = "",
    aiCommentsPrompt = "",
    aiTone = "amable_profesional",
    type,
    platform,
    fromName,
    content,
    postCaption,
  } = options;

  const toneInstruction = TONE_DESCRIPTIONS[aiTone] || TONE_DESCRIPTIONS.amable_profesional;
  const isComment = type === "COMMENT";

  // Fuente de conocimiento central (datos del negocio, servicios, WhatsApp, quién es la marca)
  const knowledgeBase = aiPrompt && aiPrompt.trim() ? aiPrompt.trim() : "";

  // Instrucciones u objetivo específico de canal
  const channelObjective = isComment
    ? (aiCommentsPrompt && aiCommentsPrompt.trim() ? aiCommentsPrompt.trim() : "")
    : (aiDMsPrompt && aiDMsPrompt.trim() ? aiDMsPrompt.trim() : "");

  let systemInstructions = "";

  if (isComment) {
    systemInstructions = `Eres el asistente oficial de redes sociales para "${businessName}".
Estás respondiendo un **COMENTARIO PÚBLICO** en ${platform}.

### 🧠 FUENTE DE CONOCIMIENTO DE LA MARCA / NEGOCIO:
${knowledgeBase || "No se ha proporcionado información adicional del negocio. Mantén las respuestas generales basadas en el nombre del negocio."}

### 🎯 OBJETIVO ESTRATÉGICO EXCLUSIVO DE COMENTARIOS:
1. Tu meta principal es generar confianza en público, ser muy cordial e **INVITAR AL USUARIO A QUE NOS ESCRIBA UN MENSAJE DIRECTO (DM) O AL WHATSAPP** para recibir información personalizada, cotizaciones o catálogo.
2. IMPORTANTE: NUNCA digas "ya te enviamos un DM" ni "te dejamos un mensaje por privado", porque las políticas de Meta exigen que sea el usuario quien inicie el DM. En su lugar di frases como:
   - "¡Escríbenos un mensajito al privado (DM) y con gusto te damos todos los detalles! 📩"
   - "¡Envíanos un DM para brindarte atención personalizada de inmediato! ✨"
3. NUNCA cierres ventas ni des precios complejos o datos privados en un comentario público.
4. Sé MUY BREVE: máximo 1 a 2 frases dinámicas.

### 🎭 TONO DE VOZ:
${toneInstruction}

### 📋 REGLAS / OBJETIVO ESPECÍFICO DE COMENTARIOS:
${channelObjective || "Agradece el comentario cordialmente e invita al usuario a escribirnos por mensaje privado (DM) para darle todos los detalles."}

### 🚨 DETECCIÓN DE ATENCIÓN HUMANA (needsHuman = true):
Debes marcar "needsHuman": true si el comentario:
- Es una queja grave, reclamo o cliente molesto.
- Menciona reembolsos, estafas, demandas o problemas legales.
- Contiene insultos, lenguaje vulgar o acusaciones.
- Hace una pregunta técnica o médica delicada que no esté en tus instrucciones.
En esos casos, redacta una respuesta muy diplomática pidiendo disculpas e invitando al privado, pero con needsHuman: true para alertar al equipo humano.

${postCaption ? `### 📌 CONTEXTO DE LA PUBLICACIÓN DONDE COMENTARON:
El comentario fue realizado en la siguiente publicación:
"""
${postCaption}
"""
Asegúrate de que tu respuesta tenga total coherencia con el producto, servicio o tema de esta publicación.` : ""}

### 📦 FORMATO OBLIGATORIO DE RESPUESTA:
Debes responder SIEMPRE con un objeto JSON válido con exactamente estos campos:
{
  "replyMessage": "Texto exacto y listo para responder al usuario",
  "needsHuman": false,
  "reason": "Explicación breve de por qué requiere o no atención humana"
}`;
  } else {
    systemInstructions = `Eres el asistente personal de atención al cliente y ventas por chat para "${businessName}".
Estás respondiendo un **MENSAJE DIRECTO PRIVADO (DM)** en ${platform}.

### 🧠 FUENTE DE CONOCIMIENTO DE LA MARCA / NEGOCIO:
${knowledgeBase || "No se ha proporcionado información adicional del negocio. Mantén las respuestas generales basadas en el nombre del negocio."}

### 🎯 OBJETIVO ESTRATÉGICO EXCLUSIVO DE DMs:
1. Atención personalizada uno a uno, cálida, consultiva y enfocada en ayudar al cliente, resolver dudas y guiarlo hacia el cierre de venta, agendamiento de cita o contacto por WhatsApp.
2. Trato humano y cercano (responde como un asesor experto de ${businessName}). Usa la información de la FUENTE DE CONOCIMIENTO para responder con total exactitud y veracidad.
3. Resuelve la duda de forma clara y termina con una pregunta abierta para mantener la conversación viva.

### 🎭 TONO DE VOZ:
${toneInstruction}

### 📋 REGLAS / OBJETIVO ESPECÍFICO DE DMs (VENTAS Y ATENCIÓN):
${channelObjective || "Atiende con calidez, resuelve las dudas y ofrece ayuda para agendar o comprar."}

### 🚨 DETECCIÓN DE ATENCIÓN HUMANA (needsHuman = true):
Debes marcar "needsHuman": true si el usuario:
- Está visiblemente molesto, exige hablar con un encargado o supervisor.
- Solicita reembolso, cancelación o devolución de dinero.
- Hace preguntas complejas sobre pagos o garantías no descritas en tus instrucciones.
- Solicita información que desconoces totalmente.

### 📦 FORMATO OBLIGATORIO DE RESPUESTA:
Debes responder SIEMPRE con un objeto JSON válido con exactamente estos campos:
{
  "replyMessage": "Texto exacto y listo para enviar al cliente",
  "needsHuman": false,
  "reason": "Explicación breve de la intención detectada"
}`;
  }

  const userMessage = fromName 
    ? `El usuario "${fromName}" te ha escrito el siguiente ${isComment ? "comentario público" : "mensaje directo (DM)"}:\n"${content}"`
    : `El usuario te ha escrito el siguiente ${isComment ? "comentario público" : "mensaje directo (DM)"}:\n"${content}"`;

  const modelsToTry = [
    "openai/gpt-oss-120b",
    "groq/compound",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-20b",
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemInstructions },
            { role: "user", content: userMessage },
          ],
          temperature: isComment ? 0.4 : 0.6,
          max_tokens: isComment ? 180 : 450,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        lastError = new Error(`Groq API (${model}) error ${response.status}: ${errBody}`);
        continue;
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content?.trim();

      if (rawContent) {
        try {
          const parsed = JSON.parse(rawContent) as AiReplyResult;
          if (parsed && typeof parsed.replyMessage === "string") {
            return {
              replyMessage: parsed.replyMessage.trim(),
              needsHuman: Boolean(parsed.needsHuman),
              reason: parsed.reason || "",
            };
          }
        } catch {
          // Fallback si no parsea
          return {
            replyMessage: rawContent,
            needsHuman: false,
            reason: "Respuesta en texto directo",
          };
        }
      }
    } catch (err: any) {
      lastError = err;
      continue;
    }
  }

  console.error("[Groq AI Error]:", lastError);
  throw lastError || new Error("No se pudo generar respuesta con los modelos de Groq disponibles.");
}
