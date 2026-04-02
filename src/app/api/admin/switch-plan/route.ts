import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// テスト用: プラン切り替えAPI（管理者メールのみ許可）
const ADMIN_EMAILS = ["aburi1000@gmail.com"];

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await request.json();
    if (!["free", "pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ post_plan: plan })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, post_plan: plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
