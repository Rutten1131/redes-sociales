"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN";
  displayName: string;
  avatarUrl: string | null;
  externalId: string;
  expiresAt: string | null;
}

const PLATFORM_META = {
  FACEBOOK: { label: "Facebook", color: "var(--facebook)" },
  INSTAGRAM: { label: "Instagram", color: "var(--instagram)" },
  YOUTUBE: { label: "YouTube", color: "var(--youtube)" },
  LINKEDIN: { label: "LinkedIn", color: "#0A66C2" },
} as const;

export default function ConnectPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const [nowMs] = useState(() => Date.now());

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

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Cuentas conectadas</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Conecta tus páginas de Facebook, cuentas de Instagram y canales de YouTube para poder programar publicaciones en ellas.
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

      <div className="flex gap-3 mb-8 flex-wrap">
        <a href={`/api/connect/meta?businessId=${businessId}`} className="btn-primary px-4 py-2 text-sm">
          + Conectar Facebook / Instagram
        </a>
        <a
          href={`/api/connect/youtube?businessId=${businessId}`}
          className="px-4 py-2 text-sm rounded-lg font-semibold"
          style={{ background: "var(--youtube)", color: "white" }}
        >
          + Conectar YouTube
        </a>
        <a
          href={`/api/connect/linkedin?businessId=${businessId}`}
          className="px-4 py-2 text-sm rounded-lg font-semibold"
          style={{ background: "#0A66C2", color: "white" }}
        >
          + Conectar LinkedIn
        </a>
      </div>

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
              acc.expiresAt && 
              new Date(acc.expiresAt).getTime() - nowMs < 7 * 24 * 60 * 60 * 1000;
            return (
              <div key={acc.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: meta.color }}
                  >
                    {meta.label[0]}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{acc.displayName}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {meta.label}
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
