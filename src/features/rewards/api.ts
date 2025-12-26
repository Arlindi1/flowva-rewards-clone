import { supabase } from "../../lib/supabaseClient";

export async function getRewardsHubData() {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  if (!sessionData.session) throw new Error("No session");

  const uid = sessionData.session.user.id;

  const [profileRes, balanceRes, checkinsRes, spotlightRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,display_name,referral_code")
      .eq("id", uid)
      .single(),

    // IMPORTANT: filter by current user
    supabase
      .from("v_points_balance")
      .select("balance")
      .eq("user_id", uid)
      .maybeSingle(),

    // IMPORTANT: filter by current user
    supabase
      .from("daily_checkins")
      .select("checkin_date")
      .eq("user_id", uid)
      .gte("checkin_date", new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)),

    supabase
      .from("tool_spotlights")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileRes.error) throw profileRes.error;

  return {
    profile: profileRes.data,
    balance: balanceRes.data?.balance ?? 0,
    checkins: checkinsRes.error ? [] : (checkinsRes.data ?? []),
    spotlight: spotlightRes.error ? null : spotlightRes.data,
  };
}

export async function claimDailyPoints() {
  const { data, error } = await supabase.rpc("claim_daily_points");
  if (error) throw error;
  return data?.[0] as { awarded: number; balance: number; streak: number };
}

/**
 * Optional helper (you can keep it, but the UI won't use it to disable anything)
 * Returns latest request status for this user+spotlight
 */
export async function getSpotlightClaimStatus(spotlightId: string) {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  if (!sessionData.session) throw new Error("No session");

  const { data, error } = await supabase
    .from("spotlight_claim_requests")
    .select("id,status,external_email,screenshot_path,created_at")
    .eq("spotlight_id", spotlightId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data; // null if none
}

export async function submitSpotlightClaim(opts: {
  spotlightId: string;
  externalEmail: string;
  file: File;
}) {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const user = sessionData.session?.user;
  if (!user) throw new Error("No session");

  // 1) Upload screenshot to Storage
  const bucket = "spotlight-claims";
  const safeName = opts.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${user.id}/${opts.spotlightId}/${Date.now()}-${safeName}`;

  const uploadRes = await supabase.storage.from(bucket).upload(path, opts.file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadRes.error) throw uploadRes.error;

  // 2) Always insert a NEW pending request row (multiple allowed)
  const insertRes = await supabase
    .from("spotlight_claim_requests")
    .insert({
      user_id: user.id,
      spotlight_id: opts.spotlightId,
      external_email: opts.externalEmail,
      screenshot_path: path,
      status: "pending",
    })
    .select("id,status,external_email,screenshot_path,created_at")
    .single();

  if (insertRes.error) {
    // cleanup orphan upload
    await supabase.storage.from(bucket).remove([path]);
    throw insertRes.error;
  }

  return insertRes.data;
}
