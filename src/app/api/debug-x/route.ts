import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";

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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 環境情報
    const envInfo = {
      encryptionSecretLength: (process.env.ENCRYPTION_SECRET || "").length,
      encryptionSecretPrefix: (process.env.ENCRYPTION_SECRET || "").slice(0, 10),
      nodeVersion: process.version,
    };

    const { data: xKeys } = await supabase
      .from("api_keys")
      .select("user_id, key_name, encrypted_value")
      .eq("provider", "x");

    if (!xKeys?.length) return NextResponse.json({ error: "No X keys", envInfo });

    const userId = xKeys[0].user_id;
    const userKeys = xKeys.filter((k) => k.user_id === userId);
    const keyMap: Record<string, string> = {};
    const decryptionResults: Record<string, { length: number; prefix: string }> = {};

    for (const k of userKeys) {
      const decrypted = decrypt(k.encrypted_value);
      keyMap[k.key_name] = decrypted;
      decryptionResults[k.key_name] = {
        length: decrypted.length,
        prefix: decrypted.slice(0, 6) + "...",
      };
    }

    const credentials = {
      consumerKey: keyMap["consumer_key"] || keyMap["consumerKey"],
      consumerSecret: keyMap["consumer_secret"] || keyMap["consumerSecret"],
      accessToken: keyMap["access_token"] || keyMap["accessToken"],
      accessTokenSecret: keyMap["access_token_secret"] || keyMap["accessTokenSecret"],
    };

    // テスト1: GET (読み取り)
    const meUrl = "https://api.twitter.com/2/users/me";
    const meRes = await fetch(meUrl, {
      method: "GET",
      headers: { Authorization: buildOAuthHeader("GET", meUrl, credentials) },
    });
    const meBody = await meRes.text();

    // テスト2: POST (書き込み)
    const postUrl = "https://api.twitter.com/2/tweets";
    const testText = "本番テスト " + new Date().toISOString().slice(0, 19);
    const postRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        Authorization: buildOAuthHeader("POST", postUrl, credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: testText }),
    });
    const postBody = await postRes.text();

    return NextResponse.json({
      envInfo,
      decryptionResults,
      tests: {
        "GET /2/users/me": { status: meRes.status, body: meBody.slice(0, 300) },
        "POST /2/tweets": { status: postRes.status, body: postBody.slice(0, 300) },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack?.slice(0, 300) }, { status: 500 });
  }
}
