"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function SidebarNav() {
  const pathname = usePathname();
  const segments = pathname.split("/");

  // Si la ruta es /dashboard/[businessId]/...
  // segments[0] = "", segments[1] = "dashboard", segments[2] = businessId
  const businessId =
    segments[1] === "dashboard" &&
    segments[2] &&
    segments[2] !== "connect" &&
    segments[2] !== "calendar"
      ? segments[2]
      : null;

  // Badge count de TikTok pendientes
  const [tiktokCount, setTiktokCount] = useState(0);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch(`/api/tiktok/count?businessId=${businessId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTiktokCount(data.count ?? 0);
      } catch {
        // silently ignore
      }
    }

    fetchCount();
    // Refrescar cada 60 segundos
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [businessId]);

  return (
    <nav className="flex flex-col gap-1 text-sm">
      {businessId ? (
        <>
          <Link
            href={`/dashboard/${businessId}/connect`}
            className={`px-3 py-2 rounded-lg transition-colors ${
              pathname.includes("/connect") ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            Cuentas conectadas
          </Link>
          <Link
            href={`/dashboard/${businessId}/calendar`}
            className={`px-3 py-2 rounded-lg transition-colors ${
              pathname.includes("/calendar") ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            Calendario
          </Link>

          {/* TikTok Pendientes */}
          <Link
            href={`/dashboard/${businessId}/tiktok-pendientes`}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
              pathname.includes("/tiktok-pendientes") ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "#ff0050" }}>
                <TikTokIcon />
              </span>
              <span className="font-medium">TikTok Pendientes</span>
            </div>
            {tiktokCount > 0 && (
              <span
                style={{
                  background: "#ff0050",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 999,
                  minWidth: 20,
                  height: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 6px",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              >
                {tiktokCount}
              </span>
            )}
          </Link>

          <div className="my-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="px-3 text-[11px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
              Canales de Atención
            </span>
          </div>

          {/* Sección Comentarios */}
          <div className="flex flex-col gap-0.5 mb-1">
            <Link
              href={`/dashboard/${businessId}/inbox?type=COMMENT`}
              className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-between group ${
                pathname.includes("/inbox") && typeof window !== "undefined" && window.location.search.includes("type=COMMENT")
                  ? "bg-white/10"
                  : pathname.includes("/inbox")
                  ? "hover:bg-white/5"
                  : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <span className="font-medium">Comentarios</span>
              </div>
              <span
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `/dashboard/${businessId}/ai-settings?tab=comments`;
                }}
                title="Configurar Objetivo IA para Comentarios"
                className="opacity-60 hover:opacity-100 hover:text-amber-400 p-1 transition-all"
              >
                ⚙️
              </span>
            </Link>
          </div>

          {/* Sección Mensajes Directos (DMs) */}
          <div className="flex flex-col gap-0.5 mb-2">
            <Link
              href={`/dashboard/${businessId}/inbox?type=DM`}
              className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-between group ${
                pathname.includes("/inbox") && typeof window !== "undefined" && window.location.search.includes("type=DM")
                  ? "bg-white/10"
                  : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">✉️</span>
                <span className="font-medium">Mensajes Directos (DMs)</span>
              </div>
              <span
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `/dashboard/${businessId}/ai-settings?tab=dms`;
                }}
                title="Configurar Objetivo IA para DMs"
                className="opacity-60 hover:opacity-100 hover:text-amber-400 p-1 transition-all"
              >
                ⚙️
              </span>
            </Link>
          </div>

          <div className="h-px my-2" style={{ background: "var(--border)" }} />
        </>
      ) : null}
      <Link
        href="/dashboard"
        className="px-3 py-2 rounded-lg hover:bg-white/5 transition-colors font-medium"
      >
        {businessId ? "← Tus negocios" : "Tus negocios"}
      </Link>
    </nav>
  );
}
