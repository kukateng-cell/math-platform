// ====================================================================
// CSV 產生工具
// --------------------------------------------------------------------
// 用途：將資料表（物件陣列）轉成 RFC 4180 相容的 CSV 字串，
// 供家長 / Admin 匯出練習資料（可被 Excel / Google Sheets / Numbers 開啟）。
//
// 細節：
// - 含 UTF-8 BOM（\uFEFF）：解決 Excel 開啟中文 CSV 時亂碼的常見問題。
// - 欄位含「,」「"」「換行」時自動用雙引號包覆並 escape 內部雙引號。
// - 日期一律 ISO 字串輸出，避免時區歧義。
// ====================================================================

import { APP_TIMEZONE } from '@/lib/timezone'

/** 一列資料 = 一個物件，key 為欄位名。 */
export type CsvRow = Record<string, string | number | boolean | null | undefined | Date>

/** CSV 匯出表：含欄位順序定義與資料列。 */
export type CsvTable = {
  /** 欄位定義：key 對應 row 的屬性，label 為 CSV 表頭顯示文字 */
  columns: { key: string; label: string }[]
  rows: CsvRow[]
}

/** 將單一值轉成 CSV 儲存格字串（已 escape）。 */
function escapeCell(value: unknown): string {
  let str: string
  if (value === null || value === undefined) {
    str = ''
  } else if (value instanceof Date) {
    str = value.toISOString()
  } else if (typeof value === 'boolean') {
    str = value ? '是' : '否'
  } else {
    str = String(value)
  }
  // ── 防 CSV 公式注入 ──
  // Excel / Google Sheets 會將以 = + - @ 開頭的值視為公式執行，
  // 攻擊者可透過這類輸入執行任意命令（如 =CMD|...）。
  // 解法：在開頭加上 TAB 字元（\t），破壞公式語法同時保留可見性。
  // 注意：須在雙引號處理「之前」加前綴，否則開頭空白被忽略。
  if (/^[=+\-@]/.test(str)) {
    str = `\t${str}`
  }
  // 含逗號、雙引號、換行、或首尾空白 → 用雙引號包覆，內部 " → ""
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * 將一個 CsvTable 轉成 CSV 字串（含 BOM）。
 */
export function tableToCsv(table: CsvTable): string {
  return '\uFEFF' + tableBody(table)
}

/**
 * 同 tableToCsv 但不加 UTF-8 BOM。
 * 用於「多表合併成單一檔案」的場合——整份檔案只該有一個 BOM 在最前面。
 */
export function tableBody(table: CsvTable): string {
  const lines: string[] = []

  // 表頭
  lines.push(table.columns.map((c) => escapeCell(c.label)).join(','))

  // 資料列
  for (const row of table.rows) {
    lines.push(table.columns.map((c) => escapeCell(row[c.key])).join(','))
  }

  return lines.join('\r\n')
}

/**
 * 將多個 CsvTable 合併成單一 CSV 字串（每個 table 一個區塊，以空行分隔）。
 * 適合一次匯出「孩子資料 + 練習紀錄 + 作答明細」等多張表到同一檔案。
 */
export function tablesToCsv(tables: { name: string; table: CsvTable }[]): string {
  const blocks: string[] = []
  for (const { name, table } of tables) {
    blocks.push(`# ${name}`)
    blocks.push(tableToCsv(table))
    blocks.push('') // 區塊間空行
  }
  // 整體只留一個 BOM 在最前面
  return '\uFEFF' + blocks.join('\r\n').replace(/^\uFEFF/, '')
}

/**
 * 產生下載檔名：export-{kind}-{YYYYMMDD-HHmm}.csv
 *
 * P3-5：時間戳固定使用 Asia/Taipei 時區（與頁面顯示一致），
 * 不再隨伺服器本地時區漂移（本機 UTC+8 / Vercel UTC 會得到不同檔名）。
 */
export function csvFileName(kind: string): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  const ts = `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}`
  return `export-${kind}-${ts}.csv`
}
