# SHIROKUMA Post — 製品仕様書

## 概要

SHIROKUMA Post は、AI を使って SNS 投稿を自動生成・自動投稿する SaaS。
ユーザーの「思想（マイコンセプト）」を軸に、刺さる投稿を AI が代筆する。

**URL**: https://shirokumapos.vercel.app
**技術スタック**: Next.js 14 (App Router) / TypeScript / Supabase / Stripe / Vercel

---

## プラン構成

| | Free | Pro (¥980/月) | Business (¥2,980/月) |
|---|---|---|---|
| 投稿数/日 | 3 | 10 | 無制限 |
| スケジュール枠 | 3 | 10 | 無制限 |
| 投稿スタイル | ミックスのみ | 全5種 | 全5種 |
| キャラ設定 | なし | 10種 | 10種 |
| 投稿の長さ | 標準のみ | 短い・標準 | 短い・標準・長い |
| 分割投稿 | × | × | ○ |
| Threads | × | × | ○ |
| 学習機能 | × | ○ (無制限) | ○ (無制限) |
| Stripe 決済 | - | ○ | ○ |

---

## 画面構成

### 1. ランディングページ (`/`)
- サービス紹介、CTA（ログイン / 無料で始める）

### 2. 認証 (`/auth/login`)
- Supabase Auth（メール認証）
- ログイン後 → `/dashboard` にリダイレクト

### 3. 料金ページ (`/pricing`)
- 3プラン表示
- 現在のプラン表示
- Stripe Checkout でアップグレード
- Stripe Customer Portal でプラン変更・解約

### 4. ダッシュボード (`/dashboard`)
- セットアップ状況（コンセプト / AI キー / X キー）
- 現在のプラン・残り投稿数
- 最近の投稿一覧

### 5. 投稿ページ (`/dashboard/posts`)
- **投稿先**: X / Threads (Business🔒)
- **投稿スタイル**: 5種（ミックス / 常識破壊 / 毒舌問いかけ / ひっくり返し / 毒入りストーリー）
- **キャラ設定**: 10種（Pro🔒）ギャル / 哲学者 / 主婦 / 元ヤン / 熱血教師 / オタク / ギャルママ / ホスト / 坊主 / 子ども
- **投稿の長さ**: 短い(60字) / 標準(120-140字) / 長い(400-500字)
- **分割投稿**: フック → リプライ形式 (Business🔒)
- AI 生成 → プレビュー → 編集 → 投稿
- 投稿履歴（ページネーション、ステータス、削除）

### 6. スケジュールページ (`/dashboard/schedule`)
- 自動投稿の有効/無効トグル
- 投稿時間（JST）× プラン上限
- 投稿先 / スタイル / キャラ / 長さ / 分割の設定
- 実行履歴の表示
- Vercel Cron（Hobby: 1日1回 / Pro: 5分間隔）

### 7. 学習ページ (`/dashboard/learning`)
- 伸びた投稿のコピペ登録
- いいね数・インプレッション数の任意入力
- AI が構造・フック・トーン・テクニックを分析
- 分析結果を AI 生成プロンプトに自動注入
- Pro🔒（Free は利用不可）

### 8. 設定ページ (`/dashboard/settings`)
- **マイコンセプト**: 思想テキストの入力・ファイルインポート
- **API キー (BYOK)**:
  - AI: Anthropic / OpenAI / Google（いずれか1つ）
  - X: Consumer Key / Secret / Access Token / Secret（4つ）
  - ※ Threads API キー設定は現在未実装
- **投稿スタイル & スケジュール**: スタイル選択、時間設定

---

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/dashboard` | ダッシュボード情報取得 |
| GET/POST | `/api/philosophy` | マイコンセプト CRUD |
| GET/POST | `/api/apikeys` | API キー管理（暗号化保存） |
| POST | `/api/generate` | AI 投稿生成 |
| POST | `/api/post` | X / Threads に投稿 |
| GET/DELETE | `/api/posts` | 投稿履歴管理 |
| GET/POST | `/api/schedule` | スケジュール設定 |
| GET | `/api/cron/post` | Cron 自動投稿実行 |
| GET/POST/DELETE | `/api/learning-posts` | 学習投稿 CRUD + AI 分析 |
| POST | `/api/stripe/checkout` | Stripe Checkout Session 作成 |
| POST | `/api/stripe/portal` | Stripe Customer Portal |
| POST | `/api/stripe/webhook` | Stripe Webhook 受信 |
| POST | `/api/admin/switch-plan` | テスト用プラン切替 |

---

## AI 生成エンジン

### 入力
- マイコンセプト（思想テキスト）
- 投稿スタイル（5種）
- キャラ設定（10種）
- 投稿の長さ（短/標準/長）
- 分割モード（フック + リプライ）
- 学習データ（過去の成功投稿の分析結果）
- 時間帯トーン（朝/昼/夜）

### AI プロバイダー (BYOK)
- Anthropic (Claude Sonnet)
- OpenAI (GPT-4o)
- Google (Gemini 1.5 Pro)

### 学習機能
- ユーザーが伸びた投稿をコピペ登録
- AI が構造・フック・トーン・テクニックを JSON で分析
- 分析結果をシステムプロンプト末尾に注入
- 「勝ちパターン」を参考に新しい投稿を生成

---

## SNS 投稿

### X (Twitter)
- OAuth 1.0a 認証（BYOK: 4つのキー）
- X API v2 (`/2/tweets`) で投稿
- スレッド投稿: `reply.in_reply_to_tweet_id` で返信チェーン

### Threads (Meta)
- Graph API v1.0
- 2ステップ投稿: コンテナ作成 → 公開
- スレッド投稿: `reply_to_id` で返信チェーン
- Business プラン限定
- ※ API キー設定画面は未実装（要追加）

---

## 決済 (Stripe)

- Stripe Checkout でサブスクリプション開始
- Stripe Customer Portal でプラン変更・解約
- Webhook で自動プラン更新:
  - `subscription.created/updated` → プラン適用
  - `subscription.deleted` → Free に戻す
  - `invoice.payment_failed` → ログ記録

---

## セキュリティ

- API キーは AES-256-GCM で暗号化して Supabase に保存
- 復号化はサーバーサイドのみ（`ENCRYPTION_SECRET` 環境変数）
- 既存の平文キーとの後方互換あり（移行用フォールバック）
- Supabase RLS（Row Level Security）で全テーブル保護
- Stripe Webhook は署名検証あり
- Cron は `CRON_SECRET` で認証
- テスト用プラン切替は管理者メールのみ許可

---

## データベース (Supabase / PostgreSQL)

### テーブル
- `profiles` — ユーザー情報、プラン、Stripe ID
- `philosophies` — マイコンセプト
- `api_keys` — 暗号化された API キー
- `posts` — 投稿履歴
- `schedule_configs` — スケジュール設定
- `schedule_executions` — スケジュール実行履歴
- `learning_posts` — 学習投稿 + AI 分析結果

---

## 環境変数

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO
STRIPE_PRICE_BUSINESS
CRON_SECRET
ENCRYPTION_SECRET
```

---

## 未実装・検討中

- [ ] Threads API キー設定画面（Settings に追加）
- [ ] スケジュールの時間スロットごとに投稿先を選択可能にする
- [ ] X 実投稿テスト
- [ ] Threads 実投稿テスト
- [ ] スケジュール投稿の動作確認
- [ ] テストモード用 Stripe キー（`sk_test_`）への切替
