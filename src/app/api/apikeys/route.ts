import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { verifyXCredentials } from "@/lib/sns/x-auth";

// APIキー一覧取得
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, provider, key_name, is_valid, last_verified_at, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("product", "post");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: data });
}

// APIキー保存（select→update/insert パターン、統合DBにはupsert用ユニーク制約がないため）
export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, key_name, value } = body;

  if (!provider || !key_name || !value) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 既存キーを検索
  const { data: existing } = await supabase
    .from("api_keys")
    .select("id")
    .eq("user_id", user.id)
    .eq("product", "post")
    .eq("provider", provider)
    .eq("key_name", key_name)
    .single();

  let data, error;

  if (existing) {
    // 更新
    ({ data, error } = await supabase
      .from("api_keys")
      .update({
        encrypted_value: encrypt(value),
        is_valid: true,
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, provider, key_name, is_valid")
      .single());
  } else {
    // 新規作成
    ({ data, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        product: "post",
        provider,
        key_name,
        encrypted_value: encrypt(value),
        is_valid: true,
        last_verified_at: new Date().toISOString(),
      })
      .select("id, provider, key_name, is_valid")
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // X APIキーが4つ揃ったら自動検証
  let verification: { valid: boolean; username?: string; error?: string } | null = null;
  if (provider === "x") {
    const { data: allXKeys } = await supabase
      .from("api_keys")
      .select("key_name, encrypted_value")
      .eq("user_id", user.id)
      .eq("provider", "x");

    const xKeyMap: Record<string, string> = {};
    for (const k of allXKeys || []) {
      xKeyMap[k.key_name] = decrypt(k.encrypted_value);
    }

    const creds = {
      consumerKey: xKeyMap["consumer_key"] || xKeyMap["consumerKey"],
      consumerSecret: xKeyMap["consumer_secret"] || xKeyMap["consumerSecret"],
      accessToken: xKeyMap["access_token"] || xKeyMap["accessToken"],
      accessTokenSecret: xKeyMap["access_token_secret"] || xKeyMap["accessTokenSecret"],
    };

    // 4つ全て揃っている場合のみ検証
    if (creds.consumerKey && creds.consumerSecret && creds.accessToken && creds.accessTokenSecret) {
      verification = await verifyXCredentials(creds);

      // 検証結果をDBに反映
      const isValid = verification.valid;
      await supabase
        .from("api_keys")
        .update({
          is_valid: isValid,
          last_verified_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("provider", "x");
    }
  }

  return NextResponse.json({ key: data, verification });
}
