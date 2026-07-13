"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Business {
  id: string;
  name: string;
  _count: { socialAccounts: number };
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/businesses");
    const data = await res.json();
    setBusinesses(data.businesses ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Tus negocios</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Cada negocio tiene sus propias cuentas conectadas y su propio calendario.
      </p>

      <form onSubmit={createBusiness} className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del negocio (ej. CesarReyes Pymes)"
          className="input flex-1 px-3 py-2 text-sm"
        />
        <button className="btn-primary px-4 py-2 text-sm">Crear</button>
      </form>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando…</p>
      ) : (
        <div className="space-y-2">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/${b.id}/connect`}
              className="card p-4 flex justify-between items-center block hover:bg-white/5"
            >
              <span className="text-sm font-medium">{b.name}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {b._count.socialAccounts} cuenta(s) conectada(s)
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
