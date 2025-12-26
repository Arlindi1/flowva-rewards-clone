import { useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { Bell, Home, Compass, Library, Layers, CreditCard, Gift, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const nav = [
  { label: "Home", to: "/", icon: Home },
  { label: "Discover", to: "/discover", icon: Compass },
  { label: "Library", to: "/library", icon: Library },
  { label: "Tech Stack", to: "/tech-stack", icon: Layers },
  { label: "Subscriptions", to: "/subscriptions", icon: CreditCard },
  { label: "Rewards Hub", to: "/rewards", icon: Gift },
  { label: "Settings", to: "/settings", icon: Settings },
];

function cx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type SidebarUser = {
  display_name: string | null;
  email: string | null;
};

export default function AppShell({ children }: PropsWithChildren) {
  const { pathname } = useLocation();

  const [user, setUser] = useState<SidebarUser>({ display_name: null, email: null });

  const avatarLetter = useMemo(() => {
    const name = user.display_name?.trim();
    const email = user.email?.trim();
    const base = name?.[0] || email?.[0] || "U";
    return base.toUpperCase();
  }, [user.display_name, user.email]);

  const displayName = useMemo(() => user.display_name?.trim() || "User", [user.display_name]);

  const email = useMemo(() => user.email?.trim() || "", [user.email]);

  async function loadSidebarUser(sessionUserId?: string, sessionEmail?: string) {
    if (!sessionUserId) {
      setUser({ display_name: null, email: null });
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name,email")
      .eq("id", sessionUserId)
      .maybeSingle();

    if (!error && data) {
      setUser({
        display_name: data.display_name ?? null,
        email: data.email ?? sessionEmail ?? null,
      });
      return;
    }

    setUser({
      display_name: null,
      email: sessionEmail ?? null,
    });
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;

      // ✅ FIX: don't pass null; use undefined
      await loadSidebarUser(session?.user?.id, session?.user?.email);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // ✅ FIX: don't pass null; use undefined
      await loadSidebarUser(session?.user?.id, session?.user?.email);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1280px] flex">
        <aside className="w-[260px] bg-white border-r border-slate-200/70 min-h-screen px-5 py-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="text-violet-600 font-semibold text-xl">Flowwa</div>
          </div>

          <nav className="space-y-1">
            {nav.map(({ label, to, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cx(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm",
                    active ? "bg-violet-100 text-violet-700" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icon className={cx("w-4 h-4", active ? "text-violet-600" : "text-slate-500")} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 grid place-items-center font-semibold">
                {avatarLetter}
              </div>

              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{displayName}</div>
                <div className="text-xs text-slate-500 truncate">{email || "Not signed in"}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 px-10 py-8">
          <div className="flex justify-end mb-4">
            <button className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center">
              <Bell className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
