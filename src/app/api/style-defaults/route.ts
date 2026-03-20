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
  const { style, character, customStyles, customCharacters } = body;

  // Pro以上でなければカスタム設定は保存しない
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const isPro = profile?.plan === "pro" || profile?.plan === "business";

  const defaults: any = {
    style: style || "mix",
    character: character || "none",
  };

  if (isPro) {
    defaults.customStyles = (customStyles || []).slice(0, 5); // 最大5個
    defaults.customCharacters = (customCharacters || []).slice(0, 5);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ style_defaults: defaults })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ defaults });
}
