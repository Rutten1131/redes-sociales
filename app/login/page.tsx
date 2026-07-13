"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Error al registrar");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Email o contraseña incorrectos");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6">
          <div className="flex gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--facebook)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--instagram)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--youtube)" }} />
          </div>
          <h1 className="text-xl font-semibold">
            {mode === "login" ? "Entrar al panel" : "Crear cuenta"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {mode === "login"
              ? "Programa contenido en Facebook, Instagram y YouTube."
              : "Regístrate para conectar tus cuentas y programar publicaciones."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <input
              type="text"
              placeholder="Nombre"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full px-3 py-2 text-sm"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Contraseña"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input w-full px-3 py-2 text-sm"
          />

          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2 text-sm"
          >
            {loading ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="text-sm mt-4 w-full text-center hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
        </button>
      </div>
    </main>
  );
}
