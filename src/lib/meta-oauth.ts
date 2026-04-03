// =====================================================
// Meta OAuth 2.0 - Threads + Instagram 認証
// Meta App 1つで Threads と Instagram 両方をカバー
// ※ Stores版をPost用にシンプル化（shop_id不要）
// =====================================================

export function getMetaOAuthConfig() {
  return {
    clientId: process.env.META_APP_ID || "",
    clientSecret: process.env.META_APP_SECRET || "",
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/meta/callback`,
  };
}

// ---------- OAuth認証URL生成 ----------

export function getThreadsAuthUrl(state: string): string {
  const config = getMetaOAuthConfig();
  const scopes = [
    "threads_basic",
    "threads_content_publish",
    "threads_manage_replies",
    "threads_read_replies",
  ].join(",");

  return `https://threads.net/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${scopes}&response_type=code&state=${state}`;
}

export function getInstagramAuthUrl(state: string): string {
  const config = getMetaOAuthConfig();
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
  ].join(",");

  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${scopes}&response_type=code&state=${state}`;
}

// ---------- 認証コード → アクセストークン交換 ----------

export async function exchangeThreadsCode(code: string): Promise<{
  accessToken: string;
  userId: string;
}> {
  const config = getMetaOAuthConfig();

  // Short-lived token
  const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Threads token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();

  // Exchange for long-lived token (60 days)
  const longLivedRes = await fetch(
    `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${config.clientSecret}&access_token=${tokenData.access_token}`
  );

  if (!longLivedRes.ok) {
    return {
      accessToken: tokenData.access_token,
      userId: tokenData.user_id,
    };
  }

  const longLivedData = await longLivedRes.json();
  return {
    accessToken: longLivedData.access_token,
    userId: tokenData.user_id,
  };
}

export async function exchangeInstagramCode(code: string): Promise<{
  accessToken: string;
  userId: string;
  pageId: string;
  igBusinessAccountId: string;
}> {
  const config = getMetaOAuthConfig();

  // Step 1: Exchange code for user access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${config.clientId}&client_secret=${config.clientSecret}&redirect_uri=${encodeURIComponent(config.redirectUri)}&code=${code}`
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Instagram token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();
  const userAccessToken = tokenData.access_token;

  // Step 2: Get long-lived token
  const longLivedRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.clientId}&client_secret=${config.clientSecret}&fb_exchange_token=${userAccessToken}`
  );
  const longLivedData = longLivedRes.ok ? await longLivedRes.json() : { access_token: userAccessToken };

  // Step 3: Get user's pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedData.access_token}`
  );
  const pagesData = await pagesRes.json();

  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error("Facebookページが見つかりません。Instagram Businessアカウントにはページが必要です。");
  }

  const page = pagesData.data[0];

  // Step 4: Get Instagram Business Account ID from page
  const igRes = await fetch(
    `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
  );
  const igData = await igRes.json();

  if (!igData.instagram_business_account) {
    throw new Error("Instagram ビジネスアカウントが見つかりません。Facebookページにinstagramアカウントをリンクしてください。");
  }

  return {
    accessToken: page.access_token, // Page-level token for IG publishing
    userId: igData.instagram_business_account.id,
    pageId: page.id,
    igBusinessAccountId: igData.instagram_business_account.id,
  };
}

// ---------- トークンリフレッシュ ----------

export async function refreshThreadsToken(currentToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const res = await fetch(
    `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${currentToken}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads token refresh failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshInstagramToken(currentToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const config = getMetaOAuthConfig();
  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.clientId}&client_secret=${config.clientSecret}&fb_exchange_token=${currentToken}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Instagram token refresh failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000, // default 60 days
  };
}
