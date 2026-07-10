// ============ 年級順序與等級比較工具 ============
// K(幼兒園) < G1 < G2 < ... < G6
//
// 用途：
//  - 練習選單依年級排序顯示資料夾
//  - 年級權限：高年級可往下複習低年級，低年級不可往上看高年級

export const GRADE_ORDER = ['K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const

// P2-5：年級型別，與 Prisma GradeLevel enum 相容
export type Grade = (typeof GRADE_ORDER)[number]

// P1-10：未知年級 fail-closed（回傳 -1 / 空陣列），
// 避免 typo / 舊資料解鎖全部年級。
export function gradeRank(level: string): number {
  const idx = GRADE_ORDER.indexOf(level as (typeof GRADE_ORDER)[number])
  return idx === -1 ? -1 : idx
}

// 孩子是否可看見 / 練習該年級的技能：
// 高年級可往下複習低年級，低年級不可往上看高年級
// 未知年級回傳 false（fail-closed，不允許存取任何技能）
export function canAccessGrade(childGrade: string, skillGrade: string): boolean {
  const childRank = gradeRank(childGrade)
  const skillRank = gradeRank(skillGrade)
  if (childRank === -1 || skillRank === -1) return false
  return skillRank <= childRank
}

// 列出某年級孩子可存取的所有年級代碼（含自身與以下）
// 例：childGrade='G1' → ['K', 'G1']
//     childGrade='K'  → ['K']
// 未知年級回傳空陣列（fail-closed，不開放任何年級）
export function accessibleGrades(childGrade: string): Grade[] {
  const rank = gradeRank(childGrade)
  if (rank < 0 || rank >= GRADE_ORDER.length) return []
  return GRADE_ORDER.slice(0, rank + 1)
}

// ============ 升學相關 ============
// 取得下一年級（K → G1, G1 → G2, ... G6 → null）
// P2-5：未知年級回傳 null（fail-closed），不會因 rank=-1 而誤回 K
export function getNextGrade(currentGrade: string): string | null {
  const rank = gradeRank(currentGrade)
  if (rank < 0) return null
  const next = GRADE_ORDER[rank + 1]
  return next ?? null
}

// 是否為最後一個年級（G6）
export function isLastGrade(grade: string): boolean {
  return grade === 'G6'
}
