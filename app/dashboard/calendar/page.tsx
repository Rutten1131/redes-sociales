"use client";

import { useEffect, useState } from "react";

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "YOUTUBE";
  displayName: string;
}

interface ScheduledPost {
  id: string;
  platform: string;
  type: string;
  caption: string | null;
  mediaUrl: string;
  scheduledAt: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  errorMessage: string | null;
  socialAccount: { displayName: string };
}

const TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  FACEBOOK: [
    { value: "FEED_POST", label: "Publicación" },
    { value: "REEL", label: "Reel" },
  ],
  INSTAGRAM: [
    { value: "FEED_POST", label: "Publicación" },
    { value: "REEL", label: "Reel" },
    { value: "STORY", label: "Historia" },
  ],
  YOUTUBE: [
    { value: "VIDEO", label: "Video" },
    { value: "SHORT", label: "Short" },
  ],
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Programado", color: "var(--warning)" },
  PUBLISHING: { label: "Publicando…", color: "var(--accent)" },
  PUBLISHED: { label: "Publicado", color: "var(--success)" },
  FAILED: { label: "Falló", color: "var(--danger)" },
  DRAFT: { label: "Borrador", color: "var(--text-muted)" },
};

export default function CalendarPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [socialAccountId, setSocialAccountId] = useState("");
  const [type, setType] = useState("FEED_POST");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  async function loadData() {
    const [accountsRes, postsRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/posts/schedule"),
    ]);
    const accountsData = await accountsRes.json();
    const postsData = await postsRes.json();
    setAccounts(accountsData.accounts ?? []);
    setPosts(postsData.posts ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedAccount = accounts.find((a) => a.id === socialAccountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/posts/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialAccountId,
          type,
          mediaUrl,
          caption: caption || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.formErrors?.[0] ?? "No se pudo programar el post");
      }
      setShowForm(false);
      setMediaUrl("");
      setCaption("");
      setScheduledAt("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ocurrió un error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  // Agrupar posts por día para la línea de tiempo
  const grouped = posts.reduce<Record<string, ScheduledPost[]>>((acc, post) => {
    const day = new Date(post.scheduledAt).toLocaleDateString("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    (acc[day] ??= []).push(post);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Calendario</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Publicaciones programadas, en curso y publicadas.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary px-4 py-2 text-sm"
          disabled={accounts.length === 0}
        >
          + Programar publicación
        </button>
      </div>

      {accounts.length === 0 && (
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Primero conecta al menos una cuenta en{" "}
          <a href="/dashboard/connect" className="underline">
            Cuentas conectadas
          </a>
          .
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-6 space-y-3">
          <select
            required
            value={socialAccountId}
            onChange={(e) => setSocialAccountId(e.target.value)}
            className="input w-full px-3 py-2 text-sm"
          >
            <option value="">Selecciona una cuenta…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.platform} — {a.displayName}
              </option>
            ))}
          </select>

          {selectedAccount && (
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input w-full px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS[selectedAccount.platform].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          <input
            type="url"
            required
            placeholder="URL pública del video/imagen (Cloudinary, S3…)"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            className="input w-full px-3 py-2 text-sm"
          />

          <textarea
            placeholder="Descripción / caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="input w-full px-3 py-2 text-sm resize-none"
          />

          <input
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="input w-full px-3 py-2 text-sm"
          />

          {formError && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>{formError}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm">
            {submitting ? "Programando…" : "Programar"}
          </button>
        </form>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No hay publicaciones programadas todavía.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayPosts]) => (
            <div key={day} className="flex gap-4">
              <div className="flex flex-col items-center pt-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                <span className="flex-1 w-px mt-1" style={{ background: "var(--border)" }} />
              </div>
              <div className="flex-1 pb-2">
                <p className="text-xs mb-2 capitalize" style={{ color: "var(--text-muted)" }}>
                  {day}
                </p>
                <div className="space-y-2">
                  {dayPosts.map((post) => {
                    const status = STATUS_META[post.status];
                    return (
                      <div key={post.id} className="card p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {post.type} · {post.socialAccount.displayName}
                          </p>
                          {post.caption && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                              {post.caption}
                            </p>
                          )}
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            {new Date(post.scheduledAt).toLocaleTimeString("es", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {post.status === "FAILED" && post.errorMessage && (
                            <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
                              {post.errorMessage}
                            </p>
                          )}
                        </div>
                        <span
                          className="text-xs shrink-0 px-2 py-1 rounded-full"
                          style={{ background: `${status.color}22`, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
