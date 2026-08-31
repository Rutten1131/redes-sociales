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
          <Link
            href={`/dashboard/${businessId}/inbox`}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              pathname.includes("/inbox") ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Bandeja de entrada
          </Link>
          <Link
            href={`/dashboard/${businessId}/ai-settings`}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              pathname.includes("/ai-settings") ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
              <path d="M12 8V4H8"/>
              <rect width="16" height="12" x="4" y="8" rx="2"/>
              <path d="M2 14h2"/>
              <path d="M20 14h2"/>
              <path d="M15 13v2"/>
              <path d="M9 13v2"/>
            </svg>
            Auto-Respuesta IA
          </Link>
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
