import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, text, splitReply, credentials: externalCreds } = body;

    if (!text) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }

    // 外部から credentials が渡された場合はそのまま使う（cron からの呼び出し用）
    // そうでなければ認証ユーザーのキーをDBから取得
    let credentials = externalCreds;
    let authUserId: string | null = null;

    if (!credentials) {
      const supabase = createServerSupabase();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
      }
      authUserId = authUser.id;

      if (provider === "x") {
        const { data: xKeys } = await supabase
          .from("api_keys")
          .select("*")
          .eq("user_id", authUser.id)
          .eq("provider", "x");

        if (!xKeys?.length) {
          return NextResponse.json({ error: "X APIキーが設定されていません。設定ページから登録してください。" }, { status: 400 });
        }

        const keyMap: Record<string, string> = {};
        for (const k of xKeys) {
          keyMap[k.key_name] = decrypt(k.encrypted_value);
        }

        credentials = {
          consumerKey: keyMap["consumer_key"] || keyMap["consumerKey"],
          consumerSecret: keyMap["consumer_secret"] || keyMap["consumerSecret"],
          accessToken: keyMap["access_token"] || keyMap["accessToken"],
          accessTokenSecret: keyMap["access_token_secret"] || keyMap["accessTokenSecret"],
        };

        if (!credentials.consumerKey) {
          return NextResponse.json({ error: "X APIキーが不完全です。4つのキーをすべて設定してください。" }, { status: 400 });
        }
      } else if (provider === "threads") {
        const { data: threadsKeys } = await supabase
          .from("api_keys")
          .select("*")
          .eq("user_id", authUser.id)
          .eq("provider", "threads");

        if (!threadsKeys?.length) {
          return NextResponse.json({ error: "Threads APIキーが設定されていません。設定ページから登録してください。" }, { status: 400 });
        }

        const keyMap: Record<string, string> = {};
        for (const k of threadsKeys) {
          keyMap[k.key_name] = decrypt(k.encrypted_value);
        }

        credentials = {
          accessToken: keyMap["access_token"] || keyMap["accessToken"],
          userId: keyMap["user_id"] || keyMap["userId"],
        };

        if (!credentials.accessToken || !credentials.userId) {
          return NextResponse.json({ error: "Threads APIキーが不完全です。アクセストークンとユーザーIDを設定してください。" }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
      }
    }

    // 投稿実行
    let result: Response;
    if (provider === "x") {
      result = splitReply ? await postXThread(credentials, text, splitReply) : await postToX(credentials, text);
    } else if (provider === "threads") {
      result = splitReply ? await postThreadsThread(credentials, text, splitReply) : await postToThreads(credentials, text);
    } else {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    // DB保存（認証ユーザーの手動投稿のみ。cron は自前で保存する）
    if (authUserId) {
      try {
        const resultData = await result.clone().json();
        const isSuccess = result.ok;
        const supabase = createServerSupabase();
        await supabase.from("posts").insert({
          user_id: authUserId,
          content: splitReply ? text + "\n\n---\n\n" + splitReply : text,
          status: isSuccess ? "posted" : "failed",
          posted_at: isSuccess ? new Date().toISOString() : null,
          sns_post_ids: { [provider]: resultData },
        });
      } catch (dbErr) {
        console.warn("Post DB save failed (non-fatal):", dbErr);
      }
    }

    return result;
  } catch (error: any) {
    console.error("Post error:", error);
    return NextResponse.json({ error: error.message || "投稿に失敗しました" }, { status: 500 });
  }
}

