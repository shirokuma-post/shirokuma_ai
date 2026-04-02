import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

// OAuth署名生成（post/route.ts と同じロジック）
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

export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // DBからX APIキーを取得
    const { data: xKeys, error: keysError } = await supabase
      .from("api_keys")
      .select("key_name, encrypted_value")
      .eq("user_id", user.id)
      .eq("product", "post")
      .eq("provider", "x");

    if (keysError) return NextResponse.json({ error: "DB error", detail: keysError.message }, { status: 500 });
    if (!xKeys?.length) return NextResponse.json({ error: "No X keys found", keysCount: 0 }, { status: 404 });

    // key_name一覧
    const keyNames = xKeys.map((k) => k.key_name);

    // 復号
    const keyMap: Record<string, string> = {};
    const decryptionResults: Record<string, { length: number; prefix: string; looksValid: boolean }> = {};

    for (const k of xKeys) {
      const decrypted = decrypt(k.encrypted_value);
      keyMap[k.key_name] = decrypted;
      decryptionResults[k.key_name] = {
        length: decrypted.length,
        prefix: decrypted.slice(0, 6) + "...",
        looksValid: decrypted.length > 10 && !decrypted.includes("{") && !decrypted.includes("="),
      };
    }

    const credentials = {
      consumerKey: keyMap["consumer_key"] || keyMap["consumerKey"],
      consumerSecret: keyMap["consumer_secret"] || keyMap["consumerSecret"],
      accessToken: keyMap["access_token"] || keyMap["accessToken"],
      accessTokenSecret: keyMap["access_token_secret"] || keyMap["accessTokenSecret"],
    };

    const missingKeys = [];
    if (!credentials.consumerKey) missingKeys.push("consumerKey");
    if (!credentials.consumerSecret) missingKeys.push("consumerSecret");
    if (!credentials.accessToken) missingKeys.push("accessToken");
    if (!credentials.accessTokenSecret) missingKeys.push("accessTokenSecret");

    if (missingKeys.length > 0) {
      return NextResponse.json({
        error: "Missing keys after mapping",
        keyNames,
        missingKeys,
        decryptionResults,
      }, { status: 400 });
    }

    // テスト1: GET /2/users/me (読み取り権限テスト)
    const meUrl = "https://api.twitter.com/2/users/me";
    const meAuth = buildOAuthHeader("GET", meUrl, credentials);
    const meRes = await fetch(meUrl, {
      method: "GET",
      headers: { Authorization: meAuth },
    });
    const meStatus = meRes.status;
    const meBody = await meRes.text();

    // テスト2: POST /2/tweets のドライラン的確認（実際には投稿しない）
    // 代わりにユーザーのツイートを取得してみる
    let tweetsStatus = 0;
    let tweetsBody = "";
    try {
      const tweetsUrl = "https://api.twitter.com/2/users/me/tweets";
      // Need to sign with query params too
      const params: Record<string, string> = { max_results: "5" };
      const nonce = crypto.randomBytes(16).toString("hex");
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const oauthParams: Record<string, string> = {
        oauth_consumer_key: credentials.consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: timestamp,
        oauth_token: credentials.accessToken,
        oauth_version: "1.0",
      };
      const allParams = { ...oauthParams, ...params };
      oauthParams.oauth_signature = generateOAuthSignature("GET", "https://api.twitter.com/2/users/me/tweets", allParams, credentials.consumerSecret, credentials.accessTokenSecret);
      const tweetsAuth = "OAuth " + Object.keys(oauthParams).sort().map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`).join(", ");

      const tweetsRes = await fetch(`${tweetsUrl}?max_results=5`, {
        method: "GET",
        headers: { Authorization: tweetsAuth },
      });
      tweetsStatus = tweetsRes.status;
      tweetsBody = await tweetsRes.text();
    } catch (err: any) {
      tweetsBody = err.message;
    }

    return NextResponse.json({
      keyNames,
      decryptionResults,
      credentialLengths: {
        consumerKey: credentials.consumerKey.length,
        consumerSecret: credentials.consumerSecret.length,
        accessToken: credentials.accessToken.length,
        accessTokenSecret: credentials.accessTokenSecret.length,
      },
      tests: {
        "GET /2/users/me": { status: meStatus, body: meBody.slice(0, 500) },
        "GET /2/users/me/tweets": { status: tweetsStatus, body: tweetsBody.slice(0, 500) },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
