import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export interface ScheduleSlot {
  time: string;       // "09:00"
  target: "x" | "threads";
  style: string;      // "mix" | "paradigm_break" | etc.
  character: string;  // "none" | "gal" | etc.
  length: string;     // "short" | "standard" | "long"
  split: boolean;
}

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
    const { enabled, slots, require_approval, trend_enabled } = body as {
      enabled: boolean;
      slots: ScheduleSlot[];
      require_approval?: boolean;
      trend_enabled?: boolean;
    };

    const { data, error } = await supabase
      .from("schedule_configs")
      .upsert({
        user_id: user.id,
        enabled: enabled ?? false,
        require_approval: require_approval ?? false,
        trend_enabled: trend_enabled ?? false,
        slots: slots || [],
        timezone: "Asia/Tokyo",
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
