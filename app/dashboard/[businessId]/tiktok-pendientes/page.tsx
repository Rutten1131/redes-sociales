"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface MediaItem {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  order: number;
}

interface TikTokPost {
  id: string;
  caption: string | null;
  mediaUrl: string;
  scheduledAt: string;
  socialAccount: { displayName: string };
  mediaItems: MediaItem[];
}

interface TikTokNotification {
  id: string;
  postId: string;
  createdAt: string;
  post: TikTokPost;
}

export default function TikTokPendientesPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [notifications, setNotifications] = useState<TikTokNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingDone, setMarkingDone] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tiktok/notifications?businessId=${businessId}`);
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch (e) {
      console.error("Error cargando notificaciones TikTok:", e);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function handleMarkDone(postId: string) {
    setMarkingDone(postId);
    try {
      const res = await fetch("/api/tiktok/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.postId !== postId));
      }
    } catch (e) {
      console.error("Error marcando como publicado:", e);
    } finally {
      setMarkingDone(null);
    }
  }

  async function handleCopyCaption(postId: string, caption: string) {
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedId(postId);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // fallback para navegadores sin permiso de clipboard
      const el = document.createElement("textarea");
      el.value = caption;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedId(postId);
      setTimeout(() => setCopiedId(null), 2500);
    }
  }

  const getVideoUrl = (post: TikTokPost) => {
    const videoItem = post.mediaItems?.find((m) => m.type === "VIDEO");
    return videoItem?.url || post.mediaUrl;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, #010101 0%, #ff0050 50%, #00f2ea 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 4px 20px rgba(255,0,80,0.35)",
          }}
        >
          <TikTokIcon size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">TikTok — Videos Pendientes</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Estos videos están listos para que los subas manualmente a TikTok.
          </p>
        </div>
      </div>

      {/* Instrucciones */}
      <div
        className="card p-4 mb-6"
        style={{
          borderLeft: "4px solid #ff0050",
          background: "rgba(255,0,80,0.06)",
        }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: "#ff0050" }}>
          ¿Cómo publicar?
        </p>
        <ol className="text-sm space-y-1" style={{ color: "var(--text-muted)" }}>
          <li>1. Descarga el video o cópialo desde la previsualización.</li>
          <li>2. Copia el texto del caption con el botón 📋.</li>
          <li>3. Abre TikTok con el botón 🎵 y sube el video.</li>
          <li>4. Pega el texto del caption y publica.</li>
          <li>5. Vuelve aquí y marca la publicación como ✅ Publicado.</li>
        </ol>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="flex justify-center py-20">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#ff0050", borderTopColor: "transparent" }}
          />
        </div>
      )}

      {/* Sin pendientes */}
      {!loading && notifications.length === 0 && (
        <div
          className="card p-12 text-center"
          style={{ borderStyle: "dashed", borderColor: "rgba(255,255,255,0.1)" }}
        >
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-lg font-semibold mb-1">¡Todo al día!</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No tienes videos de TikTok pendientes de publicar.
          </p>
        </div>
      )}

      {/* Lista de notificaciones */}
      <div className="space-y-5">
        {notifications.map((notif) => {
          const post = notif.post;
          const videoUrl = getVideoUrl(post);
          const isVideo =
            videoUrl.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|3gp|wmv)($|\?)/) !== null;
          const scheduledDate = new Date(post.scheduledAt);

          return (
            <div
              key={notif.id}
              className="card overflow-hidden"
              style={{
                borderTop: "2px solid #ff0050",
                animation: "fadeSlideIn 0.3s ease",
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                {/* Preview del video */}
                <div
                  style={{
                    background: "#000",
                    minHeight: 280,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  {isVideo ? (
                    <video
                      src={videoUrl}
                      controls
                      style={{
                        width: "100%",
                        height: 280,
                        objectFit: "contain",
                        background: "#000",
                      }}
                    />
                  ) : (
                    <img
                      src={videoUrl}
                      alt="Preview"
                      style={{ width: "100%", height: 280, objectFit: "cover" }}
                    />
                  )}
                  {/* Badge TikTok */}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      background: "rgba(0,0,0,0.75)",
                      borderRadius: 8,
                      padding: "4px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <TikTokIcon size={14} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                      {post.socialAccount.displayName}
                    </span>
                  </div>
                </div>

                {/* Información y acciones */}
                <div className="p-5 flex flex-col justify-between gap-4">
                  <div>
                    {/* Fecha programada */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{
                          background: "rgba(255,0,80,0.12)",
                          color: "#ff0050",
                          border: "1px solid rgba(255,0,80,0.25)",
                        }}
                      >
                        ⏰ Programado para:{" "}
                        {scheduledDate.toLocaleString("es", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Caption */}
                    <div>
                      <p
                        className="text-xs font-semibold mb-1.5 uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Caption / Texto
                      </p>
                      {post.caption ? (
                        <div
                          className="text-sm rounded-lg p-3"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            maxHeight: 120,
                            overflowY: "auto",
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {post.caption}
                        </div>
                      ) : (
                        <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
                          Sin caption
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex flex-col gap-2">
                    {/* Copiar caption */}
                    {post.caption && (
                      <button
                        onClick={() => handleCopyCaption(notif.postId, post.caption!)}
                        className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all"
                        style={{
                          background:
                            copiedId === notif.postId
                              ? "rgba(16,185,129,0.15)"
                              : "rgba(255,255,255,0.06)",
                          border: `1px solid ${
                            copiedId === notif.postId
                              ? "rgba(16,185,129,0.35)"
                              : "rgba(255,255,255,0.12)"
                          }`,
                          color: copiedId === notif.postId ? "#10b981" : "var(--text)",
                        }}
                      >
                        {copiedId === notif.postId ? "✅ ¡Copiado!" : "📋 Copiar texto"}
                      </button>
                    )}

                    {/* Descargar video */}
                    <a
                      href={videoUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-center transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "var(--text)",
                        display: "block",
                        textDecoration: "none",
                      }}
                    >
                      ⬇️ Descargar video
                    </a>

                    {/* Abrir TikTok */}
                    <a
                      href="https://www.tiktok.com/upload"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-center transition-all"
                      style={{
                        background: "linear-gradient(135deg, #ff0050 0%, #ff3d6e 100%)",
                        border: "none",
                        color: "#fff",
                        display: "block",
                        textDecoration: "none",
                        boxShadow: "0 4px 14px rgba(255,0,80,0.35)",
                      }}
                    >
                      🎵 Abrir TikTok para subir
                    </a>

                    {/* Marcar como publicado */}
                    <button
                      onClick={() => handleMarkDone(notif.postId)}
                      disabled={markingDone === notif.postId}
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all"
                      style={{
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        color: "#10b981",
                        cursor: markingDone === notif.postId ? "not-allowed" : "pointer",
                        opacity: markingDone === notif.postId ? 0.6 : 1,
                      }}
                    >
                      {markingDone === notif.postId ? "Guardando…" : "✅ Ya lo publiqué en TikTok"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function TikTokIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.72a4.85 4.85 0 01-1-.03z"
        fill="white"
      />
    </svg>
  );
}
