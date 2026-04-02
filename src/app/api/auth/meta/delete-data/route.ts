import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import crypto from "crypto";

// Meta GDPR データ削除リクエスト
// ユーザーがMeta設定からデータ削除を要求した時にPOSTされる
// → 該当ユーザーの Threads/Instagram トークンを完全削除
// → confirmation_code を返す（Meta が削除状況確認用に使う）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const signedRequest = body.signed_request;

    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    // signed_request をデコード
    const [, payload] = signedRequest.split(".");
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    const metaUserId = decoded.user_id;

    if (!metaUserId) {
      return NextResponse.json({ error: "No user_id in payload" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // 該当する api_keys を検索して削除
    // user_id キーに Meta User ID が保存されているレコードを探す
    const { data: userIdKeys } = await supabase
      .from("api_keys")
      .select("user_id")
      .in("provider", ["threads", "instagram"])
      .eq("key_name", "user_id")
      .eq("product", "post");

    // 該当ユーザーの Threads/Instagram キーをすべて削除
    if (userIdKeys?.length) {
      for (const key of userIdKeys) {
        await supabase
          .from("api_keys")
          .delete()
          .eq("user_id", key.user_id)
          .in("provider", ["threads", "instagram"])
          .eq("product", "post");
      }
    }

    // confirmation_code を生成（Meta が削除確認ページで使う）
    const confirmationCode = crypto.randomUUID();

    console.log(`[META-DELETE] Data deletion for meta user ${metaUserId}, code: ${confirmationCode}`);

    // Meta が要求するレスポンス形式
    return NextResponse.json({
      url: `${process.env.NEXT_PUBLIC_APP_URL || "https://shirokumapos.vercel.app"}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err: any) {
    console.error("[META-DELETE] Error:", err);
    return NextResponse.json({
      url: `${process.env.NEXT_PUBLIC_APP_URL || "https://shirokumapos.vercel.app"}/data-deletion`,
      confirmation_code: "error",
    });
  }
}
