import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | SHIROKUMA Post",
  description: "SHIROKUMA Postの特定商取引法に基づく表記",
};

const items = [
  { label: "販売事業者", value: "S.S.M (shirokuma sustainable marketing)" },
  { label: "運営統括責任者", value: "辻 千晴" },
  { label: "所在地", value: "請求があった場合、遅滞なく開示いたします" },
  { label: "電話番号", value: "請求があった場合、遅滞なく開示いたします" },
  { label: "メールアドレス", value: "shirokuma@shirokuma-sensei.com" },
  { label: "販売URL", value: "https://shirokumapos.vercel.app" },
  {
    label: "販売価格",
    value: "Free: ¥0/月、Pro: ¥980/月（税込）、Business: ¥2,980/月（税込）",
  },
  {
    label: "販売価格の補足",
    value:
      "※ 上記はツール利用料。AI API利用料（従量課金）は各AIプロバイダーに直接支払い。X APIは初回$5チャージのみ（月額ではない）",
  },
  {
    label: "販売価格以外の必要料金",
    value:
      "AI API利用料（従量課金）、X API利用料（初回$5チャージ）、インターネット接続料金",
  },
  { label: "支払方法", value: "クレジットカード（Stripe経由）" },
  {
    label: "支払時期",
    value: "申込時に初回決済、以降毎月同日に自動決済",
  },
  { label: "商品の引渡時期", value: "決済完了後、直ちにサービス利用可能" },
  {
    label: "返品・キャンセル",
    value:
      "デジタルサービスのため返金不可。サブスクリプションはいつでもキャンセル可能（次回更新日まで利用可）。アプリ内設定から操作",
  },
  {
    label: "動作環境",
    value: "モダンブラウザ最新版、インターネット接続環境",
  },
  {
    label: "特記事項",
    value:
      "BYOK方式。APIキーはユーザー自身で用意。利用料はツール料金に含まれない",
  },
];

export default function TokushohoPage() {
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
          特定商取引法に基づく表記
        </h1>

        <dl className="divide-y divide-gray-200">
          {items.map((item) => (
            <div key={item.label} className="py-4 sm:flex sm:gap-4">
              <dt className="text-sm font-semibold text-gray-900 sm:w-48 sm:shrink-0 mb-1 sm:mb-0">
                {item.label}
              </dt>
              <dd className="text-sm text-gray-600 leading-relaxed">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 text-xs text-gray-400 space-y-1">
          <p>
            ※
            個人事業主のため、住所・電話番号は請求に応じて開示いたします（特定商取引法第11条ただし書き）。
          </p>
          <p>※ 記載内容は予告なく変更する場合があります。</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <p>S.S.M (shirokuma sustainable marketing)</p>
      </footer>
    </div>
  );
}
