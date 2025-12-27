import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Mode = "signup" | "login";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Use env-defined site URL for production-safe redirects (Vercel), fallback to current origin for dev.
  const SITE_URL = useMemo(() => {
    const envUrl = (import.meta as any).env?.VITE_SITE_URL as string | undefined;
    return (envUrl && envUrl.trim()) ? envUrl.trim().replace(/\/+$/, "") : window.location.origin;
  }, []);

  // Mode (auto based on route, but still toggleable)
  const [mode, setMode] = useState<Mode>("signup");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  // banner messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // referral + logged-in handling
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [alreadyLoggedInWithReferral, setAlreadyLoggedInWithReferral] = useState(false);

  // If you render this page at /register, default to signup
  useEffect(() => {
    if (location.pathname === "/register") setMode("signup");
    else if (location.pathname === "/login") setMode("login");
  }, [location.pathname]);

  // Capture ?ref=XXXX (or ?code=XXXX) and store it
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = (params.get("ref") || params.get("code") || "").trim();

    if (ref) {
      localStorage.setItem("referral_code", ref);
      setReferralCode(ref);
    } else {
      setReferralCode(localStorage.getItem("referral_code"));
    }
  }, [location.search]);

  // If already logged in:
  // - normal -> go to /rewards
  // - but if user came with a referral link, DON'T redirect; show message instead.
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search);
      const hasRef = !!(params.get("ref") || params.get("code") || "").trim();

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        if (hasRef) {
          setAlreadyLoggedInWithReferral(true);
          return;
        }
        navigate("/rewards", { replace: true });
      }
    })();
  }, [navigate, location.search]);

  function getAuthCallbackUrl() {
    const ref = (localStorage.getItem("referral_code") || "").trim();
    return ref ? `${SITE_URL}/auth/callback?ref=${encodeURIComponent(ref)}` : `${SITE_URL}/auth/callback`;
  }

  async function signIn() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If this user was referred but didn't go through /auth/callback (e.g. verified elsewhere),
    // apply the referral on first successful sign-in.
    try {
      const ref = (localStorage.getItem("referral_code") || "").trim();
      if (ref) {
        const { error: rpcErr } = await supabase.rpc("apply_referral", { ref_code: ref });
        if (!rpcErr) localStorage.removeItem("referral_code");
        else console.warn("apply_referral failed:", rpcErr);
      }
    } catch (e) {
      console.warn("apply_referral threw:", e);
    }

    navigate("/rewards", { replace: true });
  }

  async function signUp() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setLoading(false);
      setError("Please enter your email.");
      return;
    }

    if (password.length < 6) {
      setLoading(false);
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // ✅ important: always redirect back to your deployed app, not localhost
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Verification email sent. Please check your inbox.");
  }

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ✅ OAuth should return to your callback route too
        redirectTo: getAuthCallbackUrl(),
      },
    });

    setLoading(false);

    if (error) setError(error.message);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-b from-violet-600 via-violet-700 to-violet-800">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl p-8">
        <h1 className="text-3xl font-semibold text-violet-700 text-center">
          {mode === "signup" ? "Create Your Account" : "Welcome Back"}
        </h1>
        <p className="text-center text-slate-500 mt-2">
          {mode === "signup" ? "Sign up to manage your tools" : "Sign in to continue"}
        </p>

        {/* Logged in + referral banner */}
        {alreadyLoggedInWithReferral && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            You’re already logged in. Referrals apply only to new accounts.
            <button
              className="ml-2 underline font-medium"
              onClick={async () => {
                await supabase.auth.signOut();
                // keep referral query string so it stays captured
                navigate(`/register${location.search}`, { replace: true });
              }}
            >
              Log out to use referral
            </button>
          </div>
        )}

        {/* Success / Error banners */}
        {success && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm flex items-center gap-2">
            <span className="inline-flex w-6 h-6 rounded-full bg-emerald-100 items-center justify-center">
              ✓
            </span>
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              className="mt-2 w-full rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="mt-2 relative">
              <input
                className="w-full rounded-xl bg-white border border-slate-200 px-4 py-3 pr-16 outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="••••••••"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-violet-600 hover:text-violet-700"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Confirm Password</label>
              <div className="mt-2 relative">
                <input
                  className="w-full rounded-xl bg-white border border-slate-200 px-4 py-3 pr-16 outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="••••••••"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-violet-600 hover:text-violet-700"
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          {/* Referral helper (optional, keep or remove) */}
          {mode === "signup" && referralCode && (
            <div className="text-xs text-slate-500">
              Referral detected: <span className="font-medium">{referralCode}</span>
            </div>
          )}

          <button
            className="w-full rounded-full bg-violet-700 hover:bg-violet-800 text-white font-medium py-3 transition disabled:opacity-60"
            onClick={mode === "signup" ? signUp : signIn}
            disabled={loading}
          >
            {loading ? "..." : mode === "signup" ? "Sign up Account" : "Sign in"}
          </button>

          <div className="flex items-center gap-3 py-2">
            <div className="h-px bg-slate-200 flex-1" />
            <div className="text-xs text-slate-400">or</div>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <button
            className="w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-3 transition disabled:opacity-60"
            onClick={signInWithGoogle}
            disabled={loading}
          >
            Sign in with Google
          </button>

          <div className="text-center text-sm text-slate-500 mt-2">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-violet-700 font-medium hover:underline"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSuccess(null);
                    navigate("/login", { replace: true });
                  }}
                >
                  Log In
                </button>
                <div className="mt-2 text-xs">
                  Or go to{" "}
                  <Link className="text-violet-700 hover:underline" to="/register">
                    /register
                  </Link>
                </div>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-violet-700 font-medium hover:underline"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setSuccess(null);
                    navigate("/register", { replace: true });
                  }}
                >
                  Create one
                </button>
                <div className="mt-2 text-xs">
                  Or go to{" "}
                  <Link className="text-violet-700 hover:underline" to="/login">
                    /login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
