// ============ 時區工具（全平台統一）============
// P2-10：所有時區相關計算共用此模組，避免不同頁面使用不同時區邏輯。
//
// 平台目標用戶為台灣（zh-TW，UTC+8）。伺服器可能在其他時區（如 Supabase
// ap-south-1 孟買），若用伺服器本地時區算「日曆日」，跨時區用戶的 streak
// 會計算偏差（例：台灣 23:30 練習、隔天 06:00 再練，按孟買時區仍是同一天，
// streak 不增加）。
//
// 解法：固定用 Asia/Taipei 時區把 timestamp 折算成「日曆日 key」
// （YYYY-MM-DD），再比較兩個日曆日。將來若要支援每個用戶自訂時區，
// 只要把 APP_TIMEZONE 改成 per-user 即可。

export const APP_TIMEZONE = 'Asia/Taipei'

/** 取某個 timestamp 在目標時區的日曆日 key（YYYY-MM-DD） */
export function calendarDayKey(date: Date, timeZone = APP_TIMEZONE): string {
  // toLocaleDateString('en-CA') 會輸出 YYYY-MM-DD 格式（en-CA 的預設格式）
  return date.toLocaleDateString('en-CA', { timeZone })
}

/** 計算兩個日曆日相差幾天（負值代表 from 在 to 之後）。以目標時區為準。 */
export function diffCalendarDays(from: Date, to: Date, timeZone = APP_TIMEZONE): number {
  const fromKey = calendarDayKey(from, timeZone)
  const toKey = calendarDayKey(to, timeZone)
  // 把 YYYY-MM-DD 解析成 UTC 午夜（避免本地時區干擾），再算天數差
  const fromUtc = Date.UTC(+fromKey.slice(0, 4), +fromKey.slice(5, 7) - 1, +fromKey.slice(8, 10))
  const toUtc = Date.UTC(+toKey.slice(0, 4), +toKey.slice(5, 7) - 1, +toKey.slice(8, 10))
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24))
}

/** 取得今天的 00:00（目標時區），用於「今日未完成練習」過濾 */
export function startOfToday(timeZone = APP_TIMEZONE): Date {
  const todayKey = calendarDayKey(new Date(), timeZone)
  return new Date(todayKey + 'T00:00:00+08:00')
}
