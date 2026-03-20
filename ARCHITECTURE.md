# SHIROKUMA Post — システム設計書

## 概要

AI を使って SNS 投稿を自動生成・投稿する SaaS。ユーザーが自分の「コンセプト（思想・理論）」を登録すると、AI がその人らしい投稿を生成する。X と Threads に対応。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| バックエンド | Next.js API Routes (Route Handlers) |
| DB / 認証 | Supabase (PostgreSQL + Auth + RLS) |
| AI | BYOK 方式 — Anthropic (Claude) / OpenAI (GPT) / Google (Gemini) |
| SNS | X API v2 (OAuth 1.0a) / Threads API (Meta) |
| 決済 | Stripe (Checkout + Portal + Webhook) |
| 暗号化 | AES-256-GCM（API キーの保存） |

---

## ディレクトリ構成

```
src/
├── app/
│   ├── api/                    # API Routes
│   │   ├── admin/switch-plan/  # [開発用] プラン切り替え
│   │   ├── apikeys/            # API キー CRUD
│   │   ├── cron/post/          # Dispatcher: 対象スロットを洗い出して Worker を個別呼び出し
│   │   ├── worker/post/        # Worker: 1ユーザー×1スロットの AI 生成 + SNS 投稿
│   │   ├── dashboard/          # ダッシュボード統計
│   │   ├── generate/           # AI 投稿生成
│   │   ├── learning-posts/     # 学習データ CRUD
│   │   ├── philosophy/         # コンセプト CRUD
│   │   │   └── structure/      # AI 構造化エンドポイント
│   │   ├── post/               # SNS 投稿実行
│   │   ├── posts/              # 投稿履歴 CRUD
│   │   ├── schedule/           # スケジュール設定 CRUD
│   │   ├── stripe/             # Stripe 連携 (checkout / portal / webhook)
│   │   └── style-defaults/     # デフォルトスタイル設定 CRUD
│   ├── auth/
│   │   ├── callback/           # OAuth コールバック
│   │   └── login/              # ログインページ
│   ├── dashboard/
│   │   ├── layout.tsx          # サイドバー付きレイアウト
│   │   ├── page.tsx            # ダッシュボードトップ
│   │   ├── posts/              # 投稿生成・管理
│   │   ├── schedule/           # スケジュール設定
│   │   ├── settings/           # 設定（コンセプト / APIキー / デフォルトスタイル）
│   │   └── learning/           # 学習データ管理
│   ├── pricing/                # 料金ページ
│   ├── layout.tsx              # ルートレイアウト
│   ├── page.tsx                # LP
│   └── globals.css
├── components/
│   ├── admin/                  # プラン切り替え（開発用）
│   ├── layout/sidebar.tsx      # サイドバー
│   └── ui/                     # 共通 UI (Button, Card)
├── lib/
│   ├── ai/
│   │   ├── generate-post.ts    # プロンプトビルダー + AI API 呼び出し
│   │   └── learning-context.ts # 学習データ → プロンプト変換
│   ├── crypto.ts               # AES-256-GCM 暗号化/復号化
│   ├── plans.ts                # プラン定義・制限チェック
│   ├── sns/
│   │   ├── post-x.ts           # X API 投稿
│   │   └── post-threads.ts     # Threads API 投稿
│   ├── stripe.ts               # Stripe クライアント初期化
│   ├── supabase/
│   │   ├── client.ts           # ブラウザ用 Supabase クライアント
│   │   ├── middleware.ts        # Auth ミドルウェア
│   │   └── server.ts           # サーバー用 Supabase クライアント
│   └── utils.ts                # ユーティリティ (cn)
├── middleware.ts                # Next.js ミドルウェア（認証チェック）
└── types/
    └── database.ts             # DB 型定義
```

---

## DB スキーマ（8 テーブル）

### profiles
ユーザー情報。Supabase Auth の `auth.users` と 1:1。新規ユーザー登録時にトリガーで自動作成。

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID (PK) | auth.users.id と同一 |
| display_name | TEXT | 表示名 |
| email | TEXT | メールアドレス |
| plan | TEXT | `free` / `pro` / `business` |
| daily_post_count | INT | 当日の投稿数 |
| daily_reset_at | DATE | カウントリセット日 |
| stripe_customer_id | TEXT | Stripe 顧客 ID |
| stripe_subscription_id | TEXT | Stripe サブスク ID |
| stripe_subscription_status | TEXT | Stripe ステータス |
| style_defaults | JSONB | デフォルトスタイル設定 `{ style, character, customStyles[], customCharacters[] }` |

### api_keys
BYOK 用の API キー。AES-256-GCM で暗号化して保存。

| カラム | 型 | 説明 |
|---|---|---|
| provider | TEXT | `anthropic` / `openai` / `google` / `x` / `threads` |
| key_name | TEXT | キー種別（`api_key`, `consumer_key` 等） |
| encrypted_value | TEXT | 暗号化された値 |

