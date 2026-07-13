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
