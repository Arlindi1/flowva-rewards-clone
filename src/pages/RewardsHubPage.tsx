import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { claimDailyPoints, getRewardsHubData, submitSpotlightClaim } from "../features/rewards/api";
import { supabase } from "../lib/supabaseClient";
import AppShell from "../components/AppShell";
import { Calendar, Gift, Sparkles, UserPlus, Share2, Copy as CopyIcon, UploadCloud } from "lucide-react";

function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const isoUTC = (d: Date) => d.toISOString().slice(0, 10);

const dayLabelMonFirst = (d: Date) => {
  const map: Record<number, string> = { 1: "M", 2: "T", 3: "W", 4: "T", 5: "F", 6: "S", 0: "S" };
  return map[d.getUTCDay()];
};

const getWeekDaysMonFirst = (today: Date) => {
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const day = base.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  base.setUTCDate(base.getUTCDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return d;
  });
};

const computeStreak = (checkinSet: Set<string>, todayISO: string) => {
  const start = new Date(todayISO + "T00:00:00Z");
  if (!checkinSet.has(todayISO)) start.setUTCDate(start.getUTCDate() - 1);

  let streak = 0;
  let d = start;

  while (checkinSet.has(isoUTC(d))) {
    streak++;
    d = new Date(d);
    d.setUTCDate(d.getUTCDate() - 1);
  }

  return streak;
};

