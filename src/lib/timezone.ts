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

// ============ 顯示用日期格式化 ============
// P3-5：原本各頁面用 toLocaleString / toLocaleDateString 時未指定 timeZone，
// 導致顯示時間隨「伺服器本地時區」而變（本機開發 UTC+8，Vercel 預設 UTC）。
// 以下函式統一固定 Asia/Taipei 時區，確保不論部署在哪個時區顯示都一致。

/**
 * 將日期格式化為「簡短日期」，例如「7月11日」。
 * 固定 Asia/Taipei 時區。
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
  })
}

/**
 * 將日期格式化為「完整日期＋時間」，例如「2026/07/11 下午 2:30」。
 * 固定 Asia/Taipei 時區。
 */
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  })
}

/**
 * 將日期格式化為「短日期＋時間」（Admin 表格用），例如「07/11 14:30」。
 * 固定 Asia/Taipei 時區。
 */
export function formatShortDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  })
}

/**
 * 相對時間（如「剛剛」「5 分鐘前」「3 天前」）。
 * 超過 dayThreshold 天則退化為簡短日期（固定 Asia/Taipei 時區）。
 *
 * @param dayThreshold 多少天內顯示「N 天前」，預設 7；Admin 概覽傳 30。
 */
export function relativeTime(date: Date | string, dayThreshold = 7): string {
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days < dayThreshold) return `${days} 天前`
  return formatDate(d)
}
