import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const DEFAULT_COPY_PROMPTS = {
  INSTAGRAM: `### ESTRATEGIA INSTAGRAM (Máx 2,200 caracteres):
- Primera línea: Gancho ultra-atractivo o pregunta intrigante que detenga el scroll.
- Cuerpo: Conciso, dinámico, con espacios limpios entre párrafos y emojis bien colocados.
- Final: Llamado a la acción claro (ej: "Comenta INFO para enviarte detalles", "Escríbenos al DM").
- Bloque final: 5 a 10 hashtags estratégicos relevantes.`,

  FACEBOOK: `### ESTRATEGIA FACEBOOK (Máx 2,000 caracteres recomendados):
- Tono: Cercano, conversacional, empático y comunitario.
- Cuerpo: Párrafos fáciles de leer que cuenten la historia o el beneficio directo.
- Final: Invita a comentar, compartir o enviar un mensaje directo / WhatsApp con enlace claro.`,

  LINKEDIN: `### ESTRATEGIA LINKEDIN (Límite post 3,000 caracteres | Título de video máx 100 caracteres):
- IMPORTANTE: La primera línea debe ser un TÍTULO/GANCHO de MENOS DE 100 CARACTERES (para evitar errores en la API de LinkedIn si es video).
- Tono: Profesional, reflexivo, enfocado en liderazgo, negocios, B2B y aprendizaje de alto valor.
- Estructura: Gancho inicial corto -> Problema / Contexto -> Solución o lección aprendida -> Pregunta de debate o invitación al networking.
- Formato: Frases cortas con doble salto de línea para facilitar lectura en móvil. Sin exceso de emojis. Máximo 3 hashtags profesionales.`,

  YOUTUBE: `### ESTRATEGIA YOUTUBE (REGLA ESTRICTA DE CARACTERES):
- Línea 1 (TÍTULO OBLIGATORIO): EXACTAMENTE MENOS DE 90 CARACTERES. YouTube rechaza terminantemente títulos de más de 100 caracteres. Debe ser atractivo, conciso y con gancho SEO.
- A partir de la línea 2 (DESCRIPCIÓN):
  * Resumen del contenido en 2 oraciones.
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

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    let rawContent = "";
    let lastError: Error | null = null;

    // 1. Intentar con DeepSeek como principal (consumo mínimo optimizado)
    if (deepseekKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${deepseekKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 1200, // Consumo optimizado y económico
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (dsRes.ok) {
          const dsData = await dsRes.json();
          rawContent = dsData.choices?.[0]?.message?.content?.trim() || "";
          if (rawContent) {
            console.log("[generate-copys] Success with DeepSeek (deepseek-chat)");
          }
        } else {
          const errText = await dsRes.text().catch(() => "");
          console.warn(`[generate-copys] DeepSeek failed (${dsRes.status}): ${errText.substring(0, 150)}`);
          lastError = new Error(`DeepSeek (${dsRes.status})`);
        }
      } catch (dsErr) {
        console.warn("[generate-copys] DeepSeek error, switching to Groq fallback:", dsErr);
      }
    }

    // 2. Si DeepSeek no respondió, usar Groq como respaldo
    if (!rawContent && groqKey) {
      const groqModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];
      for (const model of groqModels) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000);

          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqKey}`,
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
              max_tokens: 1200,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (groqRes.ok) {
            const data = await groqRes.json();
            rawContent = data.choices?.[0]?.message?.content?.trim() || "";
            if (rawContent) {
              console.log(`[generate-copys] Success with Groq fallback: ${model}`);
              break;
            }
          }
        } catch (groqErr) {
          console.warn(`[generate-copys] Groq ${model} failed:`, groqErr);
        }
      }
    }

    if (!rawContent) {
      const errorMessage = lastError?.message || "No se pudo obtener respuesta de ningún modelo de IA.";
      console.error("[generate-copys] All models failed:", errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    let copysResult: Record<string, string> = {};

    try {
      copysResult = JSON.parse(rawContent);
    } catch {
      // Si la IA no devolvió JSON válido, usar el texto raw para todas las plataformas
      copysResult = {
        INSTAGRAM: rawContent || generalContext,
        FACEBOOK: rawContent || generalContext,
        LINKEDIN: rawContent || generalContext,
        YOUTUBE: rawContent || generalContext,
      };
    }

    return NextResponse.json({ copys: copysResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al generar copys con IA";
    console.error("[generate-copys error]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
