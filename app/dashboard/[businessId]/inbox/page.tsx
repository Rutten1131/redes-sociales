"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

// ---------- Types ----------

interface SocialAccountInfo {
  id: string;
  displayName: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN";
  externalId: string;
}

interface InboxItem {
  id: string;
  socialAccountId: string;
  socialAccount: SocialAccountInfo;
  platform: "FACEBOOK" | "INSTAGRAM";
  type: "DM" | "COMMENT";
  externalId: string;
  parentId: string | null;
  fromName: string | null;
  fromExternalId: string | null;
  content: string;
  status: "PENDING" | "ANSWERED" | "IGNORED";
  createdAt: string;
}

// ---------- Constants ----------

const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: "var(--facebook)",
  INSTAGRAM: "var(--instagram)",
};

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "var(--warning)" },
  ANSWERED: { label: "Respondido", color: "var(--success)" },
  IGNORED: { label: "Ignorado", color: "var(--text-muted)" },
};

// ---------- Component ----------

export default function InboxPage() {
  const params = useParams();
  const businessId = params.businessId as string;

  const [items, setItems] = useState<InboxItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [filterPlatform, setFilterPlatform] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ businessId });
      if (filterPlatform) params.set("platform", filterPlatform);
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/inbox?${params.toString()}`);
      if (!res.ok) throw new Error("Error cargando bandeja");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [businessId, filterPlatform, filterType, filterStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const handleReply = async () => {
    if (!selectedItem || !replyText.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem.id, message: replyText.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error enviando respuesta");
      }
      setReplyText("");
      setSuccessMsg("¡Respuesta enviada!");
      // Actualizar el item en la lista
      setItems((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id ? { ...it, status: "ANSWERED" as const } : it
        )
      );
      setSelectedItem((prev) =>
        prev ? { ...prev, status: "ANSWERED" as const } : null
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Error actualizando estado");
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: newStatus as any } : it))
      );
      if (selectedItem?.id === itemId) {
        setSelectedItem((prev) =>
          prev ? { ...prev, status: newStatus as any } : null
        );
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              background: "linear-gradient(135deg, #6C5CE7, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Bandeja de entrada
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0" }}>
            DMs y comentarios de Facebook e Instagram
          </p>
        </div>
        <button
          onClick={fetchItems}
          className="btn-primary"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Filters */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: 12,
          padding: "12px 16px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
          FILTROS
        </span>
        <select
          className="input"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          style={{ padding: "6px 10px", fontSize: 13, minWidth: 120 }}
        >
          <option value="">Todas las plataformas</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="INSTAGRAM">Instagram</option>
        </select>
        <select
          className="input"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: "6px 10px", fontSize: 13, minWidth: 100 }}
        >
          <option value="">Todos los tipos</option>
          <option value="DM">DMs</option>
          <option value="COMMENT">Comentarios</option>
        </select>
        <select
          className="input"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: "6px 10px", fontSize: 13, minWidth: 120 }}
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendientes</option>
          <option value="ANSWERED">Respondidos</option>
          <option value="IGNORED">Ignorados</option>
        </select>
      </div>

      {/* Notifications */}
      {error && (
        <div
          style={{
            background: "var(--danger)",
            color: "white",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 13,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          ⚠️ {error}
          <button
            onClick={() => setError(null)}
            style={{
              float: "right",
              background: "none",
              border: "none",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}
      {successMsg && (
        <div
          style={{
            background: "var(--success)",
            color: "#0B0E14",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          ✓ {successMsg}
        </div>
      )}

      {/* Main layout: list + detail */}
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: 16,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Item list (left panel) */}
        <div
          className="card"
          style={{
            width: 380,
            minWidth: 320,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Mensajes ({items.length})</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <div
                  className="pulse-dot"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                />
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                  Cargando...
                </p>
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  No hay mensajes con estos filtros
                </p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setReplyText("");
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    width: "100%",
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    background:
                      selectedItem?.id === item.id
                        ? "var(--accent-soft)"
                        : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--text)",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedItem?.id !== item.id)
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--surface-raised)";
                  }}
                  onMouseLeave={(e) => {
                    if (selectedItem?.id !== item.id)
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                  }}
                >
                  {/* Top row: platform badge + time */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: PLATFORM_COLORS[item.platform] ?? "var(--accent)",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: PLATFORM_COLORS[item.platform] ?? "var(--accent)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {PLATFORM_LABELS[item.platform] ?? item.platform}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background:
                            item.type === "DM"
                              ? "rgba(108,92,231,0.15)"
                              : "rgba(245,166,35,0.15)",
                          color:
                            item.type === "DM" ? "var(--accent)" : "var(--warning)",
                          fontWeight: 600,
                        }}
                      >
                        {item.type === "DM" ? "DM" : "Comentario"}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  {/* Sender */}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {item.fromName || item.fromExternalId || "Usuario desconocido"}
                  </span>

                  {/* Content preview */}
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.content}
                  </span>

                  {/* Status */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: STATUS_BADGES[item.status]?.color ?? "var(--text-muted)",
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        color: STATUS_BADGES[item.status]?.color ?? "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {STATUS_BADGES[item.status]?.label ?? item.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail panel (right) */}
        <div
          className="card"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {selectedItem ? (
            <>
              {/* Detail header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: PLATFORM_COLORS[selectedItem.platform] ?? "var(--accent)",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      {selectedItem.fromName ||
                        selectedItem.fromExternalId ||
                        "Usuario desconocido"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background:
                          selectedItem.type === "DM"
                            ? "rgba(108,92,231,0.15)"
                            : "rgba(245,166,35,0.15)",
                        color:
                          selectedItem.type === "DM" ? "var(--accent)" : "var(--warning)",
                        fontWeight: 600,
                      }}
                    >
                      {selectedItem.type === "DM" ? "Mensaje directo" : "Comentario"}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                    {PLATFORM_LABELS[selectedItem.platform]} ·{" "}
                    {selectedItem.socialAccount.displayName} ·{" "}
                    {formatDate(selectedItem.createdAt)}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  {selectedItem.status !== "ANSWERED" && (
                    <button
                      onClick={() => handleStatusChange(selectedItem.id, "IGNORED")}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface-raised)",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--text-muted)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      }}
                    >
                      Ignorar
                    </button>
                  )}
                  {selectedItem.status === "IGNORED" && (
                    <button
                      onClick={() => handleStatusChange(selectedItem.id, "PENDING")}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface-raised)",
                        color: "var(--warning)",
                        cursor: "pointer",
                      }}
                    >
                      Reabrir
                    </button>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      background:
                        selectedItem.status === "PENDING"
                          ? "rgba(245,166,35,0.1)"
                          : selectedItem.status === "ANSWERED"
                          ? "rgba(45,212,191,0.1)"
                          : "rgba(138,147,166,0.1)",
                      color: STATUS_BADGES[selectedItem.status]?.color,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: STATUS_BADGES[selectedItem.status]?.color,
                        display: "inline-block",
                      }}
                    />
                    {STATUS_BADGES[selectedItem.status]?.label}
                  </div>
                </div>
              </div>

              {/* Message content */}
              <div
                style={{
                  flex: 1,
                  padding: "24px 20px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* Incoming message bubble */}
                <div
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "75%",
                  }}
                >
                  <div
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: "18px 18px 18px 4px",
                      padding: "12px 16px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    {selectedItem.content}
                  </div>
                  <p
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      margin: "4px 0 0 8px",
                    }}
                  >
                    {selectedItem.fromName || selectedItem.fromExternalId} ·{" "}
                    {formatDate(selectedItem.createdAt)}
                  </p>
                </div>

                {selectedItem.status === "ANSWERED" && (
                  <div style={{ alignSelf: "flex-end", maxWidth: "75%" }}>
                    <div
                      style={{
                        background: "var(--accent)",
                        borderRadius: "18px 18px 4px 18px",
                        padding: "12px 16px",
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "white",
                      }}
                    >
                      ✓ Respondido
                    </div>
                  </div>
                )}
              </div>

              {/* Reply box */}
              {selectedItem.status !== "IGNORED" && (
                <div
                  style={{
                    padding: "16px 20px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-end",
                  }}
                >
                  <textarea
                    className="input"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                    placeholder={
                      selectedItem.type === "DM"
                        ? "Escribe tu respuesta al DM..."
                        : "Responde al comentario..."
                    }
                    rows={2}
                    style={{
                      flex: 1,
                      resize: "none",
                      padding: "10px 14px",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                    style={{
                      padding: "10px 20px",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sending ? (
                      <>
                        <span
                          className="pulse-dot"
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "white",
                            display: "inline-block",
                          }}
                        />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        Enviar
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                }}
              >
                💬
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>
                  Selecciona un mensaje
                </p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  Elige un DM o comentario de la lista para ver su contenido y responder
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
