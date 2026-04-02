import { createServerSupabase } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { exchangeThreadsCode, exchangeInstagramCode } from "@/lib/meta-oauth";

// GET /api/auth/meta/callback?code=xxx&state=xxx
// Meta OAuth コールバック → トークン保存 → settings にリダイレクト
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const settingsUrl = (params: string) =>
    new URL(`/dashboard/settings${params}`, request.url);

  if (error) {
    return NextResponse.redirect(settingsUrl(`?oauth_error=${encodeURIComponent(error)}`));
  }

  if (!code || !state) {
    return NextResponse.redirect(settingsUrl("?oauth_error=missing_params"));
  }

  // ユーザー認証
  const anonSupabase = createServerSupabase();
  const { data: { user } } = await anonSupabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // State を復号してCSRF検証
  let stateData: { provider: string; userId: string; ts: number };
  try {
    stateData = JSON.parse(decrypt(decodeURIComponent(state)));
  } catch {
    return NextResponse.redirect(settingsUrl("?oauth_error=invalid_state"));
  }

  if (stateData.userId !== user.id) {
    return NextResponse.redirect(settingsUrl("?oauth_error=state_mismatch"));
  }

  // 5分以内かチェック
  if (Date.now() - stateData.ts > 5 * 60 * 1000) {
    return NextResponse.redirect(settingsUrl("?oauth_error=state_expired"));
  }

  const provider = stateData.provider; // "threads" | "instagram"
  const supabase = getServiceClient(); // RLSバイパスでトークン保存

  try {
    let keys: { key_name: string; value: string }[] = [];

    if (provider === "threads") {
      const { accessToken, userId } = await exchangeThreadsCode(code);
      keys = [
        { key_name: "access_token", value: accessToken },
        { key_name: "user_id", value: userId },
      ];
    } else if (provider === "instagram") {
      const { accessToken, igBusinessAccountId } = await exchangeInstagramCode(code);
      keys = [
        { key_name: "access_token", value: accessToken },
        { key_name: "user_id", value: igBusinessAccountId },
      ];
    }

    // api_keys に upsert（同じ provider + key_name があれば更新）
    for (const k of keys) {
      const { data: existing } = await supabase
        .from("api_keys")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .eq("key_name", k.key_name)
        .eq("product", "post")
        .single();

      if (existing) {
        await supabase
          .from("api_keys")
          .update({
            encrypted_value: encrypt(k.value),
            is_valid: true,
            last_verified_at: new Date().toISOString(),
            // TODO: metadata列が統合DBに追加されたら auto_refresh: true, oauth: true を保存
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("api_keys").insert({
          user_id: user.id,
          provider,
          key_name: k.key_name,
          encrypted_value: encrypt(k.value),
          is_valid: true,
          last_verified_at: new Date().toISOString(),
          metadata: { auto_refresh: true, oauth: true, connected_at: new Date().toISOString() },
          product: "post",
        });
      }
    }

    console.log(`[META-OAUTH] ${provider} connected for user ${user.id}`);
    return NextResponse.redirect(settingsUrl(`?oauth_success=${provider}`));
  } catch (err: any) {
    console.error("[META-OAUTH] Callback error:", err);
    return NextResponse.redirect(
      settingsUrl(`?oauth_error=${encodeURIComponent(err.message)}`)
    );
  }
}
