"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";

interface AiSettings {
  id: string;
  name: string;
  aiPrompt: string | null;
  aiDMsPrompt: string | null;
  aiCommentsPrompt: string | null;
  aiTone: string;
  autoReplyDMs: boolean;
  autoReplyComments: boolean;
}

const TEMPLATE_KNOWLEDGE_BASE = `🏢 INFORMACIÓN DE LA MARCA / NEGOCIO:
- Nombre de la marca o personal: [Ej: César Reyes Jaramillo / Tu Empresa]
- Quiénes somos: [Breve descripción de experiencia, trayectoria o giro del negocio]
- Productos o Servicios principales:
  1. [Servicio/Producto 1 con precio referencial o descripción]
  2. [Servicio/Producto 2 con precio referencial o descripción]
- Horarios de atención: Lunes a Viernes de 8:30 AM a 6:00 PM.
- Enlace o número de WhatsApp oficial: +593 99 999 9999 (https://wa.me/593999999999)
- Ubicación / Cobertura: [Ciudad, país o si es 100% online]
- Preguntas Frecuentes (FAQs):
  * ¿Hacen envíos?: Sí, a nivel nacional.
  * ¿Formas de pago?: Transferencia, tarjeta y efectivo.`;

const TEMPLATE_COMMENTS_PROMPT = `🎯 OBJETIVO ESTRATÉGICO EN COMENTARIOS:
- Responder de forma breve, empática y pública (máximo 1 a 2 oraciones).
- Agradecer la interacción e INVITAR AL CLIENTE A QUE NOS ESCRIBA POR DM o por WhatsApp para darle detalles personalizados.
- REGLA DE ORO: No digas "te enviamos un DM", di "¡Escríbenos un mensajito al DM o a nuestro WhatsApp y con gusto te asesoramos! 📩✨".

💬 EJEMPLOS DE RESPUESTAS A SEGUIR:
- Si preguntan precio: "¡Hola! Con gusto te damos todos los detalles y opciones. Por favor envíanos un mensajito al DM o a nuestro WhatsApp para asesorarte de inmediato 📩📲"
- Si felicitan o dejan emoji: "¡Muchas gracias por tu apoyo! Cualquier consulta, estamos a tu total disposición por DM 🚀"
- Si preguntan disponibilidad o información: "¡Hola! Con gusto te explicamos todo. Escríbenos un mensajito al privado (DM) para ayudarte con todo gusto 📦"`;

const TEMPLATE_DMS_PROMPT = `🎯 OBJETIVO ESTRATÉGICO EN DMs (MENSAJES PRIVADOS):
- Atención personalizada, cercana, cálida y consultiva uno a uno.
- Usar SIEMPRE la información de la Fuente de Conocimiento para responder con exactitud sobre precios, servicios y horarios.
- Guiar amablemente al cliente hacia la compra, agendar una cita o escribir al WhatsApp oficial.

⚠️ REGLAS OBLIGATORIAS PARA DMs:
1. Saluda cordialmente por su nombre si está disponible.
2. Responde directamente la duda y finaliza siempre con una pregunta abierta (ej: "¿Te gustaría que coordinemos por WhatsApp?" o "¿Para qué fecha lo necesitas?").
3. Si el cliente solicita hablar con un asesor humano o cotización formal, dale el enlace directo a WhatsApp.`;

