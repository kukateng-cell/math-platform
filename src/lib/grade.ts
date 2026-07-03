// ============ 年級順序與等級比較工具 ============
// K(幼兒園) < G1 < G2 < ... < G6
//
// 用途：
//  - 練習選單依年級排序顯示資料夾
//  - 年級權限：高年級可往下複習低年級，低年級不可往上看高年級

export const GRADE_ORDER = ['K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const

// 年級轉數值等級（K=0, G1=1, ...）；未知年級回傳較大值（排在最後）
export function gradeRank(level: string): number {
  const idx = GRADE_ORDER.indexOf(level as (typeof GRADE_ORDER)[number])
  return idx === -1 ? 999 : idx
}

// 孩子是否可看見 / 練習該年級的技能：
// 高年級可往下複習低年級，低年級不可往上看高年級
export function canAccessGrade(childGrade: string, skillGrade: string): boolean {
  return gradeRank(skillGrade) <= gradeRank(childGrade)
}

// 列出某年級孩子可存取的所有年級代碼（含自身與以下）
// 例：childGrade='G1' → ['K', 'G1']
//     childGrade='K'  → ['K']
export function accessibleGrades(childGrade: string): string[] {
  const rank = gradeRank(childGrade)
  // 未知年級：放行全部（permissive fallback，實務上 child 年級有 zod 驗證）
  if (rank >= GRADE_ORDER.length) return [...GRADE_ORDER]
  return GRADE_ORDER.slice(0, rank + 1)
}
