# SHIROKUMA Post

AIがあなたの思想を自動でSNS投稿に変換する、BYOK型発信エンジン。

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集して Supabase の URL と Key を設定

# Supabase プロジェクト作成
# 1. https://supabase.com でプロジェクト作成
# 2. supabase/migrations/001_initial_schema.sql を SQL Editor で実行
# 3. .env に URL と Anon Key を設定

# 開発サーバー起動
npm run dev
```

## ディレクトリ構成

```
src/
├── app/
│   ├── auth/          # 認証 (login, callback)
│   ├── dashboard/     # メイン画面 (posts, schedule, settings)
│   └── api/           # API Routes (generate, post)
├── components/        # UIコンポーネント
├── lib/
│   ├── supabase/      # Supabase client/server
│   ├── ai/            # AI投稿生成エンジン (BYOK対応)
│   └── sns/           # SNS投稿 (X, Threads)
└── types/             # TypeScript型定義
```

## BYOK対応AIプロバイダー

- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL + RLS)
