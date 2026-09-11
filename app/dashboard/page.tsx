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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function deleteBusiness(e: React.MouseEvent, id: string, businessName: string) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`¿Estás seguro de eliminar el negocio "${businessName}"? Esto desconectará sus cuentas vinculadas.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "No se pudo eliminar el negocio");
        return;
      }
      load();
    } catch {
      alert("Error al conectar con el servidor");
    } finally {
      setDeletingId(null);
    }
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
            <div
              key={b.id}
              className="card p-4 flex justify-between items-center hover:bg-white/5 transition-colors group"
            >
              <Link
                href={`/dashboard/${b.id}/connect`}
                className="flex-1 flex justify-between items-center pr-4"
              >
                <div>
                  <span className="text-sm font-medium block">{b.name}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {b._count.socialAccounts} cuenta(s) conectada(s)
                  </span>
                </div>
              </Link>
              <button
                onClick={(e) => deleteBusiness(e, b.id, b.name)}
                disabled={deletingId === b.id}
                title="Eliminar este negocio"
                className="text-xs px-2.5 py-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-all opacity-80 group-hover:opacity-100 disabled:opacity-30"
              >
                {deletingId === b.id ? "Eliminando..." : "🗑️ Eliminar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
