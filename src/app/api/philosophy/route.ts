import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// マイコンセプト取得
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("philosophies")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ philosophy: data });
}

// マイコンセプト保存
export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, content } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  // 既存のアクティブなコンセプトを非アクティブに
  await supabase
    .from("philosophies")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);

  // 新規保存
  const { data, error } = await supabase
    .from("philosophies")
    .insert({
      user_id: user.id,
      title,
      content,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ philosophy: data });
}
