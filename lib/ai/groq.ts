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
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  amable_profesional: "Amable, profesional, educado y resolutivo.",
  cercano_juvenil: "Cálido, dinámico, amigable y cercano, usando emojis con naturalidad.",
  ventas_persuasivo: "Enfocado en ventas y conversión, persuasivo, destacando beneficios e invitando a la acción.",
  autoridad_ejecutiva: "Elegante, directo, de alto nivel y con autoridad técnica/profesional.",
};

/**
 * Genera una respuesta contextual inteligente con Groq
 */
export async function generateAiReply(options: GenerateReplyOptions): Promise<string> {
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
  } = options;

  const toneInstruction = TONE_DESCRIPTIONS[aiTone] || TONE_DESCRIPTIONS.amable_profesional;
  const isComment = type === "COMMENT";

  // Seleccionar las instrucciones específicas para Comentarios o DMs
  const specificInstructions = isComment
    ? (aiCommentsPrompt && aiCommentsPrompt.trim() ? aiCommentsPrompt : aiPrompt)
    : (aiDMsPrompt && aiDMsPrompt.trim() ? aiDMsPrompt : aiPrompt);

  let systemInstructions = "";

  if (isComment) {
    systemInstructions = `Eres el asistente oficial de redes sociales para "${businessName}".
Estás respondiendo un **COMENTARIO PÚBLICO** en ${platform}.

### 🎯 OBJETIVO ESTRATÉGICO DE LOS COMENTARIOS:
Tu meta principal es dar una respuesta pública cordial, generar confianza y **LLEVAR AL USUARIO AL MENSAJE DIRECTO (DM)** para darle atención personalizada, precios detallados o catálogo.

### 🎭 TONO DE VOZ:
${toneInstruction}

### 📋 INSTRUCCIONES ESPECÍFICAS PARA COMENTARIOS:
${specificInstructions && specificInstructions.trim() ? specificInstructions : "Agradece el comentario, responde brevemente y dile que le dejaremos más detalles por mensaje privado."}

### ⚠️ REGLAS ESTRICTAS PARA COMENTARIOS:
1. Sé conciso y dinámico (máximo 1 a 2 frases).
2. Agrega una invitación clara a continuar por privado (ej. "¡Hola! Te acabamos de enviar un DM con todos los detalles 📩" o "Escríbenos al privado para asesorarte personalmente ✨").
3. No expongas datos privados ni discutas precios complejos en público.
4. Responde en el mismo idioma del usuario (Español por defecto).`;
  } else {
    systemInstructions = `Eres el asistente personal de atención al cliente y ventas por chat para "${businessName}".
Estás respondiendo un **MENSAJE DIRECTO PRIVADO (DM)** en ${platform}.

### 🎯 OBJETIVO ESTRATÉGICO DE LOS DMs:
Tu meta es ofrecer una atención personalizada, cercana y cálida uno a uno. Responde las dudas del cliente con claridad, asesóralo y guíalo hacia el cierre de venta, agendamiento o contacto por WhatsApp.

### 🎭 TONO DE VOZ:
${toneInstruction}

### 📋 INSTRUCCIONES ESPECÍFICAS PARA DMs (VENTAS Y ATENCIÓN):
${specificInstructions && specificInstructions.trim() ? specificInstructions : "Atiende con mucha calidez, resuelve las dudas del cliente y ofrécele ayuda para dar el siguiente paso."}

### ⚠️ REGLAS ESTRICTAS PARA DMs:
1. Trato personal y conversacional (responde como un humano experto del equipo de ${businessName}).
2. Si el usuario pide cotización o contacto directo, facilita los datos de WhatsApp o enlace indicados en tus instrucciones.
3. Resuelve la duda de forma clara y termina con una pregunta abierta para mantener la conversación activa (ej. "¿Te gustaría que te agende una asesoría?" o "¿En qué fecha lo necesitas?").
4. Nunca inventes información que no esté en tus instrucciones.`;
  }

  const userMessage = fromName 
    ? `El usuario "${fromName}" te ha escrito el siguiente ${isComment ? "comentario público" : "mensaje directo (DM)"}:\n"${content}"`
    : `El usuario te ha escrito el siguiente ${isComment ? "comentario público" : "mensaje directo (DM)"}:\n"${content}"`;

  const modelsToTry = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile",
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
          messages: [
            { role: "system", content: systemInstructions },
            { role: "user", content: userMessage },
          ],
          temperature: isComment ? 0.5 : 0.7,
          max_tokens: isComment ? 120 : 350,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        lastError = new Error(`Groq API (${model}) error ${response.status}: ${errBody}`);
        continue;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim();

      if (reply) {
        return reply;
      }
    } catch (err: any) {
      lastError = err;
      continue;
    }
  }

  console.error("[Groq AI Error]:", lastError);
  throw lastError || new Error("No se pudo generar respuesta con los modelos de Groq disponibles.");
}
