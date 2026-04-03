import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getThreadsAuthUrl, getInstagramAuthUrl } from "@/lib/meta-oauth";
import { encrypt } from "@/lib/crypto";

// GET /api/auth/meta?provider=threads|instagram
// → Meta OAuth認証URLを返す
export async function GET(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // META_APP_ID が未設定の場合はエラー
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.json(
      { error: "Meta OAuth is not configured. Set META_APP_ID and META_APP_SECRET." },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider"); // "threads" or "instagram"

  // CSRF防止: state に暗号化ペイロードを埋め込む
  const statePayload = JSON.stringify({
    provider: provider || "threads",
    userId: user.id,
    ts: Date.now(),
  });
  const state = encodeURIComponent(encrypt(statePayload));

  let authUrl: string;
  if (provider === "instagram") {
    authUrl = getInstagramAuthUrl(state);
  } else {
    authUrl = getThreadsAuthUrl(state);
  }

  console.log(`[META-AUTH] provider=${provider}, META_APP_ID=${process.env.META_APP_ID?.slice(0, 4)}..., authUrl=${authUrl.slice(0, 100)}...`);
  return NextResponse.json({ url: authUrl });
}
