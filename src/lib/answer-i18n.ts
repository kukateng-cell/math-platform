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
 * 全形（全角）轉半形（半角）。
 * 涵蓋：全形數字 ０-９、全形小數點 ．、全形減號 −（U+2212）、全形空格。
 * 中文 IME 與部分行動鍵盤會輸出全形字元，導致「１２３」與「123」字串不相等而被誤判。
 */
function toHalfWidth(s: string): string {
  return s
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .replace(/−|\u2010|\u2011|\u2012|\u2013|\u2014/g, '-') // 各種破折號/減號統一為 ASCII -
    .replace(/．/g, '.') // 全形小數點
}

/**
 * 繁體中文異體字 / 簡繁混用統一（僅處理會導致答案誤判的常見情況）。
 * 例如「圓週長」（用「週」）與「圓周長」（用「周」）意義相同，但字串不同會被誤判。
 * 採保守策略：只統一「確實會出現在數學答案裡、且兩種寫法都常見」的異體字。
 * 新增異體字時加一行 replace 即可。
 */
function toStandardVariant(s: string): string {
  return s
    .replace(/週/g, '周') // 圓週長 → 圓周長、1週 → 1周
}

// ====================================================================
// 同義答案等價表（中文數學名詞 / 口語）
// --------------------------------------------------------------------
// 同一組裡的任何寫法都視為相等。比對時一律正規化為該組的第一個（標準）詞。
// 例：「正三角形」「等邊三角形」「等角三角形」→ 皆為「正三角形」。
//
// 設計考量：
// - 只做「整串完全相符」的取代（用邊界 \b 或 ^ $ 鎖定），避免誤傷其他答案。
// - 中文詞之間以空白/頓號分隔，所以用前後非中文邊界來判斷整詞。
// - 新增同義詞時，直接加進對應陣列即可，無需改其他邏輯。
// ====================================================================
const SYNONYM_GROUPS: string[][] = [
  // ── 三角形分類（G4）──
  ['正三角形', '等邊三角形', '等角三角形', '正三角'],
  ['等腰三角形', '二等邊三角形', '等腰三角'],
  ['直角三角形', '直角三角'],
  ['鈍角三角形', '鈍角三角'],
  ['銳角三角形', '銳角三角'],

  // ── 圓（G6）──
  ['圓心', '中心', '圓的中心'],
  ['半徑', 'r'],
  ['直徑', 'd'],
  ['圓周長', '周長', '圓周'],

  // ── 四邊形 / 多邊形 ──
  ['正方形', '正方'],
  ['長方形', '矩形'],
  ['平行四邊形', '平行四邊形'],
  ['梯形'],

  // ── 「相等 / 一樣」類口語（G4 三角形、G3 分數比較等）──
  ['相等', '一樣', '一樣長', '一樣大', '相同', '相等'],
  ['對', '正確', '是', 'yes'],

  // ── 質數 / 合數（G5）──
  ['質數', '素數'],
  ['合數'],

  // ── 位置（G6 負數：0 的左邊）──
  ['左邊', '左側', '左方'],
  ['右邊', '右側', '右方'],

  // ── 位名（G4 小數性質）──
  ['十分位', '十分位'],
  ['百分位', '百分位'],
]

/**
 * 將答案中的同義詞統一為該組的「標準詞」（組內第一個）。
 * 僅替換「整詞」（前後為字串邊界或非中文／非英數字元），避免誤替換子字串。
 */
function normalizeSynonyms(s: string): string {
  let result = s
  for (const group of SYNONYM_GROUPS) {
    const standard = group[0]
    for (const alias of group) {
      if (alias === standard) continue
      // 用前後非詞字元（或字串頭尾）鎖定整詞；中文詞不含英數，故用 [^\u4e00-\u9fffA-Za-z0-9] 做邊界
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp(`(^|[^\\u4e00-\\u9fffA-Za-z0-9])${escaped}([^\\u4e00-\\u9fffA-Za-z0-9]|$)`, 'g'), `$1${standard}$2`)
    }
  }
  return result
}

/**
 * 將純數字答案（含小數、前導零）正規化為「最小且無歧義」的字串形式。
 * 例：「07」→「7」、「3.50」→「3.5」、「3.0」→「3」、「-0」→「0」。
 * 用 Number() 解析後再依是否整數決定輸出格式，避免浮點精度誤差（如 0.1+0.2）。
 */
function normalizeNumeric(s: string): string {
  const n = Number(s)
  if (!Number.isFinite(n)) return s
  // 整數：去除前導零與多餘小數（3.0 → 3）
  if (Number.isInteger(n)) return String(n)
  // 小數：去除尾零（3.50 → 3.5），用 String(n) 已足夠；但避免極端精度，統一用 String(n)
  return String(n)
}

/**
 * 將答案正規化為可比較的標準鍵。
 * - 先全形轉半形（IME / 行動鍵盤常見）
 * - 純數字答案（含小數、前導零）→ 數值正規化（07→7、3.50→3.5），避免「答案對卻判錯」
 * - 時間單位答案 → 正規化為規範形（如「1h45m」）
 * - 其他答案 → 原樣（已去空白、轉半形）
 */
export function normalizeAnswer(input: string): string {
  const half = toStandardVariant(toHalfWidth(input).trim())
  if (half === '') return ''

  // 純數字（含選用負號、小數點，允許尾隨小數點如「3.」）→ 數值正規化
  if (/^-?\d+\.?\d*$/.test(half) || /^-?\.\d+$/.test(half)) {
    return normalizeNumeric(half)
  }

  // 嘗試時間正規化
  const normalized = normalizeTimeAnswer(half)
  // 如果正規化後與原小寫不同，表示有時間單位被轉換 → 用正規化結果
  if (normalized !== half.toLowerCase().replace(/\s+/g, '')) {
    return normalized
  }
  // 否則為文字答案：套用同義詞等價（如「等邊三角形」→「正三角形」），再原樣回傳
  return normalizeSynonyms(half)
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

