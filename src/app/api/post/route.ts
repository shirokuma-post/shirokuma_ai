import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { canPost, getPostLimit, type PlanId } from "@/lib/plans";
import { checkRateLimit } from "@/lib/rate-limit";
import { isUrlSafe } from "@/lib/url-validation";
import { buildOAuthHeader, generateOAuthSignature, type XCredentials } from "@/lib/sns/x-auth";
import { verifyCronSecret } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, text, splitReply, imageUrl, credentials: externalCreds } = body;

    if (!text) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }

    // プロバイダのバリデーション
    const VALID_PROVIDERS = ["x", "threads", "instagram"];
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "無効なプロバイダです" }, { status: 400 });
    }

    // 画像URLのSSRF防止チェック
    if (imageUrl && !isUrlSafe(imageUrl)) {
      return NextResponse.json({ error: "無効な画像URLです" }, { status: 400 });
    }

    // 外部から credentials が渡された場合はCRON_SECRET認証が必要（cron/workerからの呼び出し用）
    // そうでなければ認証ユーザーのキーをDBから取得
    let credentials = externalCreds;
    let authUserId: string | null = null;

    if (externalCreds) {
      // 外部credentials利用時はCRON_SECRET or QStash署名が必要
      if (!verifyCronSecret(request.headers.get("authorization"))) {
        return NextResponse.json({ error: "Unauthorized: external credentials require CRON_SECRET" }, { status: 401 });
      }
    }

    if (!credentials) {
      const supabase = createServerSupabase();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
      }
      authUserId = authUser.id;

      // レートリミット: 1分に5回まで
      const rl = await checkRateLimit(`post:${authUser.id}`, 5, 60_000);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "リクエストが多すぎます。少し待ってからお試しください。" },
          { status: 429 },
        );
      }

      // 日次リセット + プラン上限チェック（アトミック）
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, daily_post_count, daily_reset_at")
        .eq("id", authUser.id)
        .single();
      const plan = (profile?.plan || "free") as PlanId;

      // 日次リセット（ダッシュボード以外からも対応）
      const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })).toISOString().split("T")[0];
      let dailyCount = profile?.daily_post_count || 0;
      if (profile && profile.daily_reset_at !== today) {
        await supabase
          .from("profiles")
          .update({ daily_post_count: 0, daily_reset_at: today })
          .eq("id", authUser.id);
        dailyCount = 0;
      }

      if (!canPost(plan, dailyCount)) {
        return NextResponse.json(
          { error: "本日の投稿上限に達しました。プランをアップグレードするか、明日お試しください。" },
          { status: 429 },
        );
      }

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
      } else if (provider === "instagram") {
        if (plan !== "business") {
          return NextResponse.json({ error: "Instagram投稿はBusinessプラン限定です。プランをアップグレードしてください。" }, { status: 403 });
        }
        const { data: igKeys } = await supabase
          .from("api_keys")
          .select("*")
          .eq("user_id", authUser.id)
          .eq("provider", "instagram");

        if (!igKeys?.length) {
          return NextResponse.json({ error: "Instagram APIキーが設定されていません。設定ページから登録してください。" }, { status: 400 });
        }

        const keyMap: Record<string, string> = {};
        for (const k of igKeys) {
          keyMap[k.key_name] = decrypt(k.encrypted_value);
        }

        credentials = {
          accessToken: keyMap["access_token"] || keyMap["accessToken"],
          igUserId: keyMap["ig_user_id"] || keyMap["igUserId"],
        };

        if (!credentials.accessToken || !credentials.igUserId) {
          return NextResponse.json({ error: "Instagram APIキーが不完全です。アクセストークンとInstagramビジネスアカウントIDを設定してください。" }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
      }
    }

    // 投稿実行
    let result: Response;
    if (provider === "x") {
      result = splitReply ? await postXThread(credentials, text, splitReply) : await postToX(credentials, text, imageUrl);
    } else if (provider === "threads") {
      result = splitReply ? await postThreadsThread(credentials, text, splitReply) : await postToThreads(credentials, text, imageUrl);
    } else if (provider === "instagram") {
      if (!imageUrl) {
        return NextResponse.json({ error: "Instagramは画像必須です。画像をアップロードしてください。" }, { status: 400 });
      }
      result = await postToInstagram(credentials, text, imageUrl);
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
          error_message: isSuccess ? null : (resultData.error || null),
        });
        // 投稿成功時にdaily_post_countをアトミックにインクリメント
        if (isSuccess) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("plan")
            .eq("id", authUserId)
            .single();
          const userPlan = (profile?.plan || "free") as PlanId;
          const planLimit = getPostLimit(userPlan);
          await supabase.rpc("increment_daily_post_count", {
            p_user_id: authUserId,
            p_plan_limit: planLimit,
          });
        }
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
// X media upload (v1.1 endpoint, OAuth 1.0a required)
async function uploadMediaToX(creds: any, imageUrl: string): Promise<string | null> {
  try {
    // 画像をダウンロード
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const base64 = buffer.toString("base64");

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";

    // v1.1 media/upload (OAuth 1.0a)
    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";

    // Build form params for OAuth signature
    const formParams: Record<string, string> = {
      media_data: base64,
    };

    const nonce = crypto.randomBytes(16).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: creds.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_token: creds.accessToken,
      oauth_version: "1.0",
    };

    // Signature includes both oauth params and form params
    const allParams = { ...oauthParams, ...formParams };
    oauthParams.oauth_signature = generateOAuthSignature("POST", uploadUrl, allParams, creds.consumerSecret, creds.accessTokenSecret);

    const authHeader = "OAuth " + Object.keys(oauthParams).sort().map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`).join(", ");

    const formBody = new URLSearchParams({ media_data: base64 });

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });

    if (!res.ok) {
      console.error("X media upload failed:", await res.text());
      return null;
    }

    const data = await res.json();
    return data.media_id_string;
  } catch (err) {
    console.error("X media upload error:", err);
    return null;
  }
}

async function postToX(creds: any, text: string, imageUrl?: string) {
  const url = "https://api.twitter.com/2/tweets";

  const payload: any = { text };

  // 画像がある場合、先にアップロード
  if (imageUrl) {
    const mediaId = await uploadMediaToX(creds, imageUrl);
    if (mediaId) {
      payload.media = { media_ids: [mediaId] };
    }
  }

  const res = await fetch(url, { method: "POST", headers: { Authorization: buildOAuthHeader("POST", url, creds), "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
async function postToThreads(creds: { accessToken: string; userId: string }, text: string, imageUrl?: string) {
  // 画像がある場合は IMAGE タイプ、なければ TEXT タイプ
  const containerPayload: any = imageUrl
    ? { media_type: "IMAGE", image_url: imageUrl, text, access_token: creds.accessToken }
    : { media_type: "TEXT", text, access_token: creds.accessToken };

  const createRes = await fetch(`https://graph.threads.net/v1.0/${creds.userId}/threads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(containerPayload) });
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

// ---------- Instagram posting ----------
async function postToInstagram(creds: { accessToken: string; igUserId: string }, caption: string, imageUrl: string) {
  // Step 1: メディアコンテナを作成
  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${creds.igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: creds.accessToken,
      }),
    },
  );

  if (!containerRes.ok) {
    const e = await containerRes.text();
    return NextResponse.json({ error: `Instagram container error: ${e}` }, { status: containerRes.status });
  }

  const { id: containerId } = await containerRes.json();

  // Step 2: コンテナの処理完了を待つ
  await new Promise((r) => setTimeout(r, 3000));

  // Step 3: パブリッシュ
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${creds.igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: creds.accessToken,
      }),
    },
  );

  if (!publishRes.ok) {
    const e = await publishRes.text();
    return NextResponse.json({ error: `Instagram publish error: ${e}` }, { status: publishRes.status });
  }

  const data = await publishRes.json();
  return NextResponse.json({ id: data.id });
}
