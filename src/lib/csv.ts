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
 */
export function csvFileName(kind: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `export-${kind}-${ts}.csv`
}
