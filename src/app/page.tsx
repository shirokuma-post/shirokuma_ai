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
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            あなたの想いを、
            <br />
            <span className="text-brand-600">自動で世界に届ける。</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            コンセプトを登録するだけ。AIが投稿を生成し、自動配信。
            <br />
            Threadsなら完全無料で始められる。
          </p>
          <Link
            href="/auth/login"
            className="inline-flex px-8 py-4 bg-brand-600 text-white rounded-xl text-lg font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
          >
            無料で始める
          </Link>
        </section>

        {/* Features */}
        <section className="py-16 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "マイコンセプト登録",
              desc: "あなたの価値観やコンセプトを登録。AIが核心を理解し、投稿の軸にします。",
              icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
            },
            {
              title: "AIが投稿を生成",
              desc: "共感、問いかけ、ストーリー。あなたの想いを、届く言葉に変換。",
              icon: "M13 10V3L4 14h7v7l9-11h-7z",
            },
            {
              title: "自動でSNS配信",
              desc: "X・Threadsへ1日2〜3回自動投稿。時間帯に合わせたトーン調整付き。",
              icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
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
          <div className="bg-gray-50 rounded-2xl p-10 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              BYOK = Bring Your Own Key
            </h2>
            <p className="text-gray-500 leading-relaxed">
              SHIROKUMA
              Postは、あなた自身のAPIキー（Claude、GPT、X等）で動きます。
              <br />
              プラットフォーム側の月額課金はゼロ。AI利用料はあなたのアカウントに直接課金されるので、
              <br />
              コストが透明で、いつでも自由に乗り換え可能です。
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <p>SHIROKUMA Post &mdash; しろくま式ミライマーケティング</p>
      </footer>
    </div>
  );
}
