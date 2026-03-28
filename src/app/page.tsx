import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/shirokuma-logo.png" alt="SHIROKUMA Post" width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-gray-900">SHIROKUMA</span>
            <span className="text-brand-600 font-medium">Post</span>
          </div>
          <Link
            href="/auth/login"
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6">
        <section className="py-24 text-center">
          <Image src="/shirokuma-hero.png" alt="SHIROKUMA Post" width={320} height={175} className="mx-auto mb-8" priority />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            「60点でいいから続けろ」って言うけど、
            <br />
            <span className="text-brand-600">その60点が作れないんだよ。</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            SHIROKUMA Postは、あなたのコンセプトから
            <br />
            毎日60点の投稿を自動で作り続ける。
            <br />
            だから、渾身の120点を打ちたいときに、いつでも打てる。
          </p>
          <Link
            href="/auth/login"
            className="inline-flex px-8 py-4 bg-brand-600 text-white rounded-xl text-lg font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
          >
            始めてみる
          </Link>
        </section>

        {/* Features */}
        <section className="py-16 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "コンセプトが核になる",
              desc: "あなたの信念・価値観・世界観を登録。すべての投稿がコンセプトから生まれるから、テンプレ感ゼロ。",
              icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
            },
            {
              title: "60点を自動で作り続ける",
              desc: "11種類のスタイルと10軸のキャラ設定で『あなたらしい投稿』を毎日自動生成。発信が途切れない。",
              icon: "M13 10V3L4 14h7v7l9-11h-7z",
            },
            {
              title: "120点をいつでも打てる",
              desc: "土台が途切れてないから、本気で伝えたいときにすぐ届く。バズ狙いじゃない。辞めない仕組み。",
              icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-gray-200 hover:border-brand-200 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-brand-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={feature.icon}
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </section>

        {/* BYOK Explanation */}
        <section className="py-16 text-center">
          <div className="bg-gray-900 text-white rounded-2xl p-10 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">
              BYOK = Bring Your Own Key
            </h2>
            <p className="text-gray-300 leading-relaxed">
              あなた自身のAPIキー（Claude / GPT / Gemini / X / Threads）で動作。
              <br />
              AI費用は従量課金で使った分だけ。コストが完全に透明。
              <br />
              キーはAES-256で暗号化保存。いつでも削除・変更可能。
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <p className="mb-2">SHIROKUMA Post &mdash; S.S.M (shirokuma sustainable marketing)</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/tokushoho" className="hover:text-gray-600 transition-colors">
            特定商取引法に基づく表記
          </Link>
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">
            プライバシーポリシー
          </Link>
        </div>
      </footer>
    </div>
  );
}
