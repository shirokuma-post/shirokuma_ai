# しろくまポスト（個人向け）

## このプロダクトの役割

しろくまSaaS 5プロダクトの1つ。**個人事業主・コンサルタント・コーチ向け**のSNS自動投稿サービス。
ユーザーが自分の思想・世界観をアップロードすると、AIが毎日SNSに投稿する。

**体系内のポジション：** Target（統括）→ **Post（実行）** / Stores / Step / Clip

## 技術スタック

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS + Storage)
- AI: Claude / GPT-4o / Gemini (個人BYOK — ユーザー本人がキーを管理)
- Stripe (Free / Pro ¥980 / Business ¥2,980)
- Upstash QStash (スケジュール配信) + Redis (レート制限)
- Vercel デプロイ: https://shirokumapos.vercel.app

## 主要ディレクトリ

```
src/
├── app/api/          # APIルート (generate, post, cron, worker, stripe等)
│   ├── post/         # SNS投稿API (X, Threads, Instagram対応)
│   ├── worker/post/  # QStashワーカー (スケジュール投稿実行)
│   ├── generate-caption/ # AIキャプション生成 (Vision API)
│   ├── upload-image/ # 画像アップロード (Supabase Storage)
│   └── threads/refresh-token/ # Threadsトークン自動更新
├── app/dashboard/    # ダッシュボード (posts, schedule, settings, learning)
├── app/auth/         # 認証
├── components/       # UI (sidebar, admin, promo, ui)
├── lib/
│   ├── ai/           # 投稿生成 (generate-post.ts, generation-service.ts, learning-context.ts)
│   ├── supabase/     # DB (client.ts, server.ts, service.ts)
│   ├── plans.ts      # プラン定義・機能ゲート
│   ├── crypto.ts     # AES-256-GCM暗号化
│   └── rate-limit.ts # Upstash Redis レート制限
└── types/database.ts # DB型定義
```

## コア機能

- **投稿OS（コンセプト）:** テキスト入力 → AIが6フィールドに構造化（情熱/ビジョン/信念/武器/スタンス/原点）
- **11投稿スタイル:** kizuki, toi, honne, yorisoi, osusowake, monogatari, uragawa, yoin, hitokoto, mix, auto
- **10軸キャラクター:** 性別, 家族, 方言, 年齢, 距離感, 毒舌度, 上品さ(主軸), エネルギー, 絵文字, 一人称/語尾/口癖
- **スケジュール自動投稿:** cron/generate(2:00 JST) → QStash → worker/post
- **学習機能:** 成功投稿を分析 → 生成に反映
- **SNS:** X (OAuth 1.0a) + Threads (Meta Graph API) + Instagram (Meta Graph API)
- **画像投稿:** Supabase Storageに画像アップロード → SNS投稿に添付
- **AIキャプション生成:** Vision API (Claude/GPT-4o/Gemini) で画像からキャプション自動生成
- **Threadsトークン自動更新:** 60日有効期限の監視・警告・自動リフレッシュ

## 他プロダクトとの連携（計画）

- **Targetから受け取るもの:** ビジョン、LF8プロファイル、訴求ワード → 投稿OSのコンセプトに自動反映、スタイル推薦
- **Storesとの関係:** フォーク元。共通のアーキテクチャだが、Post=個人BYOK / Stores=代理店BYOK
- **Stepとの関係:** Postが認知・興味を獲得、Stepがナーチャリング→購買を担う

## 注意事項

- APIキーは `crypto.ts` の AES-256-GCM で暗号化保存。クライアントに送信しない
- 全テーブルにRLS適用（`auth.uid() = user_id`）
- Vercel Hobby = cron 1つ/日 制限 → QStashで回避済み
- 管理者メール: `aburi1000@gmail.com` がハードコード（要改善）
- Instagram投稿には画像が必須（テキストのみ投稿不可）
- worker→post の内部API呼び出しには `CRON_SECRET` ヘッダーが必要
