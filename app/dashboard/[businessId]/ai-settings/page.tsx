"use client";

import { useEffect, useState, use } from "react";

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

const TEMPLATE_COMMENTS_PROMPT = `🎯 OBJETIVO EN COMENTARIOS:
- Responder de forma breve, cálida y pública (1 a 2 oraciones).
- Agradecer la interacción y siempre LLEVAR AL USUARIO AL DM (Mensaje Directo) para darle atención personalizada o precios.

💬 EJEMPLOS DE RESPUESTAS A SEGUIR:
- Si preguntan precio: "¡Hola! Te acabamos de enviar un mensaje privado con el catálogo y todos los detalles 📩✨"
- Si felicitan o dejan emoji: "¡Muchas gracias por tu apoyo! Si necesitas asesoría, estamos a la orden por DM 🚀"
- Si preguntan disponibilidad: "¡Hola! Sí tenemos disponible. Escríbenos al privado para coordinar tu entrega 📦"`;

const TEMPLATE_DMS_PROMPT = `🎯 OBJETIVO EN DMs (MENSAJES PRIVADOS):
- Atención personalizada, cercana y conversacional uno a uno.
- Resolver todas las dudas a fondo, calificar al cliente y guiarlo al cierre de venta o contacto por WhatsApp.

📌 INFORMACIÓN DE LA EMPRESA:
- Servicios/Productos: [Detallar productos o servicios principales].
- Horarios de atención: Lunes a Viernes de 8:30 AM a 6:00 PM.
- WhatsApp para pedidos y cotizaciones: +593 99 999 9999 (https://wa.me/593999999999).

⚠️ REGLAS OBLIGATORIAS PARA DMs:
1. Saluda cordialmente por su nombre si está disponible.
2. Responde directamente la pregunta y finaliza con una pregunta abierta para no cortar la conversación.
3. Si el cliente pide hablar con una persona o cotización formal, dale el enlace directo a WhatsApp.`;

export default function AiSettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const resolvedParams = use(params);
  const businessId = resolvedParams.businessId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "dms">("comments");

  // Form states
  const [aiCommentsPrompt, setAiCommentsPrompt] = useState("");
  const [aiDMsPrompt, setAiDMsPrompt] = useState("");
  const [aiTone, setAiTone] = useState("amable_profesional");
  const [autoReplyComments, setAutoReplyComments] = useState(false);
  const [autoReplyDMs, setAutoReplyDMs] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Test Simulator state
  const [testType, setTestType] = useState<"COMMENT" | "DM">("COMMENT");
  const [testPlatform, setTestPlatform] = useState<"INSTAGRAM" | "FACEBOOK">("INSTAGRAM");
  const [testMessage, setTestMessage] = useState("Hola, ¿cuánto cuesta el producto?");
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
          setAiCommentsPrompt(data.settings.aiCommentsPrompt || "");
          setAiDMsPrompt(data.settings.aiDMsPrompt || "");
          setAiTone(data.settings.aiTone || "amable_profesional");
          setAutoReplyComments(Boolean(data.settings.autoReplyComments));
          setAutoReplyDMs(Boolean(data.settings.autoReplyDMs));
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
          aiCommentsPrompt,
          aiDMsPrompt,
          aiTone,
          autoReplyComments,
          autoReplyDMs,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      setSuccessMsg("¡Configuración guardada exitosamente!");
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
              Estrategias separadas para <strong>Comentarios Públicos</strong> (Llevar a DM) y <strong>Mensajes Privados</strong> (Atención Personalizada & Cierre).
            </p>
          </div>
        </div>
      </div>

      {/* Engine Status Banner */}
      <div className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <p className="font-medium text-sm">Motor de IA Activo: <span className="text-emerald-400">Groq High-Performance AI</span></p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Velocidad ultra-rápida (menos de 0.5s) con comprensión contextual en español.</p>
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

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1.5 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "comments" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "hover:bg-white/5 text-gray-300"
            }`}
          >
            <span>💬</span> 1. Comentarios Públicos (Llevar a DM)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dms")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "dms" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "hover:bg-white/5 text-gray-300"
            }`}
          >
            <span>✉️</span> 2. Mensajes Directos / DMs (Atención & Venta)
          </button>
        </div>

        {/* TAB 1: COMMENTS */}
        {activeTab === "comments" && (
          <div className="p-6 rounded-2xl border space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
                  <span>💬</span> Estrategia para Comentarios Públicos
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  En comentarios, la IA responderá de forma corta y buscará <strong>derivar al usuario al DM</strong> para no exponer precios ni saturar el feed.
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
                  Instrucciones específicas para Comentarios:
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

        {/* TAB 2: DMs */}
        {activeTab === "dms" && (
          <div className="p-6 rounded-2xl border space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
                  <span>✉️</span> Estrategia para Mensajes Privados (DMs)
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  En DMs, la IA responderá de forma <strong>personalizada, detallada y humana</strong>, resolviendo dudas y cerrando la venta o enviando a WhatsApp.
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
                  Instrucciones específicas para DMs (Atención y Cierre):
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
                rows={10}
                value={aiDMsPrompt}
                onChange={(e) => setAiDMsPrompt(e.target.value)}
                placeholder="Escribe la información detallada de tu empresa, precios, catálogo, links de WhatsApp..."
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
            {saving ? "Guardando cambios..." : "💾 Guardar Ambas Configuraciones"}
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
