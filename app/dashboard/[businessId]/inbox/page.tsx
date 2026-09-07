"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
  aiSuggestedReply?: string | null;
  aiReplied?: boolean;
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
  const [generatingAi, setGeneratingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const urlType = searchParams.get("type");

  // Filters & Search
  const [filterPlatform, setFilterPlatform] = useState<string>("");
  const [filterType, setFilterType] = useState<string>(urlType || "");
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [dateFilter, setDateFilter] = useState<"today" | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [showFullHistory, setShowFullHistory] = useState<boolean>(false);

  // Sincronizar si cambia el urlType
  useEffect(() => {
    if (urlType !== null) {
      setFilterType(urlType);
      setVisibleCount(10);
    }
  }, [urlType]);

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
    const sentText = replyText.trim();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem.id, message: sentText }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error enviando respuesta");
      }
      setReplyText("");
      setSuccessMsg("¡Respuesta enviada!");
      // Actualizar el item en la lista conservando el texto respondido
      setItems((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id
            ? { ...it, status: "ANSWERED" as const, aiSuggestedReply: sentText }
            : it
        )
      );
      setSelectedItem((prev) =>
        prev
          ? { ...prev, status: "ANSWERED" as const, aiSuggestedReply: sentText }
          : null
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

  const handleGenerateAiReply = async () => {
    if (!selectedItem) return;
    setGeneratingAi(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error generando respuesta de IA");
      }
      const data = await res.json();
      if (data.reply) {
        setReplyText(data.reply);
        setSelectedItem((prev) => (prev ? { ...prev, aiSuggestedReply: data.reply } : null));
        setSuccessMsg("¡Sugerencia generada con Groq Llama 3.3 70B!");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingAi(false);
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

  const titleHeader =
    filterType === "COMMENT"
      ? "Comentarios Públicos"
      : filterType === "DM"
      ? "Mensajes Directos (DMs)"
      : "Bandeja de Entrada";

  const descriptionHeader =
    filterType === "COMMENT"
      ? "Comentarios de tus publicaciones en Facebook e Instagram"
      : filterType === "DM"
      ? "Mensajes privados directos con clientes"
      : "Todos los DMs y comentarios recibidos";

  const configTab = filterType === "COMMENT" ? "comments" : filterType === "DM" ? "dms" : "comments";

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
            {titleHeader}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0" }}>
            {descriptionHeader}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href={`/dashboard/${businessId}/ai-settings?tab=${configTab}`}
            className="btn"
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              background: "rgba(245, 158, 11, 0.12)",
              color: "#f59e0b",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 8,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>⚙️</span> Configurar Objetivo {filterType === "COMMENT" ? "Comentarios" : filterType === "DM" ? "DMs" : "IA"}
          </a>
          <button
            onClick={fetchItems}
            className="btn-primary"
            style={{ padding: "8px 16px", fontSize: 13 }}
          >
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* Tabs Principales: DMs vs Comentarios */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        <button
          onClick={() => setFilterType("")}
          className="btn"
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 10,
            background: filterType === "" ? "var(--accent)" : "var(--surface)",
            color: filterType === "" ? "#fff" : "var(--text-muted)",
            border: filterType === "" ? "none" : "1px solid var(--border)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>📬</span> Todos
        </button>
        <button
          onClick={() => setFilterType("DM")}
          className="btn"
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 10,
            background: filterType === "DM" ? "var(--accent)" : "var(--surface)",
            color: filterType === "DM" ? "#fff" : "var(--text-muted)",
            border: filterType === "DM" ? "none" : "1px solid var(--border)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>✉️</span> Mensajes Directos (DMs)
        </button>
        <button
          onClick={() => setFilterType("COMMENT")}
          className="btn"
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 10,
            background: filterType === "COMMENT" ? "var(--accent)" : "var(--surface)",
            color: filterType === "COMMENT" ? "#fff" : "var(--text-muted)",
            border: filterType === "COMMENT" ? "none" : "1px solid var(--border)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>💬</span> Comentarios Públicos
        </button>
      </div>

      {/* Filters secundarios y Buscador */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: 12,
          padding: "12px 16px",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
          {/* Buscador */}
          <div style={{ position: "relative", minWidth: 240, flex: 1, maxWidth: 360 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.5, fontSize: 13 }}>
              🔍
            </span>
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o mensaje..."
              style={{ padding: "7px 10px 7px 32px", fontSize: 13, width: "100%" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro Rango de Tiempo (Hoy vs Todos) */}
          <div style={{ display: "flex", background: "var(--surface-raised)", padding: 2, borderRadius: 8, border: "1px solid var(--border)" }}>
            <button
              onClick={() => { setDateFilter("today"); setVisibleCount(10); }}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                background: dateFilter === "today" ? "var(--accent)" : "transparent",
                color: dateFilter === "today" ? "#fff" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
              }}
            >
              📅 Hoy
            </button>
            <button
              onClick={() => { setDateFilter("all"); setVisibleCount(10); }}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                background: dateFilter === "all" ? "var(--accent)" : "transparent",
                color: dateFilter === "all" ? "#fff" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
              }}
            >
              🌐 Todos los días
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            className="input"
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13, minWidth: 130 }}
          >
            <option value="">Plataformas</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
          <select
            className="input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13, minWidth: 120 }}
          >
            <option value="">Estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="ANSWERED">Respondidos</option>
            <option value="IGNORED">Ignorados</option>
          </select>
        </div>
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
      {(() => {
        // Filtrado por fecha Hoy vs Todos
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const filteredItems = items.filter((item) => {
          // Filtro de fecha
          if (dateFilter === "today") {
            const itemTime = new Date(item.createdAt).getTime();
            if (itemTime < startOfToday) return false;
          }
          // Filtro de búsqueda
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesName = (item.fromName || "").toLowerCase().includes(q);
            const matchesContent = (item.content || "").toLowerCase().includes(q);
            const matchesReply = (item.aiSuggestedReply || "").toLowerCase().includes(q);
            if (!matchesName && !matchesContent && !matchesReply) return false;
          }
          return true;
        });

        const displayedItems = filteredItems.slice(0, visibleCount);
        const hasMore = filteredItems.length > visibleCount;

        // Historial completo de mensajes para el remitente seleccionado
        const senderMessages = selectedItem
          ? items.filter(
              (it) =>
                (selectedItem.fromExternalId && it.fromExternalId === selectedItem.fromExternalId) ||
                (selectedItem.fromName && it.fromName === selectedItem.fromName) ||
                it.id === selectedItem.id
            ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          : [];

        const hasMultipleMessages = senderMessages.length > 2;
        const visibleSenderMessages = showFullHistory || !hasMultipleMessages
          ? senderMessages
          : senderMessages.slice(-2);

        return (
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
                  alignItems: "center",
                }}
              >
                <span>
                  {filterType === "COMMENT" ? "Comentarios" : filterType === "DM" ? "DMs" : "Mensajes"} ({filteredItems.length})
                </span>
                {dateFilter === "today" && (
                  <span style={{ fontSize: 11, background: "rgba(108,92,231,0.15)", color: "var(--accent)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                    Solo hoy
                  </span>
                )}
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
                ) : filteredItems.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {dateFilter === "today"
                        ? "No hay mensajes el día de hoy"
                        : "No hay mensajes con estos filtros"}
                    </p>
                    {dateFilter === "today" && (
                      <button
                        onClick={() => setDateFilter("all")}
                        className="btn"
                        style={{
                          marginTop: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          borderRadius: 8,
                          background: "var(--surface-raised)",
                          border: "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        Ver días anteriores
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {displayedItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setReplyText("");
                          setShowFullHistory(false);
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
                            {item.aiReplied && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  background: "rgba(245,158,11,0.15)",
                                  color: "#f59e0b",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                }}
                              >
                                🤖 IA
                              </span>
                            )}
                            {item.aiSuggestedReply?.includes("REQUIERE ATENCIÓN HUMANA") && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  background: "rgba(239,68,68,0.18)",
                                  color: "#ef4444",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                  border: "1px solid rgba(239,68,68,0.3)",
                                }}
                              >
                                🚨 Humano
                              </span>
                            )}
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
                    ))}

                    {/* Botón Ver Más (10 en 10) */}
                    {hasMore && (
                      <div style={{ padding: "12px 16px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                        <button
                          onClick={() => setVisibleCount((prev) => prev + 10)}
                          style={{
                            width: "100%",
                            padding: "8px 14px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 8,
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                          }}
                        >
                          ⬇️ Ver más ({filteredItems.length - visibleCount} restantes)
                        </button>
                      </div>
                    )}
                  </>
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
                        {selectedItem.type === "COMMENT" && selectedItem.parentId && (
                          <span style={{ marginLeft: 8 }}>
                            · <a
                                href={
                                  selectedItem.platform === "FACEBOOK"
                                    ? `https://facebook.com/${selectedItem.parentId}`
                                    : `https://instagram.com/p/${selectedItem.parentId}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--accent)", textDecoration: "underline" }}
                              >
                                Ver publicación ↗
                              </a>
                          </span>
                        )}
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

                  {/* Message content & history */}
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
                    {/* Botón Ver Mensajes Anteriores si la conversación es larga */}
                    {hasMultipleMessages && !showFullHistory && (
                      <div style={{ textAlign: "center", margin: "4px 0" }}>
                        <button
                          onClick={() => setShowFullHistory(true)}
                          style={{
                            padding: "5px 14px",
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 20,
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                            (e.currentTarget as HTMLElement).style.color = "var(--text)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                          }}
                        >
                          ⬆️ Ver {senderMessages.length - 2} mensaje(s) anterior(es)
                        </button>
                      </div>
                    )}

                    {/* Renderizado de mensajes del hilo */}
                    {visibleSenderMessages.map((msgItem) => {
                      const isTarget = msgItem.id === selectedItem.id;
                      const botOrManualReply =
                        msgItem.aiSuggestedReply &&
                        !msgItem.aiSuggestedReply.includes("REQUIERE ATENCIÓN HUMANA")
                          ? msgItem.aiSuggestedReply
                          : null;

                      return (
                        <div key={msgItem.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {/* Mensaje entrante del cliente */}
                          <div
                            style={{
                              alignSelf: "flex-start",
                              maxWidth: "75%",
                            }}
                          >
                            <div
                              style={{
                                background: isTarget ? "var(--surface-raised)" : "rgba(255,255,255,0.03)",
                                border: isTarget ? "1px solid var(--accent)" : "1px solid var(--border)",
                                borderRadius: "18px 18px 18px 4px",
                                padding: "12px 16px",
                                fontSize: 14,
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                              }}
                            >
                              {msgItem.content}
                            </div>
                            <p
                              style={{
                                fontSize: 10,
                                color: "var(--text-muted)",
                                margin: "4px 0 0 8px",
                              }}
                            >
                              {msgItem.fromName || msgItem.fromExternalId} · {formatDate(msgItem.createdAt)}
                            </p>
                          </div>

                          {/* Respuesta enviada (del Bot o manual) */}
                          {msgItem.status === "ANSWERED" && (
                            <div style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
                              <div
                                style={{
                                  background: "var(--accent)",
                                  borderRadius: "18px 18px 4px 18px",
                                  padding: "12px 16px",
                                  fontSize: 14,
                                  lineHeight: 1.5,
                                  color: "white",
                                  wordBreak: "break-word",
                                  boxShadow: "0 2px 8px rgba(108,92,231,0.25)",
                                }}
                              >
                                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>{msgItem.aiReplied ? "🤖 Respuesta enviada por IA:" : "👤 Respuesta enviada:"}</span>
                                </div>
                                <div>{botOrManualReply || "✓ Respondido al cliente"}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Reply box justo después de la conversación */}
                    {selectedItem.status !== "IGNORED" && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "16px 18px",
                          background: "var(--surface-raised)",
                          border: "1px solid var(--border)",
                          borderRadius: 16,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {/* AI Suggestion Bar */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span>🤖</span> Motor IA: <strong>Groq Llama 3.3 70B</strong>
                          </span>
                          <button
                            type="button"
                            onClick={handleGenerateAiReply}
                            disabled={generatingAi}
                            style={{
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 8,
                              background: "rgba(245, 158, 11, 0.1)",
                              color: "#f59e0b",
                              border: "1px solid rgba(245, 158, 11, 0.3)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "rgba(245, 158, 11, 0.2)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "rgba(245, 158, 11, 0.1)";
                            }}
                          >
                            {generatingAi ? "✨ Generando con Groq..." : "✨ Sugerir respuesta con IA"}
                          </button>
                        </div>

                        {/* Input and Send button */}
                        <div
                          style={{
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
                      </div>
                    )}
                  </div>
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
              </div>
            </div>
          )}
        </div>
      </div>
    );
  })()}

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