export default function AiSettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const resolvedParams = use(params);
  const businessId = resolvedParams.businessId;

  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"knowledge" | "comments" | "dms" | "copys">(
    urlTab === "dms" ? "dms" : urlTab === "knowledge" ? "knowledge" : urlTab === "copys" ? "copys" : "comments"
  );

  useEffect(() => {
    if (urlTab === "dms" || urlTab === "comments" || urlTab === "knowledge" || urlTab === "copys") {
      setActiveTab(urlTab as any);
    }
  }, [urlTab]);

  // Form states
  const [aiPrompt, setAiPrompt] = useState(""); // Base de Conocimiento Central
  const [aiCommentsPrompt, setAiCommentsPrompt] = useState("");
  const [aiDMsPrompt, setAiDMsPrompt] = useState("");
  const [aiTone, setAiTone] = useState("amable_profesional");
  const [autoReplyComments, setAutoReplyComments] = useState(false);
  const [autoReplyDMs, setAutoReplyDMs] = useState(false);

  // Prompts de Copys por Red Social
  const [copyPromptInstagram, setCopyPromptInstagram] = useState("");
  const [copyPromptFacebook, setCopyPromptFacebook] = useState("");
  const [copyPromptLinkedIn, setCopyPromptLinkedIn] = useState("");
  const [copyPromptYouTube, setCopyPromptYouTube] = useState("");

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Test Simulator state
  const [testType, setTestType] = useState<"COMMENT" | "DM">("COMMENT");
  const [testPlatform, setTestPlatform] = useState<"INSTAGRAM" | "FACEBOOK">("INSTAGRAM");
  const [testMessage, setTestMessage] = useState("Hola, ¿cuánto cuesta el servicio?");
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch(`/api/businesses/ai-settings?businessId=${businessId}`);
        if (!res.ok) throw new Error("Error cargando configuración");
        const data = await res.json();
        if (data.settings) {
          setAiPrompt(data.settings.aiPrompt || "");
          setAiCommentsPrompt(data.settings.aiCommentsPrompt || "");
          setAiDMsPrompt(data.settings.aiDMsPrompt || "");
          setAiTone(data.settings.aiTone || "amable_profesional");
          setAutoReplyComments(Boolean(data.settings.autoReplyComments));
          setAutoReplyDMs(Boolean(data.settings.autoReplyDMs));
          setCopyPromptInstagram(data.settings.copyPromptInstagram || "");
          setCopyPromptFacebook(data.settings.copyPromptFacebook || "");
          setCopyPromptLinkedIn(data.settings.copyPromptLinkedIn || "");
          setCopyPromptYouTube(data.settings.copyPromptYouTube || "");
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [businessId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/businesses/ai-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          aiPrompt,
          aiCommentsPrompt,
          aiDMsPrompt,
          aiTone,
          autoReplyComments,
          autoReplyDMs,
          copyPromptInstagram,
          copyPromptFacebook,
          copyPromptLinkedIn,
          copyPromptYouTube,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      setSuccessMsg("¡Configuración y Fuente de Conocimiento guardadas exitosamente!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSimulation = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestReply(null);
    try {
      const res = await fetch("/api/ai/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          type: testType,
          platform: testPlatform,
          fromName: "Cliente de Prueba",
          content: testMessage,
          aiPrompt,
          aiCommentsPrompt,
          aiDMsPrompt,
          aiTone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando simulación");
      setTestReply(data.reply);
    } catch (err: any) {
      setTestReply(`❌ Error en prueba: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
        Cargando configuración de IA...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8"/>
              <rect width="16" height="12" x="4" y="8" rx="2"/>
              <path d="M2 14h2"/>
              <path d="M20 14h2"/>
              <path d="M15 13v2"/>
              <path d="M9 13v2"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Auto-Respuesta Inteligente con IA</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              <strong>Fuente de Conocimiento Central</strong> conectada con objetivos diferenciados para <strong>Comentarios</strong> y <strong>DMs</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Engine Status Banner */}
      <div className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <p className="font-medium text-sm">Motor de IA Activo: <span className="text-emerald-400">Groq Llama 3.3 70B (High-Performance)</span></p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Respuestas inmediatas (menos de 0.5s) que combinan la base de conocimiento con el objetivo del canal.</p>
          </div>
        </div>
        <div className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Listo para producción
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
          <span>✅</span> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Tone Selector */}
        <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <span>🎭</span> Tono General de la Marca
          </h2>
          <select
            value={aiTone}
            onChange={(e) => setAiTone(e.target.value)}
            className="w-full p-3 rounded-xl border text-sm outline-none transition-colors"
            style={{ background: "var(--bg)", borderColor: "var(--border)" }}
          >
            <option value="amable_profesional">Amable & Profesional (Recomendado para la mayoría de empresas)</option>
            <option value="cercano_juvenil">Cercano & Dinámico (Ideal para marcas jóvenes, ropa, ocio)</option>
            <option value="ventas_persuasivo">Ventas & Persuasivo (Enfocado en cerrar clientes y captar leads)</option>
            <option value="autoridad_ejecutiva">Autoridad Ejecutiva (Ideal para consultorías, bufetes, empresas B2B)</option>
          </select>
        </div>

        {/* Tab Navigation: 4 Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 p-1.5 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setActiveTab("knowledge")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "knowledge" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "hover:bg-white/5 text-gray-300"
            }`}
          >
            <span>📚</span> 1. Fuente de Conocimiento
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("copys")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "copys" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "hover:bg-white/5 text-gray-300"
            }`}
          >
            <span>✍️</span> 2. Prompts de Copys
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "comments" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "hover:bg-white/5 text-gray-300"
            }`}
          >
            <span>💬</span> 3. Comentarios
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dms")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "dms" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "hover:bg-white/5 text-gray-300"
            }`}
          >
            <span>✉️</span> 4. DMs Privados
          </button>
        </div>

        {/* TAB 1: FUENTE DE CONOCIMIENTO CENTRAL */}
        {activeTab === "knowledge" && (
          <div className="p-6 rounded-2xl border space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
                <span>📚</span> Fuente de Información Central de la Empresa / Marca Personal
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Esta información es la <strong>verdad absoluta</strong> de tu negocio. La IA la leerá tanto para responder comentarios como para atender DMs, garantizando que nunca invente datos, precios ni servicios.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Información clave (Quiénes son, servicios, WhatsApp oficial, precios, FAQs):
                </label>
                <button
                  type="button"
                  onClick={() => setAiPrompt(TEMPLATE_KNOWLEDGE_BASE)}
                  className="text-xs text-amber-400 hover:underline"
                >
                  🪄 Cargar plantilla de datos de empresa
                </button>
              </div>

              <textarea
                rows={11}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Escribe aquí todo sobre tu empresa: qué vendes, catálogo, precios, quién es el asesor, número de WhatsApp para ventas, horarios, etc."
                className="w-full p-4 rounded-xl border text-sm font-mono leading-relaxed outline-none focus:border-amber-500 transition-colors"
                style={{ background: "var(--bg)", borderColor: "var(--border)" }}
              />
            </div>
          </div>
        )}

        {/* TAB 2: PROMPTS DE COPYS POR RED SOCIAL */}
        {activeTab === "copys" && (
          <div className="p-6 rounded-2xl border space-y-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
                <span>✍️</span> Prompts de Estilo para Publicaciones (Por Red Social)
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Define la fórmula y el tono que la IA utilizará al redactar automáticamente tus copys en el calendario de publicaciones. Cada red social tendrá su propio estilo respetando siempre la <strong>Fuente de Conocimiento</strong> de tu empresa.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Instagram */}
              <div className="p-4 rounded-xl border space-y-2 bg-[#101012] border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-pink-400 flex items-center gap-1.5">
                    <span>📸</span> Estilo para Instagram
                  </label>
                  <span className="text-[10px] text-gray-500">Gancho inicial + Emojis + CTA + Hashtags</span>
                </div>
                <textarea
                  rows={6}
                  value={copyPromptInstagram}
                  onChange={(e) => setCopyPromptInstagram(e.target.value)}
                  placeholder="Instrucciones para Instagram (deja vacío para usar la estrategia óptima por defecto)..."
                  className="w-full p-3 rounded-lg border text-xs font-mono leading-relaxed outline-none focus:border-pink-500 transition-colors bg-[#141416] border-white/10 text-gray-200"
                />
              </div>

              {/* Facebook */}
              <div className="p-4 rounded-xl border space-y-2 bg-[#101012] border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                    <span>👥</span> Estilo para Facebook
                  </label>
                  <span className="text-[10px] text-gray-500">Cercano + Conversacional + Llamado a compartir</span>
                </div>
                <textarea
                  rows={6}
                  value={copyPromptFacebook}
                  onChange={(e) => setCopyPromptFacebook(e.target.value)}
                  placeholder="Instrucciones para Facebook (deja vacío para usar la estrategia óptima por defecto)..."
                  className="w-full p-3 rounded-lg border text-xs font-mono leading-relaxed outline-none focus:border-blue-500 transition-colors bg-[#141416] border-white/10 text-gray-200"
                />
              </div>

              {/* LinkedIn */}
              <div className="p-4 rounded-xl border space-y-2 bg-[#101012] border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                    <span>💼</span> Estilo para LinkedIn
                  </label>
                  <span className="text-[10px] text-gray-500">Profesional + Lecciones B2B + Debate</span>
                </div>
                <textarea
                  rows={6}
                  value={copyPromptLinkedIn}
                  onChange={(e) => setCopyPromptLinkedIn(e.target.value)}
                  placeholder="Instrucciones para LinkedIn (deja vacío para usar la estrategia óptima por defecto)..."
                  className="w-full p-3 rounded-lg border text-xs font-mono leading-relaxed outline-none focus:border-sky-500 transition-colors bg-[#141416] border-white/10 text-gray-200"
                />
              </div>

              {/* YouTube */}
              <div className="p-4 rounded-xl border space-y-2 bg-[#101012] border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                    <span>▶️</span> Estilo para YouTube (Título + SEO)
                  </label>
                  <span className="text-[10px] text-gray-500">Título de alto CTR + Descripción con bullets</span>
                </div>
                <textarea
                  rows={6}
                  value={copyPromptYouTube}
                  onChange={(e) => setCopyPromptYouTube(e.target.value)}
                  placeholder="Instrucciones para YouTube (deja vacío para usar la estrategia óptima por defecto)..."
                  className="w-full p-3 rounded-lg border text-xs font-mono leading-relaxed outline-none focus:border-red-500 transition-colors bg-[#141416] border-white/10 text-gray-200"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMMENTS */}
        {activeTab === "comments" && (
          <div className="p-6 rounded-2xl border space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
                  <span>💬</span> Estrategia y Objetivo para Comentarios Públicos
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  En comentarios, la IA responde de forma corta e invita activamente a <strong>escribir por mensaje privado (DM) o WhatsApp</strong>.
                </p>
              </div>

              {/* Auto-reply toggle for comments */}
              <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl border" style={{ background: autoReplyComments ? "rgba(245, 158, 11, 0.1)" : "transparent", borderColor: autoReplyComments ? "var(--accent)" : "var(--border)" }}>
                <input
                  type="checkbox"
                  checked={autoReplyComments}
                  onChange={(e) => setAutoReplyComments(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold whitespace-nowrap">
                  {autoReplyComments ? "⚡ Auto-responder activado" : "⏸️ Modo manual / Asistido"}
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Objetivo y Reglas para Comentarios:
                </label>
                <button
                  type="button"
                  onClick={() => setAiCommentsPrompt(TEMPLATE_COMMENTS_PROMPT)}
                  className="text-xs text-amber-400 hover:underline"
                >
                  🪄 Cargar plantilla recomendada para Comentarios
                </button>
              </div>

              <textarea
                rows={8}
                value={aiCommentsPrompt}
                onChange={(e) => setAiCommentsPrompt(e.target.value)}
                placeholder="Escribe cómo debe responder en los comentarios de tus posts..."
                className="w-full p-4 rounded-xl border text-sm font-mono leading-relaxed outline-none focus:border-amber-500 transition-colors"
                style={{ background: "var(--bg)", borderColor: "var(--border)" }}
              />
            </div>
          </div>
        )}

        {/* TAB 3: DMs */}
        {activeTab === "dms" && (
          <div className="p-6 rounded-2xl border space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
                  <span>✉️</span> Estrategia y Objetivo para Mensajes Privados (DMs)
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  En DMs, la IA atiende 1 a 1 como asesor experto usando la <strong>Fuente de Conocimiento</strong> para resolver dudas y cerrar ventas.
                </p>
              </div>

              {/* Auto-reply toggle for DMs */}
              <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl border" style={{ background: autoReplyDMs ? "rgba(245, 158, 11, 0.1)" : "transparent", borderColor: autoReplyDMs ? "var(--accent)" : "var(--border)" }}>
                <input
                  type="checkbox"
                  checked={autoReplyDMs}
                  onChange={(e) => setAutoReplyDMs(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold whitespace-nowrap">
                  {autoReplyDMs ? "⚡ Auto-responder activado" : "⏸️ Modo manual / Asistido"}
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Objetivo y Reglas para DMs (Atención y Cierre):
                </label>
                <button
                  type="button"
                  onClick={() => setAiDMsPrompt(TEMPLATE_DMS_PROMPT)}
                  className="text-xs text-amber-400 hover:underline"
                >
                  🪄 Cargar plantilla recomendada para DMs
                </button>
              </div>

              <textarea
                rows={9}
                value={aiDMsPrompt}
                onChange={(e) => setAiDMsPrompt(e.target.value)}
                placeholder="Escribe el objetivo de atención, si debe guiar a WhatsApp o agendar citas..."
                className="w-full p-4 rounded-xl border text-sm font-mono leading-relaxed outline-none focus:border-amber-500 transition-colors"
                style={{ background: "var(--bg)", borderColor: "var(--border)" }}
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {saving ? "Guardando cambios..." : "💾 Guardar Toda la Configuración"}
          </button>
        </div>
      </form>

      {/* Live Test Simulator */}
      <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🧪</span>
          <div>
            <h2 className="text-lg font-semibold">Simulador de Prueba</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Prueba cómo respondería la IA según el canal que elijas (Comentario público o DM privado).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Canal a Probar</label>
            <select
              value={testType}
              onChange={(e) => {
                const val = e.target.value as "COMMENT" | "DM";
                setTestType(val);
                setTestMessage(val === "COMMENT" ? "¿Qué precio tiene?" : "Hola, me interesa su servicio, ¿cómo funciona?");
              }}
              className="w-full p-2.5 rounded-lg border text-sm"
              style={{ background: "var(--bg)", borderColor: "var(--border)" }}
            >
              <option value="COMMENT">💬 Comentario Público (Llevar a DM)</option>
              <option value="DM">✉️ Mensaje Directo (DM Privado)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Plataforma</label>
            <select
              value={testPlatform}
              onChange={(e) => setTestPlatform(e.target.value as any)}
              className="w-full p-2.5 rounded-lg border text-sm"
              style={{ background: "var(--bg)", borderColor: "var(--border)" }}
            >
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Mensaje del cliente simulado</label>
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            className="w-full p-3 rounded-lg border text-sm"
            style={{ background: "var(--bg)", borderColor: "var(--border)" }}
          />
        </div>

        <button
          type="button"
          onClick={handleTestSimulation}
          disabled={testing}
          className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-white/5 transition-colors text-amber-400 border-amber-400/40 flex items-center gap-2"
        >
          {testing ? "Generando con Groq..." : `✨ Probar respuesta de ${testType === "COMMENT" ? "Comentario" : "DM"}`}
        </button>

        {testReply && (
          <div className="p-4 rounded-xl border space-y-2 mt-3" style={{ background: "var(--bg)", borderColor: "var(--accent)" }}>
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
              <span>🤖</span> Respuesta generada por la IA ({testType === "COMMENT" ? "Pública para Comentario" : "Privada para DM"}):
            </p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{testReply}</p>
          </div>
        )}
      </div>
    </div>
  );
}
