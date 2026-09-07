"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
