// =====================================================
// SHIROKUMA Post - Database Types
// DBスキーマ: supabase/schema.sql と同期すること
// =====================================================

export type AiProvider = "anthropic" | "openai" | "google";
export type SnsProvider = "x" | "threads";
export type PostStatus = "draft" | "scheduled" | "posted" | "failed";
export type PostStyle =
  | "paradigm_break"
  | "provocative"
  | "flip"
  | "poison_story"
  | "mix";
export type PlanType = "free" | "pro" | "business";

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  plan: PlanType;
  daily_post_count: number;
  daily_reset_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  provider: AiProvider | SnsProvider;
  key_name: string;
  encrypted_value: string;
  metadata: Record<string, string> | null;
  is_valid: boolean;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Philosophy {
  id: string;
  user_id: string;
  title: string;
  content: string;              // 元テキスト（自由記述）
  summary: string | null;       // 構造化サマリーJSON or プレーンテキスト
  core_concepts: string[] | null; // レガシー（構造化以前）
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  style_used: PostStyle | null;
  status: PostStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  sns_post_ids: Record<string, any> | null;
  error_message: string | null;
  ai_model_used: string | null;
  created_at: string;
}

export interface ScheduleSlot {
  time: string;
  target: SnsProvider;
  style: string;
  character: string;
  length: string;
  split: boolean;
}

export interface ScheduleConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  slots: ScheduleSlot[];
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleExecution {
  id: string;
  user_id: string;
  scheduled_time: string;
  executed_at: string;
  status: "success" | "failed" | "skipped";
  post_id: string | null;
  sns_results: Record<string, any> | null;
  error_message: string | null;
  created_at: string;
}

export interface LearningPost {
  id: string;
  user_id: string;
  content: string;
  platform: string;
  metrics: Record<string, any>;
  ai_analysis: Record<string, any> | null;
  created_at: string;
}
