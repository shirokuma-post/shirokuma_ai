import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users to login
  if (
    !user &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  // ※ update-password はパスワードリセットリンク経由でセッション復元後にアクセスするため除外
  // ※ callback はOAuth/メール確認のコールバックなので除外
  if (user && pathname.startsWith("/auth") && !pathname.startsWith("/auth/update-password") && !pathname.startsWith("/auth/callback")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // オンボーディング未完了のユーザーをリダイレクト
  // dashboardにアクセスしようとしたとき、cookieでチェック
  if (user && pathname.startsWith("/dashboard")) {
    const onboardingDone = request.cookies.get("post_onboarding_completed")?.value;
    if (onboardingDone === undefined) {
      try {
        // cookieがない場合、DBを確認してcookieをセット
        const { data: profile } = await supabase
          .from("profiles")
          .select("post_onboarding_completed")
          .eq("id", user.id)
          .single();

        if (profile && profile.post_onboarding_completed === false) {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding";
          return NextResponse.redirect(url);
        }
        // オンボーディング完了済み or カラム未存在 → cookieセットして通過
        if (profile?.post_onboarding_completed) {
          supabaseResponse.cookies.set("post_onboarding_completed", "1", {
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            httpOnly: true,
            sameSite: "lax",
          });
        }
      } catch {
        // DB未マイグレーション等のエラー時はスキップして通過
      }
    }
  }

  return supabaseResponse;
}
