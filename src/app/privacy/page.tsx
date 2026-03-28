import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | SHIROKUMA Post",
  description: "SHIROKUMA Postのプライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/shirokuma-logo.png" alt="SHIROKUMA Post" width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-gray-900">SHIROKUMA</span>
            <span className="text-brand-600 font-medium">Post</span>
          </div>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← トップに戻る
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-10">
          プライバシーポリシー
        </h1>

        {/* 1. 収集する情報 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            1. 収集する情報
          </h2>

          <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">
            1-1. アカウント情報
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            メールアドレス、表示名、アバター画像URL
          </p>

          <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">
            1-2. APIキー情報
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            AI APIキー（Anthropic / OpenAI / Google）、SNS APIキー（X / Threads）
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900 leading-relaxed">
              すべてのAPIキーはAES-256-GCM方式で暗号化して保存。平文保存なし。復号はサーバーサイドのみ。
            </p>
          </div>

          <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">
            1-3. コンテンツ情報
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            マイコンセプト、生成投稿、ラーニング投稿、スケジュール設定
          </p>

          <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">
            1-4. 決済情報
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            StripeカスタマーID等（クレジットカード番号はStripe社管理、当方サーバーに保存なし）
          </p>
        </section>

        {/* 2. 情報の利用目的 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            2. 情報の利用目的
          </h2>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 leading-relaxed">
            <li>サービス提供・運営・改善</li>
            <li>AI/SNS APIへの接続（ユーザーのキー使用）</li>
            <li>投稿生成・配信</li>
            <li>サブスクリプション管理・決済</li>
            <li>重要なお知らせ通知</li>
            <li>お問い合わせ対応</li>
            <li>不正利用防止</li>
          </ul>
        </section>

        {/* 3. 情報の第三者提供 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            3. 情報の第三者提供
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            原則として第三者に提供しません。ただし、ユーザーの同意がある場合、法令に基づく場合、および以下の外部サービス連携を除きます。
          </p>
          <div className="text-sm text-gray-600 leading-relaxed">
            <p className="font-semibold text-gray-800 mb-2">外部サービス一覧:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Supabase（認証・データベース）</li>
              <li>Vercel（ホスティング）</li>
              <li>Stripe（決済）</li>
              <li>Resend（メール）</li>
              <li>Upstash（スケジューリング・レートリミット）</li>
              <li>AI API各社（Anthropic / OpenAI / Google）</li>
              <li>SNS API各社（X / Threads）</li>
            </ul>
          </div>
        </section>

        {/* 4. データの保護 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            4. データの保護
          </h2>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 leading-relaxed">
            <li>AES-256-GCM暗号化（APIキー）</li>
            <li>Row Level Security（データベース）</li>
            <li>SSL/TLS通信</li>
            <li>Stripe署名検証（Webhook）</li>
            <li>レートリミット</li>
          </ul>
        </section>

        {/* 5. データの保持期間 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            5. データの保持期間
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            アカウントが有効な期間中は保持します。削除申請から30日以内にすべてのデータを削除します。
          </p>
        </section>

        {/* 6. お客様の権利 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            6. お客様の権利
          </h2>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 leading-relaxed">
            <li>アクセス権（ご自身のデータの閲覧）</li>
            <li>訂正権（データの修正）</li>
            <li>削除権（アカウント・データの削除）</li>
            <li>APIキー管理（追加・変更・削除）</li>
          </ul>
          <p className="text-sm text-gray-500 mt-2">
            上記はすべてアプリ内から操作可能です。
          </p>
        </section>

        {/* 7. Cookie等の使用 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            7. Cookie等の使用
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            認証維持目的のみに使用します。トラッキングCookieは使用していません。
          </p>
        </section>

        {/* 8. BYOK方式に関する特記事項 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            8. BYOK方式に関する特記事項
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900 leading-relaxed">
              APIキーはユーザーアカウントに紐づき、AI
              APIへのリクエストはユーザーのキーで直接実行されます。当方は利用内容を監視・記録しません。いつでもアプリ内から削除・変更可能です。
            </p>
          </div>
        </section>

        {/* 9. プライバシーポリシーの変更 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            9. プライバシーポリシーの変更
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            必要に応じて本ポリシーを変更することがあります。重要な変更がある場合は、サービス内またはメールにて通知します。
          </p>
        </section>

        {/* 10. お問い合わせ */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 pb-2 border-b border-gray-200 mb-4">
            10. お問い合わせ
          </h2>
          <dl className="text-sm text-gray-600 space-y-2">
            <div className="flex gap-4">
              <dt className="font-semibold text-gray-800 shrink-0">事業者名:</dt>
              <dd>S.S.M (shirokuma sustainable marketing)</dd>
            </div>
            <div className="flex gap-4">
              <dt className="font-semibold text-gray-800 shrink-0">メール:</dt>
              <dd>shirokuma@shirokuma-sensei.com</dd>
            </div>
          </dl>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <p>S.S.M (shirokuma sustainable marketing)</p>
      </footer>
    </div>
  );
}