### philosophies
ユーザーのコンセプト（思想・理論テキスト）。1 ユーザー 1 アクティブ。

| カラム | 型 | 説明 |
|---|---|---|
| content | TEXT | 原文テキスト |
| summary | TEXT | 構造化サマリー JSON（`_type: "structured"` フラグ付き） |
| core_concepts | JSONB | レガシー：概念リスト |
| is_active | BOOLEAN | アクティブフラグ（ユニーク制約あり） |

**構造化サマリーの 7 カテゴリ**（すべてオプション）:
```json
{
  "_type": "structured",
  "axiom": "公理（絶対前提）",
  "structure": "理論の骨格",
  "logic": "導出の筋道",
  "weapons": ["フレームワーク1", "フレームワーク2"],
  "stance": "何を否定し、何を主張するか",
  "method": "実践の手順",
  "voice": "口調・トーンの特徴"
}
```

### posts
AI 生成された投稿と投稿結果。

| カラム | 型 | 説明 |
|---|---|---|
| content | TEXT | 投稿テキスト |
| style_used | TEXT (nullable) | 使用したスタイル |
| status | TEXT | `draft` / `scheduled` / `posted` / `failed` |
| sns_post_ids | JSONB | 各 SNS の投稿 ID `{ x: {...}, threads: {...} }` |
| error_message | TEXT | エラー時のメッセージ |
| ai_model_used | TEXT | 使用 AI プロバイダー |

### schedule_configs
スロットベースの自動投稿設定。1 ユーザー 1 レコード。

| カラム | 型 | 説明 |
|---|---|---|
| enabled | BOOLEAN | 有効/無効 |
| slots | JSONB | スロット配列 `[{ time, target, style, character, length, split }]` |
| timezone | TEXT | タイムゾーン（デフォルト: Asia/Tokyo） |

### schedule_executions
スケジュール実行ログ。

### learning_posts
伸びた投稿の学習データ。AI 分析結果を保存。

| カラム | 型 | 説明 |
|---|---|---|
| content | TEXT | 投稿テキスト |
| platform | TEXT | `x` / `threads` |
| metrics | JSONB | エンゲージメント指標 |
| ai_analysis | JSONB | AI 分析結果 `{ structure, hook_type, tone, key_technique }` |

---

## 投稿生成フロー

```
ユーザー操作 / cron
    ↓
[POST /api/generate]
    ↓
1. 認証チェック (Supabase Auth)
2. リクエスト解析 (style, character, snsTarget, postLength, splitMode)
3. philosophies テーブルからコンセプト取得
4. api_keys テーブルから AI API キー取得 → 復号化
5. 時間帯自動判定 (morning / noon / night)
6. learning_posts から学習データ取得
7. 過去投稿取得（重複回避用）
8. プロンプト生成
   ├── ai_optimized → 学習データ主軸プロンプト（buildAiOptimizedPrompt）
   ├── mix → ランダムスタイル選択 → buildPrompt
   └── その他 → 指定スタイル → buildPrompt
   ※ 学習データは ai_optimized 時のみビルダー内で使用、他は補助的に後付け
9. AI API 呼び出し (Anthropic / OpenAI / Google)
10. レスポンス返却
```

---

## 投稿スタイル（6 種）

| ID | 名前 | 説明 |
|---|---|---|
| `mix` | ミックス | 4 スタイルからランダム選択 |
| `paradigm_break` | 常識破壊 | 当たり前をぶっ壊す |
| `provocative` | 毒舌問いかけ | 核心を突く問い |
| `flip` | ひっくり返し | 視点を 180 度変える |
| `poison_story` | 毒入りストーリー | 毒を仕込んだ物語 |
| `ai_optimized` | AI 最適化 | 学習データから最適なスタイル・構造を AI が自動選択 |

**AI 最適化の動作**:
- 学習データあり → 伸びた投稿のパターン（構造・フック・トーン・テクニック）を主軸にして生成
- 学習データなし → 思想・時間帯・SNS プラットフォームから AI が最適スタイルを自動判断

---

## キャラ設定（11 種 + カスタム）

なし / ギャル / 哲学者 / 主婦 / 元ヤン / 熱血教師 / オタク / ギャルママ / ホスト / 坊主 / 子ども

Pro プラン以上でカスタムキャラ・カスタムスタイル作成可能（最大各 5 個）。

---

## デフォルトスタイル設定

Settings の「デフォルトスタイル」タブで設定した値が以下に反映される:

- **Posts ページ**: 開いた時点でデフォルトのスタイル・キャラが選択済み。変えたいときだけ手動変更。
- **Schedule ページ**: 新規スロット追加時にデフォルト値が初期値として適用。既存スロットは保存済みの値を維持。

---

## プラン体系

