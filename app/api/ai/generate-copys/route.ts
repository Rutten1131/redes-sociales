import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const DEFAULT_COPY_PROMPTS = {
  INSTAGRAM: `### ESTRATEGIA INSTAGRAM:
- Primera línea: Gancho ultra-atractivo o pregunta intrigante que detenga el scroll.
- Cuerpo: Conciso, dinámico, con espacios limpios entre párrafos y emojis bien colocados.
- Final: Llamado a la acción claro (ej: "Comenta INFO para enviarte detalles", "Escríbenos al DM").
- Bloque final: 5 a 10 hashtags estratégicos relevantes.`,

  FACEBOOK: `### ESTRATEGIA FACEBOOK:
- Tono: Cercano, conversacional, empático y comunitario.
- Cuerpo: Párrafos fáciles de leer que cuenten la historia o el beneficio directo.
- Final: Invita a comentar, compartir o enviar un mensaje directo / WhatsApp con enlace claro.`,

  LINKEDIN: `### ESTRATEGIA LINKEDIN:
- Tono: Profesional, reflexivo, enfocado en liderazgo, negocios, B2B y aprendizaje de alto valor.
- Estructura: Gancho inicial fuerte -> Problema / Contexto -> Solución o lección aprendida -> Pregunta de debate o invitación al networking.
- Formato: Frases cortas con doble salto de línea para facilitar lectura en móvil. Sin exceso de emojis. Máximo 3 hashtags profesionales.`,

  YOUTUBE: `### ESTRATEGIA YOUTUBE (Título y Descripción SEO):
- Línea 1 (TÍTULO): Título llamativo optimizado para búsquedas y CTR (máximo 60-70 caracteres).
- DESCRIPCIÓN:
  * Resumen atractivo del contenido del video en 2 oraciones.
  * Puntos clave tratados (bullets).
  * Llamado a suscribirse y enlaces de contacto (WhatsApp / Web).
  * 3 a 5 hashtags (#Shorts si aplica).`,
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { businessId, generalContext, platforms = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "YOUTUBE"], customPrompts = {} } = body;

  if (!businessId || !generalContext?.trim()) {
    return NextResponse.json({ error: "businessId y generalContext son requeridos" }, { status: 400 });
  }

  try {
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    // Prompts específicos para cada plataforma (combinando los guardados o los por defecto)
    const promptIG = customPrompts.INSTAGRAM || business.copyPromptInstagram || DEFAULT_COPY_PROMPTS.INSTAGRAM;
    const promptFB = customPrompts.FACEBOOK || business.copyPromptFacebook || DEFAULT_COPY_PROMPTS.FACEBOOK;
    const promptLI = customPrompts.LINKEDIN || business.copyPromptLinkedIn || DEFAULT_COPY_PROMPTS.LINKEDIN;
    const promptYT = customPrompts.YOUTUBE || business.copyPromptYouTube || DEFAULT_COPY_PROMPTS.YOUTUBE;

    const knowledgeBase = business.aiPrompt?.trim() || "";

    const systemPrompt = `Eres un estratega experto de contenido y copywriter senior para redes sociales para la marca "${business.name}".
Tu misión es redactar textos (copys) optimizados para cada red social a partir del contexto general de una publicación.

### 🧠 FUENTE DE CONOCIMIENTO DE LA MARCA:
${knowledgeBase || `Nombre: ${business.name}`}

### 🎯 INSTRUCCIONES ESPECÍFICAS DE ESTILO POR RED:
${platforms.includes("INSTAGRAM") ? `\n[INSTAGRAM]\n${promptIG}` : ""}
${platforms.includes("FACEBOOK") ? `\n[FACEBOOK]\n${promptFB}` : ""}
${platforms.includes("LINKEDIN") ? `\n[LINKEDIN]\n${promptLI}` : ""}
${platforms.includes("YOUTUBE") ? `\n[YOUTUBE]\n${promptYT}` : ""}

### 📦 FORMATO OBLIGATORIO DE RESPUESTA:
Debes responder SIEMPRE con un objeto JSON válido donde las claves sean exactamente las plataformas solicitadas (${platforms.join(", ")}) y los valores sean los copys completos listos para publicar:
{
  ${platforms.map((p: string) => `"${p}": "Texto completo adaptado para ${p}"`).join(",\n  ")}
}`;

    const userPrompt = `Aquí está el contexto de la publicación que debemos lanzar:
"""
${generalContext.trim()}
"""
Por favor redacta el copy adaptado para cada una de las siguientes plataformas: ${platforms.join(", ")}.`;

    const modelsToTry = [
      "openai/gpt-oss-120b",
      "groq/compound",
      "qwen/qwen3.6-27b",
      "openai/gpt-oss-20b",
    ];

    let lastError = null;
    let rawContent = "";

    for (const model of modelsToTry) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 1800,
          }),
        });

        if (!groqRes.ok) {
          const errText = await groqRes.text();
          lastError = new Error(`Error de Groq API (${model}): ${errText}`);
          continue;
        }

        const data = await groqRes.json();
        rawContent = data.choices?.[0]?.message?.content?.trim() || "";
        if (rawContent) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!rawContent) {
      throw lastError || new Error("No se pudo obtener respuesta de ningún modelo de IA.");
    }
    let copysResult: Record<string, string> = {};

    try {
      copysResult = JSON.parse(rawContent);
    } catch {
      copysResult = {
        INSTAGRAM: rawContent || generalContext,
        FACEBOOK: rawContent || generalContext,
        LINKEDIN: rawContent || generalContext,
        YOUTUBE: rawContent || generalContext,
      };
    }

    return NextResponse.json({ copys: copysResult });
  } catch (error: any) {
    console.error("[generate-copys error]:", error);
    return NextResponse.json({ error: error.message || "Error al generar copys con IA" }, { status: 500 });
  }
}
