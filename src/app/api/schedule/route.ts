import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: config } = await supabase.from("schedule_configs").select("*").eq("user_id", user.id).single();
    const { data: executions } = await supabase.from("schedule_executions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);

    return NextResponse.json({ config: config || null, executions: executions || [] });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { enabled, times, timezone, snsTargets, style, postLength, splitMode, character } = body;

    const { data, error } = await supabase
      .from("schedule_configs")
      .upsert({
        user_id: user.id,
        enabled: enabled ?? false,
        times: times || ["07:00", "12:30", "21:00"],
        timezone: timezone || "Asia/Tokyo",
        sns_targets: snsTargets || ["x"],
        style: style || "mix",
        post_length: postLength || "standard",
        split_mode: splitMode || false,
        character_type: character || "none",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error("Schedule save error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
