"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN";
  displayName: string;
  avatarUrl: string | null;
}

interface MediaItem {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  order: number;
}

interface ScheduledPost {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN";
  type: string;
  caption: string | null;
  mediaUrl: string;
  scheduledAt: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  errorMessage: string | null;
  socialAccount: { displayName: string; avatarUrl: string | null };
  mediaItems?: MediaItem[];
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Programado", color: "var(--warning)" },
  PUBLISHING: { label: "Publicando…", color: "var(--accent)" },
  PUBLISHED: { label: "Publicado", color: "var(--success)" },
  FAILED: { label: "Falló", color: "var(--danger)" },
  DRAFT: { label: "Borrador", color: "var(--text-muted)" },
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const YEARS = [2026, 2027, 2028];

// Component to handle rendering carousels with simple slider dots
function CarouselPreview({ items }: { items: { url: string; type: "IMAGE" | "VIDEO" }[] }) {
  const [index, setIndex] = useState(0);

  if (items.length === 0) {
    return <span className="text-xs text-gray-500">Ningún archivo subido</span>;
  }

  const current = items[index];

  return (
    <div className="relative w-full h-full group">
      {current.type === "VIDEO" ? (
        <video src={current.url} controls className="w-full h-full object-cover" />
      ) : (
        <img src={current.url} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
      )}

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((index - 1 + items.length) % items.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((index + 1) % items.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {items.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar view states
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [postType, setPostType] = useState("FEED_POST");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [carouselItems, setCarouselItems] = useState<{ url: string; type: "IMAGE" | "VIDEO" }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduledTime, setScheduledTime] = useState("12:00");

  // Editing state
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editMediaUrl, setEditMediaUrl] = useState("");
  const [editUploading, setEditUploading] = useState(false);

  // Preview tab state
  const [previewTab, setPreviewTab] = useState<"FACEBOOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN">("FACEBOOK");

  // Day posts filter tab
  const [dayFilter, setDayFilter] = useState<"ALL" | "FACEBOOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN">("ALL");

  async function loadData() {
    if (!businessId) return;
    setLoading(true);
    try {
      const [accountsRes, postsRes] = await Promise.all([
        fetch(`/api/accounts?businessId=${businessId}`),
        fetch(`/api/posts/schedule?businessId=${businessId}`),
      ]);
      const accountsData = await accountsRes.json();
      const postsData = await postsRes.json();
      setAccounts(accountsData.accounts ?? []);
      setPosts(postsData.posts ?? []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [businessId]);

  // Set default preview tab when accounts or selected accounts change
  useEffect(() => {
    if (selectedAccountIds.length > 0) {
      const firstSelected = accounts.find(a => selectedAccountIds.includes(a.id));
      if (firstSelected) {
        setPreviewTab(firstSelected.platform);
      }
    }
  }, [selectedAccountIds, accounts]);

  const getCompatibleAccounts = (type: string) => {
    return accounts.filter(acc => {
      if (type === "FEED_POST") {
        return acc.platform === "FACEBOOK" || acc.platform === "INSTAGRAM" || acc.platform === "LINKEDIN";
      }
      if (type === "VIDEO_NORMAL") {
        return true;
      }
      if (type === "REEL") {
        return acc.platform === "FACEBOOK" || acc.platform === "INSTAGRAM" || acc.platform === "YOUTUBE";
      }
      if (type === "STORY") {
        return acc.platform === "FACEBOOK" || acc.platform === "INSTAGRAM";
      }
      if (type === "CAROUSEL") {
        return acc.platform === "FACEBOOK" || acc.platform === "INSTAGRAM" || acc.platform === "LINKEDIN";
      }
      return false;
    });
  };

  // Auto-check all compatible accounts when post type changes or accounts load
  useEffect(() => {
    if (accounts.length > 0) {
      const compatible = getCompatibleAccounts(postType);
      setSelectedAccountIds(compatible.map(a => a.id));
    }
  }, [postType, accounts]);

  // Reset media type state when postType changes
  useEffect(() => {
    setMediaUrl("");
    setMediaFile(null);
    setCarouselItems([]);
    setUploadProgress("");
  }, [postType]);

  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 1 = Monday...)
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust so Monday is 0, Sunday is 6
  };

  // Generate calendar cells
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  const calendarCells: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month fill cells
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarCells.push({
      date: new Date(prevYear, prevMonth, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  // Current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      date: new Date(currentYear, currentMonth, i),
      isCurrentMonth: true,
    });
  }

  // Next month fill cells to complete grid row (7 columns)
  const remaining = 42 - calendarCells.length; // 6 rows * 7 columns = 42
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  for (let i = 1; i <= remaining; i++) {
    calendarCells.push({
      date: new Date(nextYear, nextMonth, i),
      isCurrentMonth: false,
    });
  }

  const getPostsForDate = (date: Date) => {
    return posts.filter(post => {
      const postDate = new Date(post.scheduledAt);
      return (
        postDate.getFullYear() === date.getFullYear() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getDate() === date.getDate()
      );
    });
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setFormError(null);
    setUploading(true);
    setUploadProgress("Subiendo archivo a BunnyCDN…");

    try {
      const singleFile = files[0];
      const formData = new FormData();
      formData.append("file", singleFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al subir archivo");
      }

      const data = await res.json();
      const isVideo = singleFile.type.startsWith("video") || singleFile.name.endsWith(".mp4") || singleFile.name.endsWith(".mov");

      if (postType === "CAROUSEL") {
        setCarouselItems([...carouselItems, { url: data.url, type: isVideo ? "VIDEO" : "IMAGE" }]);
        setUploadProgress(`✓ Subido slide ${carouselItems.length + 1} con éxito`);
      } else {
        setMediaFile(singleFile);
        setMediaUrl(data.url);
        setUploadProgress(`✓ Subido con éxito`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al subir archivo");
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (selectedAccountIds.length === 0) {
      setFormError("Selecciona al menos una cuenta social.");
      return;
    }

    if (postType === "CAROUSEL") {
      if (carouselItems.length < 2) {
        setFormError("Por favor sube al menos 2 archivos para el carrusel.");
        return;
      }
    } else {
      if (!mediaUrl) {
        setFormError("Por favor sube una imagen o un video.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const [hours, minutes] = scheduledTime.split(":");
      const postDate = new Date(selectedDate);
      postDate.setHours(parseInt(hours, 10));
      postDate.setMinutes(parseInt(minutes, 10));
      postDate.setSeconds(0);

      const payload = {
        socialAccountIds: selectedAccountIds,
        type: postType,
        caption: caption || undefined,
        scheduledAt: postDate.toISOString(),
        ...(postType === "CAROUSEL"
          ? { mediaItems: carouselItems }
          : { mediaUrl }),
      };

      const res = await fetch(`/api/posts/schedule?businessId=${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "No se pudo programar la publicación.");
      }

      setShowForm(false);
      setMediaUrl("");
      setMediaFile(null);
      setCarouselItems([]);
      setUploadProgress("");
      setCaption("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ocurrió un error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPost) return;
    try {
      const [hours, minutes] = editTime.split(":");
      const postDate = new Date(editDate + "T00:00:00");
      postDate.setHours(parseInt(hours, 10));
      postDate.setMinutes(parseInt(minutes, 10));
      postDate.setSeconds(0);

      const payload: Record<string, unknown> = {
        id: editingPost.id,
        caption: editCaption,
        scheduledAt: postDate.toISOString(),
      };
      if (editMediaUrl && editMediaUrl !== editingPost.mediaUrl) {
        payload.mediaUrl = editMediaUrl;
      }

      const res = await fetch(`/api/posts/schedule?businessId=${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("No se pudo guardar la edición.");
      }
      setEditingPost(null);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al editar");
    }
  }

  async function handleEditFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Error al subir archivo");
      const data = await res.json();
      setEditMediaUrl(data.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir archivo");
    } finally {
      setEditUploading(false);
    }
  }

  const toggleAccountSelection = (id: string) => {
    if (selectedAccountIds.includes(id)) {
      setSelectedAccountIds(selectedAccountIds.filter(x => x !== id));
    } else {
      setSelectedAccountIds([...selectedAccountIds, id]);
    }
  };

  const removeCarouselItem = (idxToRemove: number) => {
    setCarouselItems(carouselItems.filter((_, idx) => idx !== idxToRemove));
  };

  const ALL_FORMATS = [
    { value: "FEED_POST", label: "Post" },
    { value: "VIDEO_NORMAL", label: "Video normal" },
    { value: "REEL", label: "Reel" },
    { value: "STORY", label: "Historia" },
    { value: "CAROUSEL", label: "Carrusel" },
  ];

  // Highlight selected tab in mockup preview
  const activePreviewAccount = accounts.find(
    a => a.platform === previewTab && (selectedAccountIds.length === 0 || selectedAccountIds.includes(a.id))
  ) || accounts.find(a => a.platform === previewTab) || { displayName: "Tu Cuenta", avatarUrl: null };

  const selectedDayPosts = getPostsForDate(selectedDate);

  const previewMediaItems = postType === "CAROUSEL"
    ? carouselItems
    : mediaUrl
      ? [{ url: mediaUrl, type: (mediaFile?.type.startsWith("video") || mediaUrl.endsWith(".mp4") || mediaUrl.endsWith(".mov") ? "VIDEO" as const : "IMAGE" as const) }]
      : [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Calendario de Publicaciones</h1>
          <p className="text-sm text-gray-400">
            Organiza, programa y previsualiza tus posts por día.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setShowForm(!showForm);
          }}
          className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
          disabled={accounts.length === 0}
        >
          {showForm ? "Cerrar Programador" : "Nueva Publicación"}
        </button>
      </div>

      {accounts.length === 0 && !loading && (
        <div className="card p-6 text-center border-dashed border-red-500/50 mb-6">
          <p className="text-sm text-gray-300">
            Primero conecta al menos una cuenta en{" "}
            <a href={`/dashboard/${businessId}/connect`} className="underline font-semibold text-blue-400">
              Cuentas conectadas
            </a>{" "}
            para poder usar el calendario.
          </p>
        </div>
      )}

      {showForm ? (
        /* PROGRAMMER FORM & PREVIEW PANEL */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Form Side */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Programar para el {selectedDate.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</h2>
            
            {/* Accounts Select Checkboxes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300 block">Publicar en:</label>
                <span className="text-[10px] text-gray-500 italic">Solo cuentas compatibles con "{ALL_FORMATS.find(f => f.value === postType)?.label}"</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {getCompatibleAccounts(postType).map(acc => {
                  const isChecked = selectedAccountIds.includes(acc.id);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccountSelection(acc.id)}
                      className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        isChecked
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-white/10 hover:bg-white/5 text-gray-400"
                      }`}
                    >
                      <span className="text-xs font-semibold uppercase">{acc.platform}</span>
                      <span className="text-sm font-medium truncate block mt-1">{acc.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Post Type Select */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Tipo de Formato:</label>
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value)}
                  className="input w-full px-3 py-2 text-sm bg-[#121214] border-white/10"
                >
                  {ALL_FORMATS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Hora de publicación:</label>
                <input
                  type="time"
                  required
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="input w-full px-3 py-2 text-sm bg-[#121214] border-white/10"
                />
              </div>
            </div>

            {/* Carousel Uploads display if Carousel type */}
            {postType === "CAROUSEL" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 block">Elementos del Carrusel ({carouselItems.length}/10):</label>
                {carouselItems.length > 0 && (
                  <div className="flex gap-2 flex-wrap p-2 border border-white/10 rounded-lg bg-black/20">
                    {carouselItems.map((item, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded overflow-hidden border border-white/15 bg-zinc-900 flex items-center justify-center">
                        {item.type === "VIDEO" ? (
                          <video src={item.url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={item.url} alt="Carousel item" className="w-full h-full object-cover" />
                        )}
                        <span className="absolute top-0 left-0 bg-black/70 text-white text-[9px] font-bold px-1 rounded-br">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCarouselItem(idx)}
                          className="absolute bottom-0 right-0 bg-red-600/80 hover:bg-red-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-tl"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Media Upload Area */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 block">
                {postType === "CAROUSEL" ? "Agregar archivo multimedia al carrusel:" : "Archivo multimedia:"}
              </label>
              <label
                className="card p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors border-dashed border-2 border-white/10 rounded-lg"
              >
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading || (postType === "CAROUSEL" && carouselItems.length >= 10)}
                />
                {uploading ? (
                  <div className="text-center">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-blue-400">{uploadProgress}</p>
                  </div>
                ) : postType === "CAROUSEL" ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-200">
                      {carouselItems.length >= 10 ? "Límite de 10 elementos alcanzado" : "+ Agregar foto o video a BunnyCDN"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">El carrusel de Instagram soporta entre 2 y 10 elementos</p>
                  </div>
                ) : mediaUrl ? (
                  <div className="text-center">
                    <p className="text-sm text-green-400 font-medium">{uploadProgress}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{mediaUrl}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-200">Subir foto o video a BunnyCDN</p>
                    <p className="text-xs text-gray-500 mt-1">Soporta formatos comunes de imágenes y videos</p>
                  </div>
                )}
              </label>
            </div>

            {/* Caption Textarea */}
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Descripción / Copia:</label>
              <textarea
                placeholder="Escribe lo que acompañará tu publicación..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="input w-full px-3 py-2 text-sm bg-[#121214] border-white/10 resize-none"
              />
            </div>

            {formError && (
              <p className="text-sm text-red-500">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || uploading}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              {submitting ? "Programando..." : "Programar Publicación"}
            </button>
          </form>

          {/* Live Mockup Preview Side */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="flex bg-[#121214] border border-white/10 rounded-t-lg overflow-hidden shrink-0 flex-wrap">
              {[
                { key: "FACEBOOK" as const, label: "Facebook", border: "border-blue-500" },
                { key: "INSTAGRAM" as const, label: "Instagram", border: "border-pink-500" },
                { key: "YOUTUBE" as const, label: "YouTube", border: "border-red-500" },
                { key: "LINKEDIN" as const, label: "LinkedIn", border: "border-blue-400" },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPreviewTab(tab.key)}
                  className={`flex-1 min-w-[70px] py-2.5 text-xs font-semibold transition-all ${
                    previewTab === tab.key ? `bg-white/5 border-b-2 ${tab.border} text-white` : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 card rounded-t-none border-t-0 p-6 flex items-center justify-center min-h-[350px]">
              {/* FACEBOOK PREVIEW */}
              {previewTab === "FACEBOOK" && (
                <div className="w-full max-w-sm bg-[#1e1f20] border border-white/10 rounded-lg p-4 text-white text-sm shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs uppercase text-white">
                      {activePreviewAccount.displayName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-xs">{activePreviewAccount.displayName}</p>
                      <p className="text-[10px] text-gray-400">Hace un momento · 🌐</p>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-xs mb-3 text-gray-200 min-h-[14px]">
                    {caption || "Escribe una descripción en el formulario para ver la vista previa..."}
                  </p>
                  <div className="aspect-video w-full rounded-md bg-black/40 overflow-hidden flex items-center justify-center border border-white/5">
                    <CarouselPreview items={previewMediaItems} />
                  </div>
                </div>
              )}

              {/* INSTAGRAM PREVIEW */}
              {previewTab === "INSTAGRAM" && (
                <div className="w-full max-w-xs bg-black border border-white/10 rounded-lg overflow-hidden text-white text-xs shadow-md">
                  <div className="flex items-center gap-2 p-3 border-b border-white/5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-500 to-purple-600 flex items-center justify-center font-bold text-[10px] uppercase text-white">
                      {activePreviewAccount.displayName[0]}
                    </div>
                    <p className="font-semibold">{activePreviewAccount.displayName}</p>
                  </div>
                  
                  <div className="aspect-square w-full bg-zinc-900 overflow-hidden flex items-center justify-center">
                    <CarouselPreview items={previewMediaItems} />
                  </div>

                  {/* Actions bar */}
                  <div className="p-3 space-y-2">
                    <div className="flex gap-3 text-lg">
                      <span>♥</span>
                      <span>💬</span>
                      <span>✈</span>
                    </div>
                    <p>
                      <span className="font-semibold mr-1.5">{activePreviewAccount.displayName}</span>
                      <span className="text-gray-300 whitespace-pre-wrap">{caption}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* YOUTUBE PREVIEW */}
              {previewTab === "YOUTUBE" && (
                <div className="w-full max-w-sm bg-[#0f0f0f] border border-white/10 rounded-lg p-3 text-white text-xs shadow-md">
                  <div className="aspect-video w-full rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center mb-3">
                    <CarouselPreview items={previewMediaItems} />
                  </div>
                  <h3 className="font-bold text-sm line-clamp-2">
                    {postType === "SHORT" ? "#Shorts" : ""} {caption ? caption.slice(0, 60) : "Título del Video"}
                  </h3>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center font-bold text-xs uppercase text-white">
                      {activePreviewAccount.displayName[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{activePreviewAccount.displayName}</p>
                      <p className="text-[10px] text-gray-400">Hace un momento</p>
                    </div>
                  </div>
                </div>
              )}

              {/* LINKEDIN PREVIEW */}
              {previewTab === "LINKEDIN" && (
                <div className="w-full max-w-sm bg-[#1e1f20] border border-white/10 rounded-lg p-4 text-white text-sm shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#0A66C2] flex items-center justify-center font-bold text-xs uppercase text-white">
                      {activePreviewAccount.displayName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-xs">{activePreviewAccount.displayName}</p>
                      <p className="text-[10px] text-gray-400">Hace un momento · 🌐</p>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-xs mb-3 text-gray-200 min-h-[14px]">
                    {caption || "Escribe una descripción..."}
                  </p>
                  <div className="aspect-video w-full rounded-md bg-black/40 overflow-hidden flex items-center justify-center border border-white/5">
                    <CarouselPreview items={previewMediaItems} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* MONTH GRID CALENDAR — Compact */}
      <div className="w-full card p-4">
        {/* Calendar Header / Navigation */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
              className="bg-white/5 border border-white/10 text-white rounded px-2 py-0.5 text-xs font-medium focus:outline-none"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>

            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
              className="bg-white/5 border border-white/10 text-white rounded px-2 py-0.5 text-xs font-medium focus:outline-none"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-1">
            <button
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded border border-white/10 hover:bg-white/5 flex items-center justify-center text-xs"
            >
              ←
            </button>
            <button
              onClick={handleNextMonth}
              className="w-7 h-7 rounded border border-white/10 hover:bg-white/5 flex items-center justify-center text-xs"
            >
              →
            </button>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-gray-400 mb-1">
          <div>Lun</div>
          <div>Mar</div>
          <div>Mié</div>
          <div>Jue</div>
          <div>Vie</div>
          <div>Sáb</div>
          <div>Dom</div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            const dateString = cell.date.toDateString();
            const isSelected = selectedDate.toDateString() === dateString;
            const cellPosts = getPostsForDate(cell.date);

            return (
              <button
                key={idx}
                onClick={() => {
                  setSelectedDate(cell.date);
                  setDayFilter("ALL");
                  setFormError(null);
                }}
                className={`py-1.5 px-1 rounded-md border text-left flex flex-col items-center transition-all relative ${
                  cell.isCurrentMonth ? "bg-[#121214]" : "bg-white/[0.02] opacity-40"
                } ${
                  isSelected
                    ? "border-blue-500 ring-1 ring-blue-500 text-white"
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                <span className={`text-[11px] font-semibold ${isSelected ? "text-blue-400" : "text-gray-300"}`}>
                  {cell.date.getDate()}
                </span>

                {/* Indicators for posts */}
                {cellPosts.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                    {cellPosts.slice(0, 3).map(post => {
                      let dotColor = "bg-blue-500";
                      if (post.platform === "INSTAGRAM") dotColor = "bg-pink-500";
                      if (post.platform === "YOUTUBE") dotColor = "bg-red-500";
                      if (post.platform === "LINKEDIN") dotColor = "bg-sky-500";
                      return (
                        <span
                          key={post.id}
                          className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                          title={`${post.platform}: ${post.type}`}
                        />
                      );
                    })}
                    {cellPosts.length > 3 && (
                      <span className="text-[7px] leading-none text-gray-400 font-bold">
                        +{cellPosts.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day View - Side-by-Side Previews */}
      <div className="card p-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 mb-4">
          <div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Publicaciones del día</span>
            <h3 className="text-xl font-bold mt-0.5">
              {selectedDate.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h3>
          </div>
          <button
            onClick={() => {
              setFormError(null);
              setShowForm(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold mt-2 sm:mt-0"
          >
            + Agregar Publicación a este día
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-lg w-fit flex-wrap">
          {[
            { key: "ALL" as const, label: "Todos", color: "text-white" },
            { key: "FACEBOOK" as const, label: "Facebook", color: "text-blue-400" },
            { key: "INSTAGRAM" as const, label: "Instagram", color: "text-pink-400" },
            { key: "YOUTUBE" as const, label: "YouTube", color: "text-red-400" },
            { key: "LINKEDIN" as const, label: "LinkedIn", color: "text-sky-400" },
          ].map(tab => {
            const count = tab.key === "ALL"
              ? selectedDayPosts.length
              : selectedDayPosts.filter(p => p.platform === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setDayFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  dayFilter === tab.key
                    ? `bg-white/10 ${tab.color}`
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                {tab.label}{count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : selectedDayPosts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 font-medium">No hay publicaciones programadas para este día.</p>
          </div>
        ) : (() => {
          const filteredPosts = dayFilter === "ALL"
            ? selectedDayPosts
            : selectedDayPosts.filter(p => p.platform === dayFilter);
          return filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">No hay publicaciones de {dayFilter} para este día.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const status = STATUS_META[post.status];
              const isVideo = post.mediaUrl.endsWith(".mp4") || post.mediaUrl.endsWith(".mov");

              const carouselMedias = post.type === "CAROUSEL" && post.mediaItems
                ? post.mediaItems.map(i => ({ url: i.url, type: i.type }))
                : post.mediaUrl ? [{ url: post.mediaUrl, type: isVideo ? ("VIDEO" as const) : ("IMAGE" as const) }] : [];

              return (
                <div key={post.id} className="flex flex-col border border-white/10 rounded-lg overflow-hidden bg-[#121214] shadow-lg">
                  {/* Card Header with Status and Platform info */}
                  <div className="p-3 border-b border-white/5 bg-black/20 flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      post.platform === "FACEBOOK" ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" :
                      post.platform === "INSTAGRAM" ? "bg-pink-600/10 text-pink-400 border border-pink-600/20" :
                      post.platform === "LINKEDIN" ? "bg-sky-600/10 text-sky-400 border border-sky-600/20" :
                      "bg-red-600/10 text-red-400 border border-red-600/20"
                    }`}>
                      {post.platform} · {post.type}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {new Date(post.scheduledAt).toLocaleTimeString("es", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Visual Mockup Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    {/* FB Layout */}
                    {post.platform === "FACEBOOK" && (
                      <div className="text-white text-xs space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-[10px] uppercase text-white">
                            {post.socialAccount.displayName[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-[11px]">{post.socialAccount.displayName}</p>
                            <p className="text-[9px] text-gray-400">Programado</p>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-gray-200 line-clamp-3">
                          {post.caption || "Sin descripción"}
                        </p>
                        <div className="aspect-video w-full rounded-md bg-black/40 overflow-hidden flex items-center justify-center border border-white/5">
                          <CarouselPreview items={carouselMedias} />
                        </div>
                      </div>
                    )}

                    {/* IG Layout */}
                    {post.platform === "INSTAGRAM" && (
                      <div className="text-white text-xs space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-500 to-purple-600 flex items-center justify-center font-bold text-[9px] uppercase text-white">
                            {post.socialAccount.displayName[0]}
                          </div>
                          <p className="font-semibold text-[11px]">{post.socialAccount.displayName}</p>
                        </div>
                        <div className="aspect-square w-full rounded-md bg-black/40 overflow-hidden flex items-center justify-center border border-white/5">
                          <CarouselPreview items={carouselMedias} />
                        </div>
                        <p className="line-clamp-2">
                          <span className="font-semibold mr-1">{post.socialAccount.displayName}</span>
                          <span className="text-gray-300">{post.caption}</span>
                        </p>
                      </div>
                    )}

                    {/* YT Layout */}
                    {post.platform === "YOUTUBE" && (
                      <div className="text-white text-xs space-y-2">
                        <div className="aspect-video w-full rounded-md bg-black/40 overflow-hidden flex items-center justify-center border border-white/5">
                          <CarouselPreview items={carouselMedias} />
                        </div>
                        <h4 className="font-bold line-clamp-2 text-gray-100">
                          {post.type === "SHORT" ? "#Shorts " : ""}{post.caption || "Título del Video"}
                        </h4>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center font-bold text-[9px] uppercase text-white">
                            {post.socialAccount.displayName[0]}
                          </div>
                          <span className="font-semibold text-gray-300 text-[10px]">{post.socialAccount.displayName}</span>
                        </div>
                      </div>
                    )}

                    {/* LINKEDIN Layout */}
                    {post.platform === "LINKEDIN" && (
                      <div className="text-white text-xs space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#0A66C2] flex items-center justify-center font-bold text-[10px] uppercase text-white">
                            {post.socialAccount.displayName[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-[11px]">{post.socialAccount.displayName}</p>
                            <p className="text-[9px] text-gray-400">Programado</p>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-gray-200 line-clamp-3">
                          {post.caption || "Sin descripción"}
                        </p>
                        <div className="aspect-video w-full rounded-md bg-black/40 overflow-hidden flex items-center justify-center border border-white/5">
                          <CarouselPreview items={carouselMedias} />
                        </div>
                      </div>
                    )}

                    {/* Error display if failed */}
                    {post.status === "FAILED" && post.errorMessage && (
                      <p className="text-[10px] text-red-500 bg-red-950/20 p-2 rounded border border-red-500/20">
                         Error: {post.errorMessage}
                      </p>
                    )}

                    {/* Card Footer with Actions and Status */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPost(post);
                            setEditCaption(post.caption || "");
                            setEditMediaUrl(post.mediaUrl || "");
                            const date = new Date(post.scheduledAt);
                            setEditDate(date.toISOString().split("T")[0]);
                            const hours = String(date.getHours()).padStart(2, "0");
                            const minutes = String(date.getMinutes()).padStart(2, "0");
                            setEditTime(`${hours}:${minutes}`);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Editar
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("¿Eliminar esta publicación programada?")) return;
                            await fetch(`/api/posts/schedule?id=${post.id}`, { method: "DELETE" });
                            loadData();
                          }}
                          className="text-red-400 hover:text-red-300 font-semibold"
                        >
                          Borrar
                        </button>
                      </div>
                      <span className="font-bold" style={{ color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          );
        })()}
      </div>
      {/* Editing Modal overlay */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleEditSubmit} className="card p-6 w-full max-w-lg space-y-4 bg-[#121214] border border-white/10 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">Editar Publicación Programada</h3>

            {/* Media preview + change */}
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1">Imagen / Video:</label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                  {editMediaUrl ? (
                    editMediaUrl.match(/\.(mp4|mov|webm)($|\?)/i) ? (
                      <video src={editMediaUrl} className="w-full h-full object-cover" />
                    ) : (
                      <img src={editMediaUrl} alt="Preview" className="w-full h-full object-cover" />
                    )
                  ) : (
                    <span className="text-[9px] text-gray-500">Sin archivo</span>
                  )}
                </div>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleEditFileSelect}
                    className="hidden"
                    disabled={editUploading}
                  />
                  <div className="px-3 py-2 border border-dashed border-white/15 rounded-lg text-center hover:bg-white/5 transition-colors">
                    {editUploading ? (
                      <span className="text-xs text-blue-400">Subiendo...</span>
                    ) : (
                      <span className="text-xs text-gray-300">Cambiar archivo multimedia</span>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1">Descripción:</label>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={4}
                className="input w-full px-3 py-2 text-sm bg-[#0a0a0b] border-white/10 resize-none text-white"
              />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">Fecha:</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="input w-full px-3 py-2 text-sm bg-[#0a0a0b] border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">Hora:</label>
                <input
                  type="time"
                  required
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="input w-full px-3 py-2 text-sm bg-[#0a0a0b] border-white/10 text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-xs font-semibold text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editUploading}
                className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
