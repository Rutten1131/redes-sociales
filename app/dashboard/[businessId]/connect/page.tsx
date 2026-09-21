"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN" | "TIKTOK";
  displayName: string;
  avatarUrl: string | null;
  externalId: string;
  expiresAt: string | null;
}

const PLATFORM_META = {
  FACEBOOK:  { label: "Facebook",  color: "var(--facebook)" },
  INSTAGRAM: { label: "Instagram", color: "var(--instagram)" },
  YOUTUBE:   { label: "YouTube",   color: "var(--youtube)" },
  LINKEDIN:  { label: "LinkedIn",  color: "#0A66C2" },
  TIKTOK:    { label: "TikTok",    color: "#ff0050" },
} as const;

function TikTokIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.72a4.85 4.85 0 01-1-.03z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ConnectPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const [nowMs] = useState(() => Date.now());

  // TikTok connection modal & options
  const [showTikTokForm, setShowTikTokForm] = useState(false);
  const [tiktokMode, setTiktokMode] = useState<"BROWSER" | "COOKIES" | "MANUAL">("BROWSER");
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [tiktokCookiesJson, setTiktokCookiesJson] = useState("");
  const [tiktokSubmitting, setTiktokSubmitting] = useState(false);
  const [tiktokStatusMsg, setTiktokStatusMsg] = useState("");
  const [tiktokError, setTiktokError] = useState<string | null>(null);

  async function loadAccounts() {
    if (!businessId) return;
    setLoading(true);
    const res = await fetch(`/api/accounts?businessId=${businessId}`);
    const data = await res.json();
    setAccounts(data.accounts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
  }, [businessId]);

  async function disconnect(id: string) {
    if (!confirm("¿Desconectar esta cuenta? Los posts programados con ella dejarán de poder publicarse.")) return;
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, businessId }),
    });
    loadAccounts();
  }

  async function handleLaunchTikTokBrowser() {
    setTiktokSubmitting(true);
    setTiktokError(null);
    setTiktokStatusMsg("Abriendo navegador... Inicia sesión o escanea el QR en la ventana que aparecerá.");
    try {
      const res = await fetch("/api/connect/tiktok-browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTiktokError(data.error || "Error durante el inicio de sesión.");
      } else {
        setShowTikTokForm(false);
        setTiktokStatusMsg("");
        loadAccounts();
      }
    } catch {
      setTiktokError("Error conectando con el servicio de TikTok.");
    } finally {
      setTiktokSubmitting(false);
    }
  }

  async function handleConnectTikTokWithCookies(e: React.FormEvent) {
    e.preventDefault();
    if (!tiktokCookiesJson.trim()) return;
    setTiktokSubmitting(true);
    setTiktokError(null);
    try {
      let parsed = [];
      try {
        parsed = JSON.parse(tiktokCookiesJson.trim());
      } catch {
        setTiktokError("El texto no es un JSON de cookies válido.");
        setTiktokSubmitting(false);
        return;
      }

      const res = await fetch("/api/connect/tiktok-browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, manualCookies: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTiktokError(data.error || "Error al conectar con cookies.");
      } else {
        setTiktokCookiesJson("");
        setShowTikTokForm(false);
        loadAccounts();
      }
    } catch {
      setTiktokError("Error de conexión. Intenta de nuevo.");
    } finally {
      setTiktokSubmitting(false);
    }
  }

  async function handleConnectTikTokManual(e: React.FormEvent) {
    e.preventDefault();
    if (!tiktokUsername.trim()) return;
    setTiktokSubmitting(true);
    setTiktokError(null);
    try {
      const res = await fetch("/api/connect/tiktok-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, displayName: tiktokUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTiktokError(typeof data.error === "string" ? data.error : "Error al conectar TikTok.");
      } else {
        setTiktokUsername("");
        setShowTikTokForm(false);
        loadAccounts();
      }
    } catch {
      setTiktokError("Error de conexión. Intenta de nuevo.");
    } finally {
      setTiktokSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Cuentas conectadas</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Conecta tus páginas de Facebook, cuentas de Instagram, YouTube, LinkedIn y TikTok para poder programar publicaciones.
      </p>

      {success && (
        <div className="card px-4 py-3 mb-4 text-sm" style={{ borderColor: "var(--success)" }}>
          Cuenta conectada correctamente.
        </div>
      )}
      {error && (
        <div className="card px-4 py-3 mb-4 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          Error al conectar: {error}
        </div>
      )}

      {/* Botones de conectar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <a href={`/api/connect/meta?businessId=${businessId}`} className="btn-primary px-4 py-2 text-sm">
          + Facebook / Instagram
        </a>
        <a
          href={`/api/connect/youtube?businessId=${businessId}`}
          className="px-4 py-2 text-sm rounded-lg font-semibold"
          style={{ background: "var(--youtube)", color: "white" }}
        >
          + YouTube
        </a>
        <a
          href={`/api/connect/linkedin?businessId=${businessId}`}
          className="px-4 py-2 text-sm rounded-lg font-semibold"
          style={{ background: "#0A66C2", color: "white" }}
        >
          + LinkedIn
        </a>
        <button
          onClick={() => { setShowTikTokForm(!showTikTokForm); setTiktokError(null); }}
          className="px-4 py-2 text-sm rounded-lg font-semibold flex items-center gap-2 transition-all"
          style={{ background: "#ff0050", color: "white" }}
        >
          <TikTokIcon />
          + TikTok
        </button>
      </div>

      {/* Modal / Formulario TikTok con modos */}
      {showTikTokForm && (
        <div
          className="card p-5 mb-6 shadow-xl"
          style={{ borderColor: "rgba(255,0,80,0.4)", background: "rgba(255,0,80,0.05)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span style={{ color: "#ff0050" }}><TikTokIcon /></span>
              <p className="text-base font-semibold">Conectar TikTok Automático</p>
            </div>
            <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setTiktokMode("BROWSER")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  tiktokMode === "BROWSER" ? "bg-[#ff0050] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                ⚡ 1 Clic (Navegador)
              </button>
              <button
                type="button"
                onClick={() => setTiktokMode("COOKIES")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  tiktokMode === "COOKIES" ? "bg-[#ff0050] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                📋 Pegar Cookies
              </button>
              <button
                type="button"
                onClick={() => setTiktokMode("MANUAL")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  tiktokMode === "MANUAL" ? "bg-[#ff0050] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                ✍️ Semimanual
              </button>
            </div>
          </div>

          {/* MODO 1: NAVEGADOR AUTOMATICO */}
          {tiktokMode === "BROWSER" && (
            <div className="space-y-4 py-2">
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Al hacer clic en el botón de abajo, se abrirá una ventana de Chrome con <strong>TikTok.com</strong>.
                Solo inicia sesión o <strong>escanea el código QR con tu celular</strong>. El sistema detectará tu sesión iniciada, guardará las cookies automáticamente y cerrará la ventana.
              </p>

              {tiktokStatusMsg && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 animate-pulse">
                  ⏳ {tiktokStatusMsg}
                </div>
              )}

              {tiktokError && (
                <p className="text-xs" style={{ color: "var(--danger)" }}>{tiktokError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleLaunchTikTokBrowser}
                  disabled={tiktokSubmitting}
                  className="px-5 py-2.5 text-sm rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg"
                  style={{
                    background: "#ff0050",
                    color: "white",
                    opacity: tiktokSubmitting ? 0.7 : 1,
                    cursor: tiktokSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  <TikTokIcon />
                  {tiktokSubmitting ? "Esperando inicio de sesión..." : "Abrir TikTok e Iniciar Sesión"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowTikTokForm(false); setTiktokError(null); setTiktokStatusMsg(""); }}
                  className="px-4 py-2 text-sm rounded-lg transition-all hover:bg-white/5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* MODO 2: PEGAR COOKIES JSON */}
          {tiktokMode === "COOKIES" && (
            <form onSubmit={handleConnectTikTokWithCookies} className="flex flex-col gap-3 py-2">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Si estás en un servidor remoto (VPS sin pantalla), exporta tus cookies de TikTok con la extensión <em>Cookie-Editor</em> (Exportar JSON) y pégalas aquí.
              </p>
              <textarea
                value={tiktokCookiesJson}
                onChange={(e) => setTiktokCookiesJson(e.target.value)}
                placeholder='[{"name": "sessionid", "value": "...", "domain": ".tiktok.com"}, ...]'
                rows={5}
                className="w-full p-3 rounded-lg text-xs font-mono bg-black/50 border border-white/10 text-gray-200 resize-none outline-none focus:border-[#ff0050]"
              />
              {tiktokError && (
                <p className="text-xs" style={{ color: "var(--danger)" }}>{tiktokError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={tiktokSubmitting || !tiktokCookiesJson.trim()}
                  className="px-4 py-2 text-sm rounded-lg font-semibold"
                  style={{ background: "#ff0050", color: "white" }}
                >
                  {tiktokSubmitting ? "Guardando..." : "Guardar Cookies"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowTikTokForm(false); setTiktokError(null); }}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-white/5 text-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* MODO 3: MANUAL (@username) */}
          {tiktokMode === "MANUAL" && (
            <form onSubmit={handleConnectTikTokManual} className="flex flex-col gap-3 py-2">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Modo semimanual: registra solo tu @usuario para recibir avisos de subida en la sección de pendientes.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-400">@</span>
                <input
                  type="text"
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value.replace(/^@/, ""))}
                  placeholder="tunombredeusuario"
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none"
                />
              </div>
              {tiktokError && (
                <p className="text-xs" style={{ color: "var(--danger)" }}>{tiktokError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={tiktokSubmitting || !tiktokUsername.trim()}
                  className="px-4 py-2 text-sm rounded-lg font-semibold"
                  style={{ background: "#ff0050", color: "white" }}
                >
                  {tiktokSubmitting ? "Conectando..." : "Conectar modo manual"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowTikTokForm(false); setTiktokError(null); }}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-white/5 text-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lista de cuentas */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando…</p>
      ) : accounts.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aún no has conectado ninguna cuenta. Usa los botones de arriba para empezar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => {
            const meta = PLATFORM_META[acc.platform];
            const expiringSoon =
              acc.platform !== "YOUTUBE" &&
              acc.platform !== "TIKTOK" &&
              acc.expiresAt &&
              new Date(acc.expiresAt).getTime() - nowMs < 7 * 24 * 60 * 60 * 1000;
            const isTikTok = acc.platform === "TIKTOK";
            return (
              <div key={acc.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: meta.color }}
                  >
                    {isTikTok ? <TikTokIcon /> : meta.label[0]}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{acc.displayName}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {meta.label}
                      {isTikTok && (
                        <span className="font-semibold" style={{ color: "#00f2fe" }}>
                          {" "}· Modo 100% Automático (Playwright)
                        </span>
                      )}
                      {expiringSoon && (
                        <span style={{ color: "var(--warning)" }}> · token vence pronto</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => disconnect(acc.id)}
                  className="text-xs hover:underline"
                  style={{ color: "var(--text-muted)" }}
                >
                  Desconectar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
