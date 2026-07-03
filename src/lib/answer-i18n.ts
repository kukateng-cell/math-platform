// ====================================================================
// 答案國際化（i18n）：時間單位中英文等價
// --------------------------------------------------------------------
// 目的：使用者可輸入中文或英文時間單位作答，兩者皆視為正確。
//
// 做法：
// 1. normalizeTimeAnswer()：將中英文時間表達式正規化為「標準規範形」
//    e.g. 「1小時45分」「1h45min」「1 hour 45 minutes」→ 皆為「1h45m」
// 2. isAnswerCorrect()：驗證時用正規化後的結果比對
// 3. displayAnswer()：顯示時附加標準規範形（如「1小時45分 (1h45m)」）
//
// 適用範圍：時間經過題（從 X 點到 Y 點經過了多久）、單位換算題
// 純數字答案不受影響，原樣比對。
// ====================================================================

/**
 * 將中英文時間表達式正規化為「標準規範形」。
 * 先處理複合模式（如「X小時Y分」→「XhYm」），再處理單一模式。
 * 最後一律轉小寫、去空白。
 */
function normalizeTimeAnswer(input: string): string {
  let s = input.trim().toLowerCase()

  // ── 複合模式（必須在簡單模式之前）──
  // 中文：X小時Y分(鐘) / X小時Y分鐘
  s = s.replace(/(\d+)\s*小時\s*(\d+)\s*分(?:鐘)?/g, '$1h$2m')
  // 英文：X hour(s) Y min(ute(s)) / Xhr(s) Ymin
  s = s.replace(/(\d+)\s*(?:hours?|hrs?)\s+(\d+)\s*(?:minutes|minute|mins|min)/g, '$1h$2m')
  // 混合：Xh Ymin / XhYm
  s = s.replace(/(\d+)\s*h\s*(\d+)\s*(?:minutes|minute|mins|min|m)\b/g, '$1h$2m')

  // ── 簡單模式（單一時間單位）──
  // 小時 / hour / hrs / h
  s = s.replace(/(\d+)\s*小時/g, '$1h')
  s = s.replace(/(\d+)\s*(?:hours?|hrs?)/g, '$1h')

  // 分鐘 / minute / min / m（跟在數字後，且不是規範形結尾的 m）
  s = s.replace(/(\d+)\s*分(?:鐘)?/g, '$1m')
  s = s.replace(/(\d+)\s*(?:minutes|minute|mins|min)/g, '$1m')

  // 秒 / second / sec / s
  s = s.replace(/(\d+)\s*秒(?:鐘)?/g, '$1s')
  s = s.replace(/(\d+)\s*(?:seconds|second|secs|sec)/g, '$1s')

  // 天 / day / d
  s = s.replace(/(\d+)\s*天/g, '$1d')
  s = s.replace(/(\d+)\s*(?:day|days)/g, '$1d')

  // 週 / week / w
  s = s.replace(/(\d+)\s*週/g, '$1w')
  s = s.replace(/(\d+)\s*(?:week|weeks)/g, '$1w')

  // 去掉多餘空白
  s = s.replace(/\s+/g, '')

  return s
}

/**
 * 將答案正規化為可比較的標準鍵。
 * 時間單位答案 → 正規化為規範形（如「1h45m」）
 * 純數字或其他答案 → 原樣回傳（已去空白）
 */
export function normalizeAnswer(input: string): string {
  const trimmed = input.trim()
  // 嘗試時間正規化
  const normalized = normalizeTimeAnswer(trimmed)
  // 如果正規化後與原小寫不同，表示有時間單位被轉換 → 用正規化結果
  if (normalized !== trimmed.toLowerCase().replace(/\s+/g, '')) {
    return normalized
  }
  // 否則原樣回傳（如純數字）
  return trimmed
}

/**
 * 驗證作答是否正確（中英文等價比對）。
 */
export function isAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)
}

/**
 * 給 UI 顯示用：若為時間答案，附上標準規範形。
 * 例：「1小時45分」→「1小時45分 (1h45m)」
 * 非時間答案 → 原樣回傳
 */
export function displayAnswer(answer: string): string {
  const trimmed = answer.trim()
  const norm = normalizeTimeAnswer(trimmed)
  const compact = trimmed.toLowerCase().replace(/\s+/g, '')
  if (norm !== compact) {
    return `${trimmed} (${norm})`
  }
  return trimmed
}

