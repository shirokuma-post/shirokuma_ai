import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { decrypt, encrypt } from "@/lib/crypto";
import { verifyCronSecret } from "@/lib/auth";

/**
 * Threads アクセストークン自動リフレッシュ
 *
 * POST /api/threads/refresh-token
 *
 * 2つのモード:
 * 1. ユーザー手動: 認証済みユーザーが自分のトークンをリフレッシュ
 * 2. Cron自動: CRON_SECRET認証で auto_refresh=true のユーザーを一括リフレッシュ
 */

// --- Meta Graph API でトークンをリフレッシュ ---
async function refreshThreadsToken(currentToken: string): Promise<{
  success: true;
  accessToken: string;
  expiresIn: number;
} | {
  success: false;
  error: string;
}> {
  try {
    const url = new URL("https://graph.threads.net/refresh_access_token");
    url.searchParams.set("grant_type", "th_refresh_token");
    url.searchParams.set("access_token", currentToken);

    const res = await fetch(url.toString(), { method: "GET" });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Threads token refresh failed:", res.status, errorText);
      return { success: false, error: `Meta API error: ${res.status} - ${errorText}` };
    }

    const data = await res.json();
    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (err: any) {
    console.error("Threads token refresh error:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

// --- ユーザー手動リフレッシュ or 自動更新ON ---
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { action } = body; // "refresh" | "enable_auto" | "disable_auto" | "cron"

  // --- Cron一括リフレッシュ ---
  if (action === "cron") {
    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleCronRefresh();
  }

  // --- ユーザー操作（認証必須）---
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (action === "enable_auto") {
    return handleToggleAutoRefresh(supabase, user.id, true);
  }
  if (action === "disable_auto") {
    return handleToggleAutoRefresh(supabase, user.id, false);
  }

  // デフォルト: 手動リフレッシュ
  return handleUserRefresh(supabase, user.id);
}

// --- ユーザー手動リフレッシュ ---
async function handleUserRefresh(supabase: any, userId: string) {
  // 現在のトークンを取得
  const { data: tokenRow } = await supabase
    .from("api_keys")
    .select("id, encrypted_value, metadata")
    .eq("user_id", userId)
    .eq("provider", "threads")
    .eq("key_name", "access_token")
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "Threads トークンが見つかりません" }, { status: 404 });
  }

  const currentToken = decrypt(tokenRow.encrypted_value);
  const result = await refreshThreadsToken(currentToken);

  if (!result.success) {
    // トークンが期限切れ or 無効
    await supabase
      .from("api_keys")
      .update({ is_valid: false })
      .eq("id", tokenRow.id);

    return NextResponse.json({
      error: "トークンの更新に失敗しました。Meta Developer Portalで再取得してください。",
      detail: result.error,
    }, { status: 400 });
  }

  // 新しいトークンを保存
  await supabase
    .from("api_keys")
    .update({
      encrypted_value: encrypt(result.accessToken),
      is_valid: true,
      last_verified_at: new Date().toISOString(),
      metadata: { ...tokenRow.metadata, auto_refresh: tokenRow.metadata?.auto_refresh ?? false },
    })
    .eq("id", tokenRow.id);

  const daysLeft = Math.floor(result.expiresIn / 86400);

  return NextResponse.json({
    success: true,
    message: `トークンを更新しました（有効期限: ${daysLeft}日後）`,
    daysLeft,
  });
}

// --- 自動更新 ON/OFF ---
async function handleToggleAutoRefresh(supabase: any, userId: string, enabled: boolean) {
  const { data: tokenRow, error } = await supabase
    .from("api_keys")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("provider", "threads")
    .eq("key_name", "access_token")
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "Threads トークンが見つかりません" }, { status: 404 });
  }

  await supabase
    .from("api_keys")
    .update({
      metadata: { ...tokenRow.metadata, auto_refresh: enabled },
    })
    .eq("id", tokenRow.id);

  return NextResponse.json({
    success: true,
    auto_refresh: enabled,
    message: enabled ? "自動更新を有効にしました" : "自動更新を無効にしました",
  });
}

// --- Cron: 自動更新対象の一括リフレッシュ ---
async function handleCronRefresh() {
  // service role は createServerSupabase の中で対応しているが、
  // cron では全ユーザー分取得が必要なので直接 service role client を使う
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // auto_refresh=true かつ 50日以上経過しているトークンを取得
  const fiftyDaysAgo = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tokens, error } = await supabase
    .from("api_keys")
    .select("id, user_id, encrypted_value, metadata, updated_at")
    .eq("provider", "threads")
    .eq("key_name", "access_token")
    .eq("is_valid", true)
    .lt("updated_at", fiftyDaysAgo);

  if (error) {
    console.error("Cron: Failed to fetch tokens:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // auto_refresh = true のものだけフィルタ
  const autoRefreshTokens = (tokens || []).filter(
    (t) => t.metadata?.auto_refresh === true
  );

  if (autoRefreshTokens.length === 0) {
    return NextResponse.json({ message: "No tokens to refresh", refreshed: 0 });
  }

  let refreshed = 0;
  let failed = 0;
  const errors: { userId: string; error: string }[] = [];

  for (const token of autoRefreshTokens) {
    const currentToken = decrypt(token.encrypted_value);
    const result = await refreshThreadsToken(currentToken);

    if (result.success) {
      await supabase
        .from("api_keys")
        .update({
          encrypted_value: encrypt(result.accessToken),
          is_valid: true,
          last_verified_at: new Date().toISOString(),
        })
        .eq("id", token.id);
      refreshed++;
    } else {
      await supabase
        .from("api_keys")
        .update({ is_valid: false })
        .eq("id", token.id);
      failed++;
      errors.push({ userId: token.user_id, error: result.error });
    }
  }

  console.log(`Cron: Threads token refresh complete. Refreshed: ${refreshed}, Failed: ${failed}`);

  return NextResponse.json({
    message: "Cron refresh complete",
    total: autoRefreshTokens.length,
    refreshed,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