export default function RewardsHubPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [checkins, setCheckins] = useState<Array<{ checkin_date: string }>>([]);
  const [spotlight, setSpotlight] = useState<any>(null);

  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimModal, setClaimModal] = useState<{ open: boolean; points: number }>(() => ({ open: false, points: 0 }));

  // Spotlight modal state
  const [showSpotlightModal, setShowSpotlightModal] = useState(false);
  const [spotlightEmail, setSpotlightEmail] = useState("");
  const [spotlightFile, setSpotlightFile] = useState<File | null>(null);
  const [submittingSpotlight, setSubmittingSpotlight] = useState(false);
  const [spotlightSuccess, setSpotlightSuccess] = useState<string | null>(null);

  // ✅ Make todayISO update (so streak/calendar works if user leaves tab open)
  const [todayISO, setTodayISO] = useState(() => isoUTC(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      setTodayISO(isoUTC(new Date()));
    }, 60_000); // every 1 min is enough
    return () => clearInterval(id);
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const data = await getRewardsHubData();
      setProfile(data.profile);
      setBalance(data.balance);
      setCheckins(data.checkins);
      setSpotlight(data.spotlight);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load";
      if (msg === "No session") {
        navigate("/login", { replace: true });
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkinSet = useMemo(() => new Set(checkins.map((c) => c.checkin_date)), [checkins]);
  const claimedToday = useMemo(() => checkinSet.has(todayISO), [checkinSet, todayISO]);

  // ✅ base week view on todayISO (not on "new Date()" + stale memo)
  const weekDays = useMemo(() => getWeekDaysMonFirst(new Date(todayISO + "T00:00:00Z")), [todayISO]);
  const streakToShow = useMemo(() => computeStreak(checkinSet, todayISO), [checkinSet, todayISO]);
  const streakLabel = streakToShow === 1 ? "day" : "days";

  const progressTarget = 5000;
  const progress = Math.min(balance / progressTarget, 1);

  async function onClaimDaily() {
    try {
      setClaimingDaily(true);
      const res = await claimDailyPoints();
      setBalance(res.balance);

      if (res.awarded > 0) {
        setCheckins((prev) =>
          prev.some((x) => x.checkin_date === todayISO) ? prev : [...prev, { checkin_date: todayISO }]
        );
        setClaimModal({ open: true, points: res.awarded });
      }
    } catch (e: any) {
      setError(e?.message ?? "Claim failed");
    } finally {
      setClaimingDaily(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const spotlightPoints = spotlight?.points_reward ?? 50;

  const siteUrl =
    ((import.meta as any).env?.VITE_SITE_URL as string | undefined)?.trim().replace(/\/+$/, "") ||
    window.location.origin;

  const referralCode = (profile?.referral_code ?? "").trim();

const referralLink = referralCode
  ? `${siteUrl}/register?ref=${encodeURIComponent(referralCode)}`
  : "";

  async function copyReferral() {
    try {
      if (!referralLink) return;
      await navigator.clipboard.writeText(referralLink);
    } catch {
      // Clipboard can fail on some browsers / insecure contexts
      setError("Copy failed. Please select the link and copy it manually.");
    }
  }

  async function onSubmitSpotlightClaim() {
    if (!spotlight?.id) return;

    if (!spotlightEmail.trim()) {
      setError("Please enter the email you used on the tool.");
      return;
    }
    if (!spotlightFile) {
      setError("Please upload a screenshot.");
      return;
    }

    setSubmittingSpotlight(true);
    setError(null);
    setSpotlightSuccess(null);

    try {
      await submitSpotlightClaim({
        spotlightId: spotlight.id,
        externalEmail: spotlightEmail.trim(),
        file: spotlightFile,
      });

      setShowSpotlightModal(false);
      setSpotlightSuccess("Your claim was submitted successfully! 🎉");
      setSpotlightEmail("");
      setSpotlightFile(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit claim");
    } finally {
      setSubmittingSpotlight(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <div className="text-sm text-red-700">{error}</div>
            <div className="flex gap-2">
              <button
                onClick={load}
                className="text-sm px-3 py-1 rounded-lg bg-white border border-red-200 hover:bg-red-50"
              >
                Retry
              </button>
              <button
                onClick={() => setError(null)}
                className="text-sm px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {spotlightSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {spotlightSuccess}
          </div>
        )}

        <div className="mb-6 flex items-start gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Rewards Hub</h1>
            <p className="text-slate-500 mt-1">Earn points, unlock rewards, and celebrate your progress!</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={signOut}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium">Earn Points</button>
          <button className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Redeem Rewards</button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-violet-600 rounded-full" />
          <h2 className="text-xl font-semibold text-slate-900">Your Rewards Journey</h2>
        </div>

        {loading ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Points Balance */}
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Gift className="w-4 h-4 text-violet-600" />
                  Points Balance
                </div>

                <div className="text-4xl font-semibold text-violet-600 mt-3">{balance}</div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Progress to $5 Gift Card</span>
                    <span>
                      {balance}/{progressTarget}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-violet-500" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Just getting started — keep earning points to unlock great rewards!
                  </div>
                </div>
              </div>

              {/* Daily Streak */}
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Calendar className="w-4 h-4 text-violet-600" />
                  Daily Streak
                </div>

                <div className="text-4xl font-semibold mt-3 text-violet-600">
                  {streakToShow} {streakLabel}
                </div>

                <div className="mt-4 flex gap-2">
                  {weekDays.map((d) => {
                    const iso = isoUTC(d);
                    const isDone = checkinSet.has(iso);
                    const isToday = iso === todayISO;

                    return (
                      <div
                        key={iso}
                        className={classNames(
                          "w-9 h-9 rounded-full grid place-items-center text-sm border select-none",
                          isDone
                            ? "bg-violet-100 border-violet-300 text-violet-700"
                            : "bg-slate-100 border-slate-200 text-slate-600",
                          isToday && "ring-2 ring-violet-400 ring-offset-2 ring-offset-white"
                        )}
                      >
                        {dayLabelMonFirst(d)}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-slate-500">Check in daily to earn +5 points</div>

                <button
                  onClick={onClaimDaily}
                  disabled={claimingDaily || claimedToday}
                  className={classNames(
                    "mt-4 w-full rounded-xl px-4 py-2 text-sm font-medium transition inline-flex items-center justify-center gap-2",
                    claimedToday
                      ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                      : "bg-violet-600 text-white hover:bg-violet-500",
                    claimingDaily && "opacity-70"
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  {claimedToday ? "Claimed Today" : claimingDaily ? "Claiming…" : "Claim Today’s Points"}
                </button>
              </div>

              {/* Spotlight */}
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-violet-600 to-indigo-500 text-white">
                  <div className="inline-flex items-center px-2 py-1 rounded-full bg-white/15 text-xs font-medium">
                    Featured
                  </div>
                  <div className="mt-2 text-sm font-medium">{spotlight?.title ?? "Top Tool Spotlight"}</div>
                  <div className="text-2xl font-semibold mt-1">{spotlight?.tool_name ?? "Reclaim"}</div>
                </div>

                <div className="p-4">
                  <p className="text-sm text-slate-600">
                    {spotlight?.description ??
                      "Reclaim.ai is an AI-powered calendar assistant that automatically schedules your tasks, meetings, and breaks to boost productivity."}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <a
                      className="flex-1 text-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                      href={spotlight?.cta_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Sign up
                    </a>

                    <button
                      onClick={() => setShowSpotlightModal(true)}
                      disabled={!spotlight?.id}
                      className={classNames(
                        "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition",
                        !spotlight?.id
                          ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                          : "bg-violet-600 text-white hover:bg-violet-500"
                      )}
                    >
                      Claim {spotlightPoints} pts
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Earn More Points */}
            <div className="flex items-center gap-3 mt-8 mb-4">
              <div className="w-1 h-6 bg-violet-600 rounded-full" />
              <h2 className="text-xl font-semibold text-slate-900">Earn More Points</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <UserPlus className="w-4 h-4 text-violet-600" />
                  Refer and win 10,000 points!
                </div>
                <p className="text-sm text-slate-500 mt-1">Invite friends and earn big bonuses as they join.</p>
                <button
                  className="mt-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 text-sm"
                  onClick={copyReferral}
                  disabled={!referralLink}
                >
                  Refer friends
                </button>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Share2 className="w-4 h-4 text-violet-600" />
                  Share Your Stack
                </div>
                <p className="text-sm text-slate-500 mt-1">Tell others what you use and earn +25 points.</p>
                <button className="mt-4 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-sm">
                  Share
                </button>
              </div>
            </div>

            {/* Refer & Earn */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm mt-6 overflow-hidden">
              <div className="bg-violet-50 border-b border-slate-200 p-5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <UserPlus className="w-4 h-4 text-violet-600" />
                  Share Your Link
                </div>
                <div className="text-sm text-slate-500">Invite friends and earn 25 points when they join!</div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Referrals</div>
                    <div className="text-2xl font-semibold mt-1 text-slate-900">0</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Points Earned</div>
                    <div className="text-2xl font-semibold mt-1 text-slate-900">0</div>
                  </div>

                  <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Your referral link</div>
                    <div className="mt-2 flex gap-2">
                      <input
                        readOnly
                        className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none"
                        value={referralLink}
                        placeholder="Loading referral link…"
                      />
                      <button
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-sm disabled:opacity-60"
                        onClick={copyReferral}
                        disabled={!referralLink}
                      >
                        <CopyIcon className="w-4 h-4" />
                        Copy
                      </button>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">Share on social: (icons later)</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Daily claim modal */}
      {claimModal.open && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 relative shadow-lg">
            <button
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
              onClick={() => setClaimModal({ open: false, points: 0 })}
            >
              ✕
            </button>

            <div className="w-12 h-12 rounded-full bg-emerald-100 grid place-items-center text-emerald-600 text-2xl">
              ✓
            </div>

            <h3 className="mt-4 text-xl font-semibold text-slate-900">Level Up! 🎉</h3>
            <div className="mt-2 text-3xl font-semibold text-emerald-600">+{claimModal.points} Points</div>
            <p className="mt-3 text-sm text-slate-600">You’ve claimed your daily points! Come back tomorrow for more!</p>

            <button
              className="mt-5 w-full rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm"
              onClick={() => setClaimModal({ open: false, points: 0 })}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Spotlight modal */}
      {showSpotlightModal && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 relative shadow-xl">
            <button
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
              onClick={() => setShowSpotlightModal(false)}
            >
              ✕
            </button>

            <h3 className="text-xl font-semibold text-slate-900 mb-2">Claim Your {spotlightPoints} Points</h3>

            <p className="text-sm text-slate-600 mb-4">
              Sign up for <b>{spotlight?.tool_name ?? "the tool"}</b> (free), then:
              <br />
              <span className="block mt-2">
                1️⃣ Enter the email you used.
                <br />
                2️⃣ Upload a screenshot of your profile showing your email.
              </span>
              <br />
              After verification, you’ll receive {spotlightPoints} Flowwa Points. 🎉
            </p>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void onSubmitSpotlightClaim();
              }}
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email used</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  required
                  value={spotlightEmail}
                  onChange={(e) => setSpotlightEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Upload screenshot (mandatory)</label>
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setSpotlightFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <div className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-violet-600" />
                    {spotlightFile ? spotlightFile.name : "Choose file"}
                  </div>
                </label>
                <div className="mt-1 text-xs text-slate-500">PNG/JPG is fine. Keep it readable (email visible).</div>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setShowSpotlightModal(false)}
                  className="px-4 py-2 text-sm rounded-xl bg-slate-100 hover:bg-slate-200"
                  disabled={submittingSpotlight}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSpotlight}
                  className={classNames(
                    "px-4 py-2 text-sm rounded-xl bg-violet-600 text-white hover:bg-violet-500",
                    submittingSpotlight && "opacity-70"
                  )}
                >
                  {submittingSpotlight ? "Submitting…" : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
