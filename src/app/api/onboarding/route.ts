import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getDefaultLength } from "@/lib/plans";
import type { SnsProvider } from "@/types/database";

export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const snsProvider = body.snsProvider as SnsProvider;

  if (!snsProvider || !["x", "threads", "instagram"].includes(snsProvider)) {
    return NextResponse.json(
      { error: "SNSを選択してください（x, threads, または instagram）" },
      { status: 400 }
    );
  }

  // Instagram はBusinessプラン限定
  if (snsProvider === "instagram") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("post_plan")
      .eq("id", user.id)
      .single();
    if (profile?.post_plan !== "business") {
      return NextResponse.json(
        { error: "InstagramはBusinessプラン限定です。" },
        { status: 403 }
      );
    }
  }

  // 既にオンボーディング済みかチェック
  const { data: profile } = await supabase
    .from("profiles")
    .select("post_onboarding_completed, post_plan")
    .eq("id", user.id)
    .single();

  if (profile?.post_onboarding_completed) {
    // Business は変更可能
    if (profile.post_plan === "business") {
      await supabase
        .from("profiles")
        .update({ sns_provider: snsProvider })
        .eq("id", user.id);
      return NextResponse.json({ ok: true, snsProvider });
    }
    return NextResponse.json(
      { error: "SNSは変更できません。Businessプランにアップグレードしてください。" },
      { status: 403 }
    );
  }

  // SNS選択を保存 + オンボーディング完了
  const defaultLength = getDefaultLength(snsProvider);

  const { error } = await supabase
    .from("profiles")
    .update({
      sns_provider: snsProvider,
      post_onboarding_completed: true,
      style_defaults: {
        style: "mix",
        character: "none",
        length: defaultLength,
      },
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "保存に失敗しました: " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, snsProvider, defaultLength });
}
