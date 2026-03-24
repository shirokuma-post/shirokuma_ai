import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";

// GPTsから呼ばれる: 連携コードで認証 → APIキー保存
export async function POST(request: Request) {
  try {
    // GPTsからのリクエストにはCORSヘッダー必要
    const body = await request.json();
    const { link_code, keys } = body as {
      link_code: string;
      keys: Array<{
        provider: string;
        key_name: string;
        value: string;
        metadata?: Record<string, any>;
      }>;
    };

    if (!link_code || !keys?.length) {
      return gptResponse({ error: "link_code と keys が必要です" }, 400);
    }

    // service_role で連携コードを検証
    const supabase = createServiceClient();

    const { data: linkCode, error: codeError } = await supabase
      .from("gpts_link_codes")
      .select("*")
      .eq("code", link_code.toUpperCase().trim())
      .eq("purpose", "api_keys")
      .eq("used", false)
      .single();

    if (codeError || !linkCode) {
      return gptResponse({ error: "無効な連携コードです。しろくまポストの画面で新しいコードを発行してください。" }, 401);
    }

    // 期限切れチェック
    if (new Date(linkCode.expires_at) < new Date()) {
      return gptResponse({ error: "連携コードの有効期限が切れました。しろくまポストの画面で新しいコードを発行してください。" }, 401);
    }

    const userId = linkCode.user_id;
    const savedKeys: string[] = [];

    // 各キーを保存
    for (const key of keys) {
      const validProviders = ["anthropic", "openai", "google", "x", "threads"];
      if (!validProviders.includes(key.provider)) {
        continue; // 不正なproviderはスキップ
      }

      const { error } = await supabase
        .from("api_keys")
        .upsert(
          {
            user_id: userId,
            provider: key.provider,
            key_name: key.key_name,
            encrypted_value: encrypt(key.value),
            metadata: key.metadata || null,
            is_valid: true,
            last_verified_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider,key_name" }
        );

      if (!error) {
        savedKeys.push(`${key.provider}/${key.key_name}`);
      }
    }

    // コードを使用済みにする
    await supabase
      .from("gpts_link_codes")
      .update({ used: true })
      .eq("id", linkCode.id);

    return gptResponse({
      success: true,
      message: `${savedKeys.length}件のAPIキーを保存しました: ${savedKeys.join(", ")}`,
      saved_keys: savedKeys,
    });
  } catch (e: any) {
    return gptResponse({ error: e.message }, 500);
  }
}

// CORS対応 + GPTsフレンドリーなレスポンス
function gptResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// OPTIONSプリフライト
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