| | Free | Pro (¥980/月) | Business (¥2,980/月) |
|---|---|---|---|
| 投稿数/日 | 3 | 10 | 無制限 |
| スケジュール枠 | 3 | 10 | 無制限 |
| キャラ設定 | × | 10 種 | 10 種 |
| 短い投稿 | × | ○ | ○ |
| Threads | × | × | ○ |
| 分割投稿 | × | × | ○ |
| 長文投稿 | × | × | ○ |
| カスタムスタイル/キャラ | × | ○ | ○ |

---

## セキュリティ

- **BYOK (Bring Your Own Key)**: ユーザー自身の API キーを使用。サービス側にキーを持たない。
- **AES-256-GCM 暗号化**: API キーは `ENCRYPTION_SECRET` 環境変数を使って暗号化して DB に保存。
- **RLS (Row Level Security)**: 全テーブルで有効。ユーザーは自分のデータのみ操作可能。
- **サーバーサイドキー取得**: generate / post API はサーバー側で DB からキーを復号化して使用。クライアントにキーが渡ることはない。

---

## 環境変数

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_SECRET=            # AES-256-GCM 暗号化キー
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=
NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID=
CRON_SECRET=                  # cron エンドポイント認証
```

---

## SNS 投稿フロー

### X (Twitter)
1. `POST /api/post` → provider: "x"
2. `lib/sns/post-x.ts` → OAuth 1.0a 署名 → X API v2 POST /2/tweets
3. 分割投稿: X API 制限により不可

### Threads (Meta)
1. `POST /api/post` → provider: "threads"
2. `lib/sns/post-threads.ts` → Threads Publishing API
3. 分割投稿: フック投稿 → reply_to_id でリプライチェーン

---

## 学習機能

1. ユーザーが「伸びた投稿」を learning_posts に登録
2. AI が投稿を分析し、`ai_analysis` に構造・フック・トーン・テクニックを保存
3. 投稿生成時に学習データをプロンプトに反映:
   - **通常スタイル**: 学習データを補助的に付加（「勝ちパターンを参考にしてください」）
   - **AI 最適化スタイル**: 学習データを主軸にプロンプト構築（スタイル・構造を AI が自動選択）

---

## 自動投稿（スケジュール）— Dispatcher + Worker パターン

Vercel 等のサーバーレス環境ではタイムアウト制限（Hobby: 10秒、Pro: 60秒）があるため、
cron が全ユーザーを直列処理するとユーザー数増加でタイムアウトする。
これを回避するため **Dispatcher + Worker** パターンを採用。

```
外部 cron → /api/cron/post (Dispatcher)
               │  対象スロットを洗い出し（数秒で完了）
               │
               ├── fetch → /api/worker/post { userId: A, slot: {...} }
               ├── fetch → /api/worker/post { userId: B, slot: {...} }
               └── fetch → /api/worker/post { userId: C, slot: {...} }
                              │
                              └── 1ユーザー × 1スロットの処理
                                  AI生成 → SNS投稿 → DB保存（10〜15秒）
```

### Dispatcher（`/api/cron/post` — GET）
1. `CRON_SECRET` で認証
2. `schedule_configs` から enabled=true を取得
3. 現在時刻にマッチするスロットを特定（±4分の窓）
4. 今日すでに実行済みのスロットはスキップ
5. 各タスクを `/api/worker/post` に並列 fetch で発火（3秒タイムアウト = 送信確認のみ）
6. 結果サマリーを返して終了

### Worker（`/api/worker/post` — POST）
1. `CRON_SECRET` で認証
2. payload: `{ userId, slot }` を受け取る
3. 1ユーザー × 1スロット分の処理を実行:
   - コンセプト取得 → AI キー取得・復号 → 学習データ取得
   - AI 生成 → SNS 投稿 → posts テーブルに保存
   - schedule_executions にログ記録 → daily_post_count をインクリメント
4. 失敗時は schedule_executions に error を記録

### スケーラビリティ
- Dispatcher は対象が 100 人でも数秒で完了（fetch を投げるだけ）
- Worker は 1 回 10〜15 秒で収まるため Vercel Pro の 60 秒制限内
- 将来的に外部キュー（QStash / Inngest）に切り替え可能（Worker の URL を向け先にするだけ）

---

## 構造化サマリー

ユーザーが登録したコンセプトテキストを AI が 7 カテゴリに自動分類。投稿生成時のプロンプトに使われる。

**エンドポイント**: `POST /api/philosophy/structure`

**入力**: 原文テキスト（最大 8,000 文字）
**出力**: 7 カテゴリ JSON（部分入力 OK — 最低限重要なカテゴリが埋まればよい）

生成されたサマリーは `philosophies.summary` に `_type: "structured"` フラグ付きで保存。`parseStructuredSummary()` が構造化データかプレーンテキストかを判定。
