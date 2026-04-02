import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { verifyCronRequest } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import { refreshThreadsToken, refreshInstagramToken } from "@/lib/meta-oauth";

// =============================================================
// Meta Token Auto-Refresh Cron
// 60日トークンの有効期限7日前に自動更新
// Vercel Cron: 毎日 3:00 AM UTC → cron: "0 3 * * *"
// =============================================================

const TOKEN_LIFETIME_DAYS = 60;
const REFRESH_THRESHOLD_DAYS = 7; // 残り7日で更新

async function handler(request: Request) {
  const authReject = verifyCronRequest(request);
  if (authReject) return authReject;

  const supabase = getServiceClient();
  let refreshed = 0;
  let failed = 0;
  const errors: { userId: string; provider: string; error: string }[] = [];

  try {
    // OAuth接続されたThreads/Instagramトークンを取得
    const { data: tokens, error: fetchError } = await supabase
      .from("api_keys")
      .select("id, user_id, provider, key_name, encrypted_value, last_verified_at")
      .in("provider", ["threads", "instagram"])
      .eq("key_name", "access_token")
      .eq("is_valid", true)
      .eq("product", "post");

    if (fetchError || !tokens?.length) {
      return NextResponse.json({ message: "No tokens to refresh", refreshed: 0 });
    }

    const now = Date.now();

    for (const token of tokens) {
      // TODO: metadata列が追加されたら auto_refresh フラグで制御
      // 現状は全Threads/Instagramトークンをリフレッシュ対象にする

      // 最終検証日から残り日数を計算
      const lastVerified = token.last_verified_at
        ? new Date(token.last_verified_at).getTime()
        : now - TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
      const daysSinceVerified = (now - lastVerified) / (1000 * 60 * 60 * 24);
      const daysRemaining = TOKEN_LIFETIME_DAYS - daysSinceVerified;

      // 残り7日以上ならスキップ
      if (daysRemaining > REFRESH_THRESHOLD_DAYS) continue;

      try {
        const currentToken = decrypt(token.encrypted_value);
        let newToken: string;

        if (token.provider === "threads") {
          const result = await refreshThreadsToken(currentToken);
          newToken = result.accessToken;
        } else {
          const result = await refreshInstagramToken(currentToken);
          newToken = result.accessToken;
        }

        await supabase
          .from("api_keys")
          .update({
            encrypted_value: encrypt(newToken),
            is_valid: true,
            last_verified_at: new Date().toISOString(),
          })
          .eq("id", token.id);

        refreshed++;
        console.log(`[REFRESH-META] Refreshed ${token.provider} token for user ${token.user_id}`);
      } catch (err: any) {
        failed++;
        errors.push({ userId: token.user_id, provider: token.provider, error: err.message });

        // リフレッシュ失敗 → is_valid を false にマーク
        await supabase
          .from("api_keys")
          .update({ is_valid: false })
          .eq("id", token.id);

        console.error(`[REFRESH-META] Failed for ${token.provider} user ${token.user_id}:`, err.message);
      }
    }

    return NextResponse.json({
      message: "Token refresh completed",
      refreshed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[REFRESH-META] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export { handler as GET, handler as POST };
