import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type OtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Finishing sign-in…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);

        const url = new URL(window.location.href);

        // Supabase can pass errors in query
        const qErr = url.searchParams.get("error");
        const qErrDesc = url.searchParams.get("error_description");
        if (qErr) throw new Error(qErrDesc ? `${qErr}: ${qErrDesc}` : qErr);

        const code = url.searchParams.get("code");
        const token_hash = url.searchParams.get("token_hash") || url.searchParams.get("token");
        const typeParam = (url.searchParams.get("type") || "signup") as OtpType;

        if (code) {
          setStatus("Exchanging code for session…");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (token_hash) {
          setStatus("Verifying link…");
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: typeParam,
          });
          if (error) throw error;
        } else {
          setStatus("Checking session…");
        }

        // Confirm we have a session now
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) throw new Error("No session found. Try logging in again.");

        // Apply referral ONCE (and DO NOT ignore rpc errors)
        const refFromUrl = (url.searchParams.get("ref") || "").trim();
        if (refFromUrl) localStorage.setItem("referral_code", refFromUrl);

        const ref = (refFromUrl || localStorage.getItem("referral_code") || "").trim();
        if (ref) {
          const userId = s.session.user.id; // <-- use the current logged-in user
          const onceKey = `referral_apply_attempted:${userId}:${ref}`;

          if (sessionStorage.getItem(onceKey)) {
            setStatus("Referral already applied. Redirecting.");
            navigate("/rewards", { replace: true });
            return;
          }

          sessionStorage.setItem(onceKey, "1");


          setStatus("Applying referral…");
          const { data, error: rpcErr } = await supabase.rpc("apply_referral", { ref_code: ref });
          if (rpcErr) {
            sessionStorage.removeItem(onceKey);
            throw rpcErr;
          }

          // helpful for debugging:
          console.log("apply_referral result:", data);

          localStorage.removeItem("referral_code");
        }

        setStatus("Done. Redirecting…");
        navigate("/rewards", { replace: true });
      } catch (e: any) {
        console.error(e);
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
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
              >
                Go to Login
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
