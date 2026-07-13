import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import SidebarNav from "./SidebarNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex-1 flex">
      <aside
        className="w-56 shrink-0 flex flex-col justify-between p-5"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        <div>
          <div className="flex gap-1.5 mb-8">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--facebook)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--instagram)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--youtube)" }} />
          </div>
          <SidebarNav />
        </div>

        <div>
          <p className="text-xs mb-2 truncate" style={{ color: "var(--text-muted)" }}>
            {session.user.email}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-xs hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
