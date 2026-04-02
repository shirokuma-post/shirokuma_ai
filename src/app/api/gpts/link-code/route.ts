import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

// POST: 連携コードを発行する（ログイン済みユーザー用）
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { purpose } = body as { purpose?: string };
    if (!purpose || !["api_keys", "philosophy"].includes(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }

    // 既存の未使用コードを無効化
    await supabase
      .schema('post').from("gpts_link_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("purpose", purpose)
      .eq("used", false);

    // 6桁の英数字コード生成（大文字のみ、紛らわしい文字除外）
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(6);
    const code = Array.from(bytes).map(b => chars[b % chars.length]).join("");

    // 15分間有効
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .schema('post').from("gpts_link_codes")
      .insert({
        user_id: user.id,
        code,
        purpose,
        expires_at: expiresAt,
      })
      .select("code, purpose, expires_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ code: data.code, purpose: data.purpose, expiresAt: data.expires_at });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: 連携コードの状態を確認（チュートリアルUIのポーリング用）
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get("purpose");

    if (!purpose) return NextResponse.json({ error: "Missing purpose" }, { status: 400 });

    // 最新のコードを取得
    const { data } = await supabase
      .schema('post').from("gpts_link_codes")
      .select("code, purpose, used, expires_at")
      .eq("user_id", user.id)
      .eq("purpose", purpose)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) return NextResponse.json({ status: "none" });

    const expired = new Date(data.expires_at) < new Date();
    return NextResponse.json({
      code: data.code,
      used: data.used,
      expired,
      status: data.used ? "completed" : expired ? "expired" : "active",
    });
  } catch {
    return NextResponse.json({ status: "none" });
  }
}
