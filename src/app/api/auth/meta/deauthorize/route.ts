import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

// Meta がユーザーのアプリ許可取り消し時に POST してくる
// → 該当ユーザーの Threads/Instagram トークンを無効化
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const signedRequest = body.signed_request;

    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    // signed_request をデコードして user_id を取得
    const [, payload] = signedRequest.split(".");
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    const metaUserId = decoded.user_id;

    if (!metaUserId) {
      return NextResponse.json({ error: "No user_id in payload" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Threads/Instagram の該当トークンを無効化
    await supabase
      .from("api_keys")
      .update({ is_valid: false })
      .in("provider", ["threads", "instagram"])
      .eq("key_name", "user_id")
      .eq("product", "post")
      .eq("encrypted_value", metaUserId); // user_id が平文で一致するケース

    console.log(`[META-DEAUTH] Deauthorized meta user ${metaUserId}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[META-DEAUTH] Error:", err);
    return NextResponse.json({ success: true }); // Meta には常に200を返す
  }
}
