// =====================================================
// SHIROKUMA Post - Database Types
// =====================================================

export type AiProvider = "anthropic" | "openai" | "google" | "other";
export type SnsProvider = "x" | "threads";
export type PostStatus = "draft" | "scheduled" | "posted" | "failed";
export type PostStyle =
  | "paradigm_break"
  | "provocative"
  | "flip"
  | "poison_story"
  | "mix";

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  provider: AiProvider | SnsProvider;
  key_name: string; // e.g. "Claude API Key", "X Consumer Key"
  encrypted_value: string;
  metadata: Record<string, string> | null; // extra fields like access_token, etc.
  is_valid: boolean;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Philosophy {
  id: string;
  user_id: string;
  title: string;
  content: string; // the uploaded document text
  summary: string | null; // AI-extracted summary
  core_concepts: string[] | null; // AI-extracted key concepts
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostConfig {
  id: string;
  user_id: string;
  philosophy_id: string;
  ai_provider: AiProvider;
  sns_targets: SnsProvider[];
  post_style: PostStyle;
  schedule_times: string[]; // e.g. ["07:00", "12:30", "21:00"]
  timezone: string;
  banned_words: string[];
  custom_prompt: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  config_id: string;
  content: string;
  style_used: PostStyle;
  status: PostStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  sns_post_ids: Record<string, string> | null; // { x: "tweet_id", threads: "media_id" }
  error_message: string | null;
  ai_model_used: string | null;
  created_at: string;
}
