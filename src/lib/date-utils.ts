const TZ = "Asia/Tokyo";

/** 現在のJST Dateオブジェクトを返す */
export function getJstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

/** 今日の日付文字列 "YYYY-MM-DD" (JST) */
export function getTodayStr(): string {
  return getJstNow().toISOString().split("T")[0];
}

/** 現在のJST時刻 "HH:MM" */
export function getCurrentTimeStr(): string {
  const jst = getJstNow();
  return (
    jst.getHours().toString().padStart(2, "0") +
    ":" +
    jst.getMinutes().toString().padStart(2, "0")
  );
}