// ---------- X posting ----------
function generateOAuthSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
  const sortedParams = Object.keys(params).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
  const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sortedParams)].join("&");
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildOAuthHeader(method: string, url: string, creds: { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string }): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauthParams: Record<string, string> = { oauth_consumer_key: creds.consumerKey, oauth_nonce: nonce, oauth_signature_method: "HMAC-SHA1", oauth_timestamp: timestamp, oauth_token: creds.accessToken, oauth_version: "1.0" };
  oauthParams.oauth_signature = generateOAuthSignature(method, url, oauthParams, creds.consumerSecret, creds.accessTokenSecret);
  return "OAuth " + Object.keys(oauthParams).sort().map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`).join(", ");
}

async function postToX(creds: any, text: string) {
  const url = "https://api.twitter.com/2/tweets";
  const res = await fetch(url, { method: "POST", headers: { Authorization: buildOAuthHeader("POST", url, creds), "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) { const e = await res.text(); return NextResponse.json({ error: `X API error: ${res.status} - ${e}` }, { status: res.status }); }
  const data = await res.json();
  return NextResponse.json({ id: data.data.id, text: data.data.text });
}

async function postXThread(creds: any, hookText: string, replyText: string) {
  const url = "https://api.twitter.com/2/tweets";
  const hookRes = await fetch(url, { method: "POST", headers: { Authorization: buildOAuthHeader("POST", url, creds), "Content-Type": "application/json" }, body: JSON.stringify({ text: hookText }) });
  if (!hookRes.ok) { const e = await hookRes.text(); return NextResponse.json({ error: `X hook error: ${hookRes.status} - ${e}` }, { status: hookRes.status }); }
  const hookData = await hookRes.json();
  const hookId = hookData.data.id;
  // X API needs time to process the first tweet before accepting a reply
  await new Promise((r) => setTimeout(r, 3000));
  const replyRes = await fetch(url, { method: "POST", headers: { Authorization: buildOAuthHeader("POST", url, creds), "Content-Type": "application/json" }, body: JSON.stringify({ text: replyText, reply: { in_reply_to_tweet_id: hookId } }) });
  if (!replyRes.ok) { const e = await replyRes.text(); return NextResponse.json({ error: `X reply error: ${replyRes.status} - ${e}`, hookId, partial: true }, { status: replyRes.status }); }
  const replyData = await replyRes.json();
  return NextResponse.json({ id: hookId, replyId: replyData.data.id, thread: true });
}

// ---------- Threads posting ----------
async function postToThreads(creds: { accessToken: string; userId: string }, text: string) {
  const createRes = await fetch(`https://graph.threads.net/v1.0/${creds.userId}/threads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media_type: "TEXT", text, access_token: creds.accessToken }) });
  if (!createRes.ok) { const e = await createRes.text(); return NextResponse.json({ error: `Threads error: ${e}` }, { status: createRes.status }); }
  const { id: cid } = await createRes.json();
  await new Promise((r) => setTimeout(r, 2000));
  const pubRes = await fetch(`https://graph.threads.net/v1.0/${creds.userId}/threads_publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: cid, access_token: creds.accessToken }) });
  if (!pubRes.ok) { const e = await pubRes.text(); return NextResponse.json({ error: `Threads publish error: ${e}` }, { status: pubRes.status }); }
  const data = await pubRes.json();
  return NextResponse.json({ id: data.id });
}

async function postThreadsThread(creds: { accessToken: string; userId: string }, hookText: string, replyText: string) {
  const hcRes = await fetch(`https://graph.threads.net/v1.0/${creds.userId}/threads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media_type: "TEXT", text: hookText, access_token: creds.accessToken }) });
  if (!hcRes.ok) { const e = await hcRes.text(); return NextResponse.json({ error: `Threads hook error: ${e}` }, { status: hcRes.status }); }
  const { id: hcid } = await hcRes.json();
  await new Promise((r) => setTimeout(r, 2000));
  const hpRes = await fetch(`https://graph.threads.net/v1.0/${creds.userId}/threads_publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: hcid, access_token: creds.accessToken }) });
  if (!hpRes.ok) { const e = await hpRes.text(); return NextResponse.json({ error: `Threads hook publish error: ${e}` }, { status: hpRes.status }); }
  const hookData = await hpRes.json();
  const hookId = hookData.id;
  const rcRes = await fetch(`https://graph.threads.net/v1.0/${creds.userId}/threads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media_type: "TEXT", text: replyText, reply_to_id: hookId, access_token: creds.accessToken }) });
  if (!rcRes.ok) { const e = await rcRes.text(); return NextResponse.json({ error: `Threads reply error: ${e}`, hookId, partial: true }, { status: rcRes.status }); }
  const { id: rcid } = await rcRes.json();
  await new Promise((r) => setTimeout(r, 2000));
  const rpRes = await fetch(`https://graph.threads.net/v1.0/${creds.userId}/threads_publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: rcid, access_token: creds.accessToken }) });
  if (!rpRes.ok) { const e = await rpRes.text(); return NextResponse.json({ error: `Threads reply publish error: ${e}`, hookId, partial: true }, { status: rpRes.status }); }
  const replyData = await rpRes.json();
  return NextResponse.json({ id: hookId, replyId: replyData.id, thread: true });
}
