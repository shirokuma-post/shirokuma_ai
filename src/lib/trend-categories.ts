// トレンドカテゴリ定義
export const TREND_CATEGORIES = {
  general:       { name: "総合",           url: "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja" },
  technology:    { name: "テクノロジー",    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja" },
  business:      { name: "ビジネス",        url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja" },
  entertainment: { name: "エンタメ",        url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRE55TVRjU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja" },
  sports:        { name: "スポーツ",        url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja" },
  health:        { name: "健康",           url: "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtcGhLQUFQAQ?hl=ja&gl=JP&ceid=JP:ja" },
  science:       { name: "サイエンス",      url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja" },
} as const;

export type TrendCategory = keyof typeof TREND_CATEGORIES;

export const DEFAULT_TREND_CATEGORIES: TrendCategory[] = ["general", "technology", "business"];
