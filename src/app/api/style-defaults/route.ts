import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// デフォルトスタイル設定を取得
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("style_defaults, plan")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    defaults: profile?.style_defaults || { style: "mix", character: "none", customStyles: [], customCharacters: [] },
    plan: profile?.plan || "free",
  });
}

// デフォルトスタイル設定を保存
export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { style, character, customStyles, customCharacters, defaultTrendCategories, voiceProfile } = body;

  // 既存の style_defaults を取得（マージ用）
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, style_defaults")
    .eq("id", user.id)
    .single();

  const isPro = profile?.plan === "pro" || profile?.plan === "business";
  const isBusiness = profile?.plan === "business";
  const existing = (profile?.style_defaults as any) || {};

  // 既存データとマージ（送られたフィールドのみ上書き）
  const defaults: any = {
    ...existing,
    style: style ?? existing.style ?? "mix",
    character: character ?? existing.character ?? "none",
  };

  // voiceProfile が送られてきたら保存
  if (voiceProfile !== undefined) {
    defaults.voiceProfile = voiceProfile;
  }

  if (isPro) {
    if (customStyles !== undefined) {
      defaults.customStyles = (customStyles || []).slice(0, 5); // 最大5個
    }
    if (customCharacters !== undefined) {
      defaults.customCharacters = (customCharacters || []).slice(0, 5);
    }
  }

  if (isBusiness && defaultTrendCategories !== undefined) {
    defaults.defaultTrendCategories = defaultTrendCategories;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ style_defaults: defaults })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ defaults });
}
