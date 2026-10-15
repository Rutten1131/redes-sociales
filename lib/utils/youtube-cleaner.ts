/**
 * Utilidades para parsear y desinfectar el texto de publicaciones dirigidas a YouTube.
 * 
 * Problema resuelto:
 * Frecuentemente los textos provienen de plantillas o IAs con formatos como:
 *   "TÍTULO: Cómo vender en una feria"
 *   "TÍTULOS ALTERNATIVOS:\n- Opción 1\n- Opción 2"
 *   "DESCRIPCIÓN: Tres pasos simples..."
 * 
 * Esta función:
 * 1. Extrae el título limpio (remueve "TÍTULO:", "TITULO:", "Título:", etc.).
 * 2. Elimina bloques internos que no deben ir en el video público (ej: "TÍTULOS ALTERNATIVOS: ...").
 * 3. Limpia la descripción (remueve etiquetas como "DESCRIPCIÓN:", "DESCRIPCION:", etc.).
 * 4. Si el texto no tiene etiquetas, funciona de forma transparente: la primera línea es el título y el resto es la descripción.
 */

export interface ParsedYoutubeContent {
  title: string;
  description: string;
  tags: string[];
}

function cleanFormatting(str: string): string {
  let s = str.trim();
  // Quitar prefijos y sufijos de markdown como **, *, __, _, etc.
  s = s.replace(/^[\*_~`#]+\s*/, "").replace(/\s*[\*_~`#]+$/, "");
  // Quitar comillas tipográficas o estándar envolventes
  s = s.replace(/^["'«»“”]+\s*/, "").replace(/\s*["'«»“”]+$/, "");
  // Quitar dobles asteriscos residuales
  s = s.replace(/^[\*_~`#]+\s*/, "").replace(/\s*[\*_~`#]+$/, "");
  return s.trim();
}

export function parseYoutubeContent(rawCaption?: string | null): ParsedYoutubeContent {
  const fullText = (rawCaption || "").trim();
  if (!fullText) {
    return {
      title: "Video",
      description: "",
      tags: [],
    };
  }

  // Regex para identificar etiquetas de encabezado
  // Acepta cosas como: TÍTULO:, **TÍTULO:**, ## Título:, etc.
  const TITLE_LINE_REGEX = /(?:^|\n)\s*(?:[\*#_`~]*\s*)?(?:T[IÍ]TULO|TITLE)\s*(?:[\*#_`~]*\s*)?:\s*([^\n]+)/i;
  const DESC_START_REGEX = /(?:^|\n)\s*(?:[\*#_`~]*\s*)?(?:DESCRIPCI[OÓ]N|DESCRIPTION)\s*(?:[\*#_`~]*\s*)?:\s*([\s\S]*)$/i;
  const ALT_TITLES_BLOCK_REGEX = /(?:^|\n)\s*(?:[\*#_`~]*\s*)?T[IÍ]TULOS?\s+ALTERNATIVOS?\s*(?:[\*#_`~]*\s*)?:?[\s\S]*?(?=(?:\n\s*(?:[\*#_`~]*\s*)?DESCRIPCI[OÓ]N\s*(?:[\*#_`~]*\s*)?:)|$)/i;

  let extractedTitle = "";
  let extractedDescription = "";

  const titleMatch = fullText.match(TITLE_LINE_REGEX);
  const descMatch = fullText.match(DESC_START_REGEX);

  if (titleMatch || descMatch) {
    if (titleMatch && titleMatch[1]) {
      extractedTitle = cleanFormatting(titleMatch[1]);
    }

    if (descMatch && descMatch[1]) {
      extractedDescription = cleanFormatting(descMatch[1]);
    } else {
      // Si no hubo etiqueta "DESCRIPCIÓN:", quitamos bloque de títulos alternativos y la línea de título
      let cleaned = fullText.replace(ALT_TITLES_BLOCK_REGEX, "\n");
      cleaned = cleaned.replace(TITLE_LINE_REGEX, "").trim();
      extractedDescription = cleanFormatting(cleaned);
    }
  } else {
    // Si no hay etiquetas explícitas:
    // Quitamos posibles bloques de títulos alternativos
    let cleaned = fullText.replace(ALT_TITLES_BLOCK_REGEX, "\n").trim();
    const lines = cleaned.split("\n");
    extractedTitle = cleanFormatting(lines[0] || "");
    extractedDescription = lines.slice(1).join("\n").trim();
  }

  // Si después de limpiar el título quedó vacío, usar primera línea de la descripción
  if (!extractedTitle) {
    const lines = extractedDescription.split("\n");
    extractedTitle = cleanFormatting(lines[0] || "Video");
    extractedDescription = lines.slice(1).join("\n").trim();
  }

  // Si la descripción quedó vacía, usar el mismo título
  if (!extractedDescription) {
    extractedDescription = extractedTitle;
  }

  // Límite estricto de YouTube: 100 caracteres máx (dejamos 95 para margen seguro)
  const safeTitle = extractedTitle.length > 95
    ? extractedTitle.substring(0, 92).trim() + "..."
    : extractedTitle;

  // Extraer tags/hashtags
  const tagsMatched = fullText.match(/#([a-zA-Z0-9_\u00C0-\u017F]+)/g) || [];
  const tags = Array.from(new Set(tagsMatched.map(t => t.replace("#", "")))).slice(0, 15);

  return {
    title: safeTitle,
    description: extractedDescription,
    tags,
  };
}
