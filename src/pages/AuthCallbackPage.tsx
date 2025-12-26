import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    (async () => {
      try {
        // 1) IMPORTANT: clear any existing session (old account)
        await supabase.auth.signOut();

        // 2) Exchange the code for a session
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.auth as any).exchangeCodeForSession(code);
          if (error) throw error;
        }

        // 3) Confirm we now have a session
        const { data, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;

        if (!data.session) {
          navigate("/login", { replace: true });
          return;
        }

        setMsg("Signed in ✅ Redirecting…");

        // 4) Hard redirect so EVERYTHING reloads with the new session
        window.location.replace("/rewards");
      } catch (e: any) {
        setMsg(e?.message ?? "Auth callback failed");
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-950 text-white p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">Auth Callback</div>
        <div className="mt-2 text-sm text-white/70">{msg}</div>
      </div>
    </div>
  );
}
