import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export interface ScheduleSlot {
  time: string;       // "09:00"
  target: "x" | "threads" | "instagram";
  style: string;      // "mix" | "kizuki" | "hitokoto" | etc.
  character: string;  // "none" | "gal" | etc.
  length: string;     // "short" | "standard" | "long"
  split: boolean;
  useTrend?: boolean;
  theme?: string;
}

export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: config } = await supabase.schema('post').from("schedule_configs").select("*").eq("user_id", user.id).single();
    const { data: executions } = await supabase.schema('post').from("schedule_executions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);

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
    const { enabled, slots, skip_confirmation, trend_enabled, trend_categories, local_area, ig_cycle } = body as {
      enabled: boolean;
      slots: ScheduleSlot[];
      skip_confirmation?: boolean;
      trend_enabled?: boolean;
      trend_categories?: string[];
      local_area?: string;
      ig_cycle?: { enabled: boolean; intervalDays: number };
    };

    // スロットを時間順にソート（例: 12:00, 08:00, 10:00 → 08:00, 10:00, 12:00）
    const sortedSlots = [...(slots || [])].sort((a: ScheduleSlot, b: ScheduleSlot) =>
      a.time.localeCompare(b.time)
    );

    const { data, error } = await supabase
      .schema('post').from("schedule_configs")
      .upsert({
        user_id: user.id,
        enabled: enabled ?? false,
        skip_confirmation: skip_confirmation ?? false,
        trend_enabled: trend_enabled ?? false,
        trend_categories: trend_categories ?? ["general", "technology", "business"],
        local_area: local_area || null,
        ig_cycle: ig_cycle || null,
        slots: sortedSlots,
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
