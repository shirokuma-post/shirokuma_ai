import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan || "free") as PlanId;
  const today = new Date().toISOString().split("T")[0];

  // 日付が変わったらカウントリセット
  if (profile && profile.daily_reset_at !== today) {
    await supabase
      .from("profiles")
      .update({ daily_post_count: 0, daily_reset_at: today })
      .eq("id", user.id);
    if (profile) profile.daily_post_count = 0;
  }

  const { data: philosophy } = await supabase
    .from("philosophies")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("provider, key_name")
    .eq("user_id", user.id);

  const hasAiKey = apiKeys?.some(k => ["anthropic", "openai", "google"].includes(k.provider)) || false;
  const hasXKey = apiKeys?.some(k => k.provider === "x") || false;
  const hasThreadsKey = apiKeys?.some(k => k.provider === "threads") || false;
  const snsProvider = (profile?.sns_provider || null) as "x" | "threads" | null;
  const hasSnsKey = snsProvider === "x" ? hasXKey : snsProvider === "threads" ? hasThreadsKey : false;

  const { data: recentPosts } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { count: totalPosts } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const planInfo = PLANS[plan];
  const dailyCount = profile?.daily_post_count || 0;
  const postsRemaining = planInfo.postsPerDay === -1 ? -1 : planInfo.postsPerDay - dailyCount;

  return NextResponse.json({
    user: { email: user.email, displayName: profile?.display_name || user.email?.split("@")[0] },
    plan: {
      id: plan,
      name: planInfo.name,
      price: planInfo.price,
      postsPerDay: planInfo.postsPerDay,
      maxScheduleTimes: planInfo.maxScheduleTimes,
      features: planInfo.features,
      dailyCount,
      postsRemaining,
    },
    snsProvider,
    setup: {
      hasConcept: !!philosophy,
      conceptTitle: philosophy?.title || null,
      hasAiKey,
      hasXKey,
      hasThreadsKey,
      hasSnsKey,
    },
    recentPosts: recentPosts || [],
    totalPosts: totalPosts || 0,
  });
}
