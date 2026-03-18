import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";

// APIキー一覧取得
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, provider, key_name, is_valid, last_verified_at, created_at")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: data });
}

// APIキー保存
export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, key_name, value, metadata } = body;

  if (!provider || !key_name || !value) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Upsert: 同じprovider+key_nameがあれば更新
  const { data, error } = await supabase
    .from("api_keys")
    .upsert(
      {
        user_id: user.id,
        provider,
        key_name,
        encrypted_value: encrypt(value),
        metadata,
        is_valid: true,
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,key_name" }
    )
    .select("id, provider, key_name, is_valid")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ key: data });
}
