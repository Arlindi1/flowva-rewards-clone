import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Finishing sign-in…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // If you later switch email templates to token-hash links, this will handle them too:
        const token_hash = url.searchParams.get("token_hash") || url.searchParams.get("token");
        const type = url.searchParams.get("type") || "email";

        // Some providers put errors in query or hash
        const qErr = url.searchParams.get("error");
        const qErrDesc = url.searchParams.get("error_description");
        if (qErr) {
          throw new Error(qErrDesc ? `${qErr}: ${qErrDesc}` : qErr);
        }

        if (code) {
          setStatus("Exchanging code for session…");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (token_hash) {
          setStatus("Verifying link…");
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
          });
          if (error) throw error;
        } else {
          setStatus("Checking session…");
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          throw new Error("No session found. Try logging in again.");
        }

        navigate("/rewards", { replace: true });
      } catch (e: any) {
        setError(e?.message ?? "Could not complete sign-in.");
        setStatus("Failed.");
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-950 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-white shadow-xl">
        <h1 className="text-xl font-semibold">Auth Callback</h1>
        <p className="mt-2 text-slate-300">{status}</p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200">
            {error}
            <div className="mt-3">
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
              >
                Go to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
