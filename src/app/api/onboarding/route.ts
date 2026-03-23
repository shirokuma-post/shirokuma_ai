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

  if (!snsProvider || !["x", "threads"].includes(snsProvider)) {
    return NextResponse.json(
      { error: "SNSを選択してください（x または threads）" },
      { status: 400 }
    );
  }

  // 既にオンボーディング済みかチェック
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, plan")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) {
    // Business は変更可能
    if (profile.plan === "business") {
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
      onboarding_completed: true,
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
