'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { generateQuestion, shuffle } from '@/lib/question'
import { updateMastery, getRecommendation, isGradeAllMastered, type Recommendation } from '@/lib/mastery'
import { updateStars, updateStreak, checkBadges } from '@/lib/gamification'
import { getNextGrade } from '@/lib/grade'
import { accessibleGrades, canAccessGrade } from '@/lib/grade'
import { isAnswerCorrect } from '@/lib/answer-i18n'

const QUESTIONS_PER_SESSION = 10

// ============ 練習授權輔助函式 ============
// 練習路由同時支援「家長 session」與「孩子 session」兩種身分：
// - 家長：透過 getSession()，可存取自己建立的所有孩子
// - 孩子（家長建檔 / 自主學習）：透過 getChildSession()，只能存取自己的檔案
type PracticeAuth =
  | { type: 'parent'; userId: string }
  | { type: 'child'; childId: string }
  | null

async function getPracticeAuth(): Promise<PracticeAuth> {
  // 先嘗試家長 session
  const session = await getSession()
  if (session) return { type: 'parent', userId: session.userId }

  // 再嘗試孩子 session
  const childSession = await getChildSession()
  if (childSession) return { type: 'child', childId: childSession.childId }

  return null
}

// 驗證目前身分是否有權存取指定的孩子
async function canAccessChild(childId: string): Promise<boolean> {
  const auth = await getPracticeAuth()
  if (!auth) return false
  if (auth.type === 'child') return auth.childId === childId

  // 家長：確認孩子屬於這名家長，或透過 ParentChild 關聯綁定
  const child = await prisma.childProfile.findFirst({
    where: { id: childId, parentId: auth.userId },
  })
  if (child) return true

  // 綁定關聯須為 ACTIVE（學生主動綁定需家長確認後才生效）
  const link = await prisma.parentChild.findFirst({
    where: { parentId: auth.userId, childId, status: 'ACTIVE' },
  })
  return !!link
}

// 供頁面元件使用：檢查是否有任何練習身分（家長或孩子）
export async function hasPracticeAccess(): Promise<boolean> {
  return (await getPracticeAuth()) !== null
}

type StoredQuestion = {
  templateId: string
  prompt: string
  answer: string
  options?: string[]
  explanation?: string
  /** 互動模式：choice (預設) / numberline / fillin */
  interaction?: string
  /** 數字線範圍 */
  rangeMin?: number
  rangeMax?: number
  /** 填答輸入模式：numeric(數字+小數點) / text(文字) */
  inputMode?: string
  /** 數字模式最多位數 */
  maxLength?: number
  /** 文字模式 placeholder */
  placeholder?: string
}

// 建立練習 session 的內部輔助函式（不 redirect，讓呼叫端自己 redirect）
// 解決巢狀 Server Action redirect race condition 的問題
async function createPracticeSessionInternal(childId: string, skillId: string): Promise<{ sessionId: string; childId: string; skillId: string }> {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')

  // 確認身分可存取這個孩子
  if (!(await canAccessChild(childId))) throw new Error('找不到孩子檔案')

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) throw new Error('找不到孩子檔案')

  // P1-6：一般練習只取非 challenge 題（isChallenge: false）
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: { questions: { where: { isActive: true, isChallenge: false } } },
  })
  if (!skill || !skill.isActive) throw new Error('技能不存在或已停用')
  // 年級權限：低年級不可練習高年級的技能（避免知道 ID 就能越級）
  if (!canAccessGrade(child.gradeLevel, skill.gradeLevel)) {
    throw new Error('這個技能超出您的年級範圍')
  }
  // 空題庫保護
  if (skill.questions.length === 0) {
    throw new Error('這個技能目前沒有題目，請聯繫管理員')
  }

  // 伺服器端生成題目實例（打亂模板順序，讓每次練習不同）
  const templates = shuffle(skill.questions)
  const generated: StoredQuestion[] = []
  for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
    const t = templates[i % templates.length]
    const q = generateQuestion({
      id: t.id,
      type: t.type,
      prompt: t.prompt,
      paramsJson: t.paramsJson,
      answer: t.answer,
      options: t.options,
    })

    // 解析互動模式（從 paramsJson）
    let interaction: string | undefined
    let rangeMin: number | undefined
    let rangeMax: number | undefined
    let inputMode: string | undefined
    let maxLength: number | undefined
    let placeholder: string | undefined
    if (t.paramsJson) {
      try {
        const parsed = JSON.parse(t.paramsJson)
        interaction = parsed.interaction
        rangeMin = parsed.rangeMin
        rangeMax = parsed.rangeMax
        inputMode = parsed.inputMode
        maxLength = parsed.maxLength
        placeholder = parsed.placeholder
      } catch { /* ignore */ }
    }

    // 若 inputMode 未明確設定，依答案內容判斷：純數字→numeric，否則→text。
    // 在 server 端根據答案決定（答案不會送到 client），確保 client 的 inputMode
    // 始終權威，不需依賴答案內容來判斷輸入模式（P0-2：答案不可送到瀏覽器）。
    if (!inputMode) {
      inputMode = /^-?\d+(\.\d+)?$/.test(q.answer) ? 'numeric' : 'text'
    }

    generated.push({
      templateId: q.templateId!,
      prompt: q.prompt,
      answer: q.answer,
      options: q.options,
      explanation: t.explanation ?? undefined,
      interaction,
      rangeMin,
      rangeMax,
      inputMode,
      maxLength,
      placeholder,
    })
  }

  // P1-4/P1-5：清理同一技能下「未完成」的一般練習 session（排除 PROMOTION/CHALLENGE 類型），
  // 避免使用者多次開啟同一技能卻未完成，造成「繼續練習」清單出現重複技能。
  // 現在使用 kind 欄位精確過濾，不再依賴 __isPromotion/__isChallenge 標記。
  //
  // ⚠️ 必須同時回填 correctCount：
  const staleSessions = await prisma.practiceSession.findMany({
    where: { childId, skillId, completedAt: null, kind: 'NORMAL' },
    select: { id: true },
  })
  if (staleSessions.length > 0) {
    const now = new Date()
    await Promise.all(
      staleSessions.map(async (s) => {
        // 先算出該 session 的實際答對數（isCorrect 且非 assisted），再寫回
        const realCorrect = await prisma.attempt.count({
          where: { sessionId: s.id, isCorrect: true, assisted: false },
        })
        return prisma.practiceSession.update({
          where: { id: s.id },
          data: {
            completedAt: now,
            correctCount: realCorrect,
            status: 'ABANDONED',
            abandonedAt: now,
          },
        })
      })
    )
  }

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId,
      parentId: auth.type === 'parent' ? auth.userId : child.parentId,
      totalQuestions: QUESTIONS_PER_SESSION,
      questionsJson: JSON.stringify(generated),
      kind: 'NORMAL',
      status: 'IN_PROGRESS',
    },
  })

  return { sessionId: practiceSession.id, childId, skillId }
}

// 開始一次練習：在伺服器生成題目快照後建立 session
export async function startSession(childId: string, skillId: string) {
  const { sessionId } = await createPracticeSessionInternal(childId, skillId)
  redirect(`/practice/${childId}/${skillId}/${sessionId}`)
}

// 公開題目型別：移除 answer，避免正確答案被送到瀏覽器（P0-2）。
// answer 只存在於 server 端的 session snapshot（questionsJson），
// 唯有透過 submitAnswer 提交後才會在回傳值中附上 correctAnswer。
export type PublicQuestion = Omit<StoredQuestion, 'answer'>

// 取得一次練習要做的題目（從 session 的伺服器快照讀取，確保與驗證一致）
// 同時回傳「已作答進度」供斷點續做：已答題數、正確數、每題結果。
//
// 安全：回傳的 questions 已移除 answer 欄位，學生無法從 RSC payload /
// network response / DevTools 讀出未作答題目的正確答案。只有提交後的
// correctAnswer 才會由 submitAnswer 回傳。
export async function getSessionQuestions(
  sessionId: string
): Promise<{
  questions: PublicQuestion[]
  skillName: string
  childNickname: string
  /** 已作答的題數（從 Attempt 推算，用來決定從第幾題開始） */
  answeredCount: number
  /** 已答題中答對的數量（不計 assisted） */
  correctCount: number
  /** 此練習是否已完成（在其他設備完成的場景） */
  completed: boolean
  /** 已答題的逐題結果（依 questionIndex 排序），用於完成頁的回顧 */
  answeredResults: {
    questionIndex: number
    correct: boolean
    assisted: boolean
    correctAnswer: string
    userAnswer: string
  }[]
} | null> {
  const auth = await getPracticeAuth()
  if (!auth) {
    console.error('getSessionQuestions: no session')
    return null
  }

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { skill: true, child: true },
  })
  if (!practiceSession) {
    console.error('Session not found in DB:', sessionId)
    return null
  }

  // 記憶體內權限驗證（避免額外 DB 查詢）
  if (auth.type === 'child' && auth.childId !== practiceSession.childId) return null
  if (auth.type === 'parent' && practiceSession.parentId !== auth.userId) return null

  // 相容舊 session：若無 questionsJson，回傳空陣列讓前端顯示提示
  let questions: StoredQuestion[] = []
  if (practiceSession.questionsJson) {
    try {
      questions = JSON.parse(practiceSession.questionsJson)
    } catch {
      questions = []
    }
  }

  // 查詢已作答紀錄，用於斷點續做（從 Attempt 推算當前進度）
  const attempts = await prisma.attempt.findMany({
    where: { sessionId },
    orderBy: { questionIndex: 'asc' },
    select: {
      questionIndex: true,
      isCorrect: true,
      assisted: true,
      correctAnswer: true,
      userAnswer: true,
    },
  })
  const correctCount = attempts.filter((a) => a.isCorrect && !a.assisted).length

  // 移除 answer 欄位：正確答案只留在 server 端，不可送到瀏覽器。
  // 已答題的正確答案改由 answeredResults（來自 Attempt.correctAnswer）提供。
  const publicQuestions: PublicQuestion[] = questions.map((q) => {
    // 解構出 answer 但不使用（void 標記為故意丟棄），確保它不會出現在回傳值
    const { answer, ...rest } = q
    void answer
    return rest
  })

  return {
    questions: publicQuestions,
    skillName: practiceSession.skill.name,
    childNickname: practiceSession.child.nickname,
    answeredCount: attempts.length,
    correctCount,
    completed: practiceSession.status !== 'IN_PROGRESS',
    answeredResults: attempts.map((a) => ({
      questionIndex: a.questionIndex,
      correct: a.isCorrect,
      assisted: a.assisted,
      correctAnswer: a.correctAnswer,
      userAnswer: a.userAnswer,
    })),
  }
}

// ============ 斷點續做：查詢「今天」未完成的練習 ============
// 學生做到一半退出後，下次回到練習選單時，可從這裡看到所有未完成、可繼續的練習。
// 規則：
//   - completedAt IS NULL（未完成）
//   - startedAt 在「今天」（當天 00:00 之後）— 超過今天的不再顯示
//   - 有題目快照（questionsJson 非空）且至少有 1 題未答（避免 0 題的空 session 顯示）
export type ResumeableSession = {
  sessionId: string
  skillId: string
  skillName: string
  totalQuestions: number
  answeredCount: number
  remainingCount: number
  startedAt: Date
}

export async function getResumeableSessions(childId: string): Promise<ResumeableSession[]> {
  const auth = await getPracticeAuth()
  if (!auth) return []
  if (!(await canAccessChild(childId))) return []

  // 今天的 00:00（本地時區）：用來過濾「僅當天」的未完成練習
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // P1-4：使用 status 判斷，不再依賴 completedAt
  const sessions = await prisma.practiceSession.findMany({
    where: {
      childId,
      status: 'IN_PROGRESS',
      startedAt: { gte: startOfToday },
      questionsJson: { not: null },
    },
    include: {
      skill: { select: { id: true, name: true } },
      _count: { select: { attempts: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  return sessions
    .filter((s) => s._count.attempts < s.totalQuestions) // 只保留「還沒做完」的
    .filter((s) => s.kind === 'NORMAL') // P1-5：只顯示一般練習
    // 同一個技能只保留「進度最多」的一筆（進度相同則取最近建立的），
    // 避免使用者多次開啟同一技能卻未完成，造成「繼續練習」清單出現重複技能。
    .reduce<ResumeableSession[]>((acc, s) => {
      const item: ResumeableSession = {
        sessionId: s.id,
        skillId: s.skill.id,
        skillName: s.skill.name,
        totalQuestions: s.totalQuestions,
        answeredCount: s._count.attempts,
        remainingCount: s.totalQuestions - s._count.attempts,
        startedAt: s.startedAt,
      }
      const existing = acc.find((x) => x.skillId === item.skillId)
      if (!existing) {
        acc.push(item)
      } else {
        // 進度較多者勝出；進度相同則取最近建立的（sessions 已依 startedAt desc 排序）
        const betterProgress = item.answeredCount > existing.answeredCount
        const sameProgressMoreRecent =
          item.answeredCount === existing.answeredCount &&
          item.startedAt.getTime() > existing.startedAt.getTime()
        if (betterProgress || sameProgressMoreRecent) {
          Object.assign(existing, item)
        }
      }
      return acc
    }, [])
}

// 檢查指定技能是否有未完成的舊 session（供前端顯示確認對話框用）
// 避免使用者沒注意到「已有進行中的練習」就直接被強制結束。
export async function hasIncompleteSession(childId: string, skillId: string): Promise<boolean> {
  const auth = await getPracticeAuth()
  if (!auth) return false
  if (!(await canAccessChild(childId))) return false

  const count = await prisma.practiceSession.count({
    where: { childId, skillId, status: 'IN_PROGRESS', kind: 'NORMAL' },
  })
  return count > 0
}

export type SubmitResult = {
  correct: boolean
  correctAnswer: string
  finished: boolean
  sessionId: string
  explanation?: string
  /** 升學測試結果（僅在 finished=true 時有值）
   * - qualify: 用戶達到升學門檻（正確率 ≥ 80%）
   * - confirmed: 用戶已手動確認升級（gradeLevel 已更新）
   */
  promotion?: {
    qualify: boolean
    confirmed: boolean
    newGrade: string | null
    targetGrade: string | null
  } | null
}

// 提交一題作答（伺服器從快照重算正確答案，不信任前端）
export async function submitAnswer(payload: {
  sessionId: string
  questionIndex: number // 這題在 session 快照中的索引
  userAnswer: string
  assisted: boolean
  durationMs: number
}): Promise<SubmitResult> {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: payload.sessionId },
    include: { child: true },
  })
  // 越權防護：session 必須存在
  if (!practiceSession) throw new Error('無權存取此練習')
  // 記憶體內權限驗證（避免額外 DB 查詢）
  if (auth.type === 'child' && auth.childId !== practiceSession.childId)
    throw new Error('無權存取此練習')
  if (auth.type === 'parent' && practiceSession.parentId !== auth.userId)
    throw new Error('無權存取此練習')
  // P1-4：已完成的練習不再接受作答（防重複提交）
  if (practiceSession.status !== 'IN_PROGRESS') {
    return {
      correct: false,
      correctAnswer: '',
      finished: true,
      sessionId: payload.sessionId,
    }
  }

  // 從伺服器快照取出這題的正確答案
  const questions: StoredQuestion[] = practiceSession.questionsJson
    ? JSON.parse(practiceSession.questionsJson)
    : []
  const q = questions[payload.questionIndex]
  if (!q) throw new Error('題目不存在')

  // 安全檢查：templateId 必須存在於 QuestionTemplate 表，否則外鍵約束會噴 P2003
  const templateExists = await prisma.questionTemplate.findUnique({ where: { id: q.templateId }, select: { id: true } })
  if (!templateExists) {
    // 題目模板已被刪除（例如管理員移除），但舊 session 快照仍保留題目內容與答案。
    // 此情況下無法寫入 Attempt（questionId 外鍵失效），但題目本身仍可正常判分。
    // 改為正常判分並回傳正確答案，避免使用者「明明答對卻被判錯」且看不到正確答案與提示。
    const correct = isAnswerCorrect(payload.userAnswer, q.answer)
    return {
      correct,
      correctAnswer: q.answer,
      finished: false,
      sessionId: payload.sessionId,
      explanation: q.explanation,
    }
  }

  const correctAnswer = q.answer
  // 中英文等價驗證：例如「left」「左邊」都視為正確
  const correct = isAnswerCorrect(payload.userAnswer, correctAnswer)

  // durationMs 伺服器驗證：下限 1 秒、上限 5 分鐘，防止前端偽造速度類徽章。
  // 下限設為 1000ms 而非 0ms：人類不可能在 1 秒內讀題並作答，
  // 若允許 0ms 會被偽造為 1ms 而通過速度徽章的 durationMs > 0 檢查。
  const validatedDurationMs = Math.max(1000, Math.min(payload.durationMs, 300_000))

  // 防止重複提交同一題（attempt 表有 @@unique([sessionId, questionIndex])，
  // 捕捉 Prisma P2002 錯誤並優雅回退，避免刷高星星與掌握度）
  //
  // 完成判斷改用 DB count：attempt 建立與 count 包在同一 transaction，
  // 確保即使前端偽造 questionIndex（例如直接提交最後一題 index）也無法
  // 令 session 被標記完成。只有實際作答數 ≥ totalQuestions 才算完成。
  let finished: boolean
  try {
    finished = await prisma.$transaction(async (tx) => {
      await tx.attempt.create({
        data: {
          sessionId: payload.sessionId,
          questionId: q.templateId,
          questionIndex: payload.questionIndex,
          questionPrompt: q.prompt,
          userAnswer: payload.userAnswer,
          correctAnswer,
          isCorrect: correct,
          assisted: payload.assisted,
          durationMs: validatedDurationMs,
        },
      })
      // 用實際作答數判斷完成，而非信任前端傳入的 questionIndex
      const answeredCount = await tx.attempt.count({
        where: { sessionId: payload.sessionId },
      })
      return answeredCount >= practiceSession.totalQuestions
    })
  } catch (e: unknown) {
    // P2002 = unique constraint violation → 代表此題已提交過。
    // 常見於多設備/多分頁同時作答，或網路重試導致同一題被提交兩次。
    // 先前的實作回傳空白的 correctAnswer，會讓前端顯示「答錯且無正確答案」——
    // 也就是使用者明明答對了（第一次提交已記錄為正確），第二次的空結果卻覆蓋顯示為錯，
    // 同時也不會顯示該如何解題。這正是「明明答對卻被判錯 + 沒有錯誤提示」的原因。
    // 修正：查詢已存在的作答紀錄，回傳真實的對錯與正確答案。
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002') {
      const existing = await prisma.attempt.findUnique({
        where: { sessionId_questionIndex: { sessionId: payload.sessionId, questionIndex: payload.questionIndex } },
        select: { isCorrect: true, correctAnswer: true },
      })
      if (existing) {
        return {
          correct: existing.isCorrect,
          correctAnswer: existing.correctAnswer,
          finished: practiceSession.completedAt !== null,
          sessionId: payload.sessionId,
          explanation: q.explanation,
        }
      }
      // 理論上 P2002 必有已存在紀錄；以防萬一，用快照答案回傳，確保前端看得到正確答案
      return {
        correct: isAnswerCorrect(payload.userAnswer, q.answer),
        correctAnswer: q.answer,
        finished: practiceSession.completedAt !== null,
        sessionId: payload.sessionId,
        explanation: q.explanation,
      }
    }
    throw e
  }

  // P1-4：使用 session.kind 判斷練習類型，不再依賴 questionsJson 標記
  const isSpecialSession = practiceSession.kind !== 'NORMAL'
  const isChallengeSession = practiceSession.kind === 'CHALLENGE'
  const isPromotionTest = practiceSession.kind === 'PROMOTION'
  let qualifyPromotion = false  // 升學測試達標標記，供完成後的回傳值使用

  if (finished) {
    const childId = practiceSession.childId

    // ============ idempotency gate：用 updateMany + status:IN_PROGRESS 條件式更新 ============
    // P1-4：改用 status 而非 completedAt 判斷完成狀態。
    // 多題併發提交時，只有第一個請求能成功將 status 從 IN_PROGRESS 改為 COMPLETED，
    // 後續請求的 completed.count === 0，就不會重複發放星星/streak/badge。
    // 此 gate 必須在掌握度/遊戲化之前執行，確保冪等性。
    const completed = await prisma.practiceSession.updateMany({
      where: { id: payload.sessionId, status: 'IN_PROGRESS' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    if (completed.count === 0) {
      // 已有其他併發請求完成了此 session → 不重複發獎勵
      return {
        correct,
        correctAnswer,
        finished: true,
        sessionId: payload.sessionId,
        explanation: q.explanation,
        promotion: null,
      }
    }

    // 平行化掌握度更新（特殊 session 不更新掌握度）
    const masteryPromise = isSpecialSession
      ? Promise.resolve()
      : updateMastery(payload.sessionId)

    const [sessionAttempts] = await Promise.all([
      prisma.attempt.findMany({ where: { sessionId: payload.sessionId } }),
      masteryPromise,
    ])

    // ============ 遊戲化 ============
    const starsEarned = sessionAttempts.filter(
      (a) => a.isCorrect && !a.assisted
    ).length
    const allCorrect = sessionAttempts.every(
      (a) => a.isCorrect
    )

    // 平行寫入 correctCount、星星、連續天數
    await Promise.all([
      prisma.practiceSession.update({
        where: { id: payload.sessionId },
        data: { correctCount: starsEarned },
      }),
      updateStars(childId, starsEarned),
      updateStreak(childId),
    ])

    // ============ 升學測試處理（需在徽章檢查之前判定）============
    let passedPromotion = false
    // qualifyPromotion 已在外部定義
    let targetGrade: string | null = null
    if (isPromotionTest) {
      try {
        const storedQuestions = JSON.parse(practiceSession.questionsJson ?? '[]')
        const rawTarget = Array.isArray(storedQuestions) ? storedQuestions[0]?.__targetGrade : undefined
        targetGrade = typeof rawTarget === 'string' ? rawTarget : null
        // 升學及格判斷：只看「目前年級」題目（孩子已學過的內容），
        // 下一年級預覽題（__fromGrade === targetGrade）不計入及格率，
        // 避免孩子因為沒學過的新內容而無法升學。
        const legitAttempts = sessionAttempts.filter((a) => !a.assisted)
        const currentGradeAttempts = legitAttempts.filter((a) => {
          const q = storedQuestions[a.questionIndex]
          // 沒有 __fromGrade 標記的舊 session 一律視為目前年級題（向後相容）
          return !q?.__fromGrade || q.__fromGrade !== targetGrade
        })
        const currentCorrect = currentGradeAttempts.filter((a) => a.isCorrect).length
        const passRate = currentGradeAttempts.length > 0
          ? currentCorrect / currentGradeAttempts.length
          : 0
        // 目前年級正確率 ≥ 80% 即達升學門檻（預覽題答對另外加星鼓勵）
        if (passRate >= 0.8 && targetGrade) {
          qualifyPromotion = true
          passedPromotion = true
          // 注意：不在此自動升級 gradeLevel，由使用者手動確認後才升級
          // 雙倍星星獎勵也在確認升級時發放
        }
      } catch { /* ignore */ }
    }

    await checkBadges({
      childId,
      sessionCorrectCount: starsEarned,
      sessionTotalQuestions: practiceSession.totalQuestions,
      allCorrect,
      isPromotion: isPromotionTest,
      passedPromotion,
      isChallenge: isChallengeSession,
      kind: practiceSession.kind,
    })
  }

  // 僅在練習完成時重新驗證快取（不包含 /practice layout，避免觸發意外 re-render 導致跳轉）
  if (finished) {
    revalidatePath('/dashboard')
  }

  // 回傳時檢查是否為升學測試且剛完成，附加升學結果
  let promotionResult: SubmitResult['promotion'] = null
  if (finished && isPromotionTest) {
    try {
      const storedQuestions = JSON.parse(practiceSession.questionsJson ?? '[]')
      const rawTargetGrade = Array.isArray(storedQuestions) ? storedQuestions[0]?.__targetGrade : undefined
      const targetGrade = typeof rawTargetGrade === 'string' ? rawTargetGrade : null
      if (targetGrade) {
        const child = await prisma.childProfile.findUnique({ where: { id: practiceSession.childId } })
        const confirmed = child?.gradeLevel === targetGrade
        promotionResult = {
          qualify: qualifyPromotion,
          confirmed,
          newGrade: confirmed ? targetGrade : null,
          targetGrade,
        }
      }
    } catch { /* ignore */ }
  }

  return { correct, correctAnswer, finished, sessionId: payload.sessionId, explanation: q.explanation, promotion: promotionResult }
}

// 取得孩子的技能選單與推薦
export async function getChildSkills(childId: string) {
  const auth = await getPracticeAuth()
  if (!auth) return null

  // 🔥 權限檢查直接合併到主查詢，省去 canAccessChild 的額外 3 次 DB round-trip
  // （Supabase 在印度，每個 round-trip ~150ms，省下 ~450ms）
  // 家長：只能看自己建立/綁定的孩子；孩子：只能看自己
  const child =
    auth.type === 'child'
      ? auth.childId !== childId
        ? null
        : await prisma.childProfile.findFirst({
            where: { id: childId },
            include: { masterySnapshots: { include: { skill: true } } },
          })
      : await prisma.childProfile.findFirst({
          where: {
            id: childId,
            OR: [
              { parentId: auth.userId },
              { parentLinks: { some: { parentId: auth.userId, status: 'ACTIVE' } } },
            ],
          },
          include: { masterySnapshots: { include: { skill: true } } },
        })
  if (!child) return null

  // 年級權限：低年級不可看高年級；高年級可往下複習低年級
  const grades = accessibleGrades(child.gradeLevel)

  // P1-6：一般練習技能選單只計非 challenge 題
  const skills = await prisma.skill.findMany({
    where: { isActive: true, gradeLevel: { in: grades } },
    orderBy: { order: 'asc' },
    include: { _count: { select: { questions: { where: { isActive: true, isChallenge: false } } } } },
  })

  return {
    child,
    skills: skills.map((s) => {
      const mastery = child.masterySnapshots.find((m) => m.skillId === s.id)
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        gradeLevel: s.gradeLevel,
        questionCount: s._count.questions,
        masteryLevel: mastery?.masteryLevel ?? 0,
        recentCorrect: mastery?.recentCorrect ?? 0,
        recentTotal: mastery?.recentTotal ?? 0,
      }
    }),
    recommendation: getRecommendation(skills, child.masterySnapshots),
  }
}

// 查詢「完成練習後的下一個推薦練習」（純查詢，不 redirect）
// 完成頁面用此結果顯示下一個要練的技能名稱與推薦理由。
//
// 權限檢查由 getChildSkills 內部處理（getPracticeAuth + canAccessChild），
// 此處不重複驗證，避免多餘的 auth/JWT 解析與 DB 查詢。
export async function getNextPractice(childId: string): Promise<Recommendation | null> {
  const data = await getChildSkills(childId)
  if (!data) return null
  return data.recommendation
}

// 完成練習後直接開始「推薦的下一個練習」
// 基於剛更新的掌握度即時計算推薦，再由 createPracticeSessionInternal 建立新 session 並 redirect。
// 注意：不透過巢狀呼叫 startSession（避免 redirect 在巢狀 Server Action 中 race condition），
// 直接使用 createPracticeSessionInternal 後自行 redirect。
// 若無推薦技能（ALL_DONE）則回到練習選單。
//
// 權限檢查交由 getChildSkills / createPracticeSessionInternal 內部處理，此處不重複。
export async function startNextPractice(childId: string) {
  const data = await getChildSkills(childId)
  const rec = data?.recommendation
  // 無資料或無推薦技能（ALL_DONE）→ 回練習選單
  if (!rec?.skillId) redirect(`/practice/${childId}`)
  // 直接建立 session 並 redirect，不再透過巢狀呼叫 startSession
  const { sessionId } = await createPracticeSessionInternal(childId, rec.skillId)
  redirect(`/practice/${childId}/${rec.skillId}/${sessionId}`)
}

// ============ 手動確認升學 ============
// 升學測試達到門檻後，由使用者手動點擊按鈕觸發升級，
// 而非 submitAnswer 自動升級，給予使用者確認與慶祝的空間。
// P1-9：使用 transaction + conditional update 防 race condition；
// 查最近一個匹配 targetGrade 的 promotion session。
export async function confirmPromotion(childId: string, targetGrade: string) {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')
  if (!(await canAccessChild(childId))) throw new Error('找不到孩子檔案')

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) throw new Error('找不到孩子檔案')

  // 防止重複升級（若已升級則跳過）
  if (child.gradeLevel === targetGrade) {
    redirect(`/practice/${childId}`)
    return
  }

  // 確保目標年級確實是下一年級（防止篡改 targetGrade）
  const next = getNextGrade(child.gradeLevel)
  if (next !== targetGrade) throw new Error('年級順序錯誤')

  // ============ 重新驗證升學測試 ============
  // P1-9：查最近一個「符合 targetGrade 的升學測試 session」，
  // 而非最近一次完成的一般練習。
  const lastPromotionSession = await prisma.practiceSession.findFirst({
    where: {
      childId,
      kind: 'PROMOTION',
      status: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
    include: { attempts: true },
  })
  if (!lastPromotionSession) throw new Error('未完成升學測試，無法升學')

  const storedQuestions: unknown[] = lastPromotionSession.questionsJson
    ? JSON.parse(lastPromotionSession.questionsJson)
    : []
  if (!Array.isArray(storedQuestions) || !storedQuestions[0]) {
    throw new Error('找不到練習記錄')
  }
  const firstQ = storedQuestions[0] as Record<string, unknown>
  if (!firstQ.__isPromotion || firstQ.__targetGrade !== targetGrade) {
    throw new Error('未通過升學測試，無法升學')
  }

  // 重算升學及格率（與 submitAnswer 邏輯一致）
  const legitAttempts = lastPromotionSession.attempts.filter((a) => !a.assisted)
  const currentGradeAttempts = legitAttempts.filter((a) => {
    const q = storedQuestions[a.questionIndex] as Record<string, unknown> | undefined
    return !q?.__fromGrade || q.__fromGrade !== targetGrade
  })
  const currentCorrect = currentGradeAttempts.filter((a) => a.isCorrect).length
  const passRate = currentGradeAttempts.length > 0
    ? currentCorrect / currentGradeAttempts.length
    : 0
  if (passRate < 0.8) {
    throw new Error(`目前年級正確率 ${Math.round(passRate * 100)}% 未達 80%，無法升學`)
  }

  // ============ 使用 transaction 防 race condition ============
  // P1-9：conditional update 保證只有一個請求能完成升級及發獎勵。
  // 檢查 promotionRewarded（而非 promotionPassedAt），確保獎勵只發一次。
  await prisma.$transaction(async (tx) => {
    // 再次讀取最新狀態（在 transaction 內）
    const current = await tx.childProfile.findUnique({
      where: { id: childId },
      select: { gradeLevel: true, promotionRewarded: true },
    })
    if (!current) throw new Error('找不到孩子檔案')
    if (current.gradeLevel === targetGrade) {
      // 已被其他併發請求升級
      return
    }

    // 升級 gradeLevel（這會「解鎖」下一年級的技能）
    await tx.childProfile.update({
      where: { id: childId },
      data: {
        gradeLevel: targetGrade,
        promotionPassedAt: new Date(),
        promotionTarget: targetGrade as string,
      },
    })

    // 雙倍星星獎勵（僅發一次：promotionRewarded 為 false 時才發放）
    if (!current.promotionRewarded && lastPromotionSession.correctCount > 0) {
      await tx.childProfile.update({
        where: { id: childId },
        data: { stars: { increment: lastPromotionSession.correctCount }, promotionRewarded: true },
      })
    } else if (!current.promotionRewarded) {
      await tx.childProfile.update({
        where: { id: childId },
        data: { promotionRewarded: true },
      })
    }
  })

  // 重新驗證快取：儀表板與練習選單都會讀到新年級
  revalidatePath('/dashboard')
  revalidatePath(`/practice/${childId}`)
  // 帶 ?promoted=G1 旗標，讓練習選單顯示「已解鎖新年級」的慶祝橫幅
  redirect(`/practice/${childId}?promoted=${targetGrade}`)
}

// ============ 升學測試 ============
// 檢查孩子是否能參加升學測試（目前年級的所有技能已掌握）
export async function checkPromotionEligibility(childId: string): Promise<{
  eligible: boolean
  currentGrade: string
  nextGrade: string | null
}> {
  const auth = await getPracticeAuth()
  if (!auth) return { eligible: false, currentGrade: '', nextGrade: null }
  if (!(await canAccessChild(childId))) return { eligible: false, currentGrade: '', nextGrade: null }

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) return { eligible: false, currentGrade: '', nextGrade: null }

  const next = getNextGrade(child.gradeLevel)
  if (!next) return { eligible: false, currentGrade: child.gradeLevel, nextGrade: null }

  const allMastered = await isGradeAllMastered(childId, child.gradeLevel)
  return { eligible: allMastered, currentGrade: child.gradeLevel, nextGrade: next }
}

// 開始升學測試：從目前年級所有技能中隨機出題
export async function startPromotionTest(childId: string) {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')
  if (!(await canAccessChild(childId))) throw new Error('找不到孩子檔案')

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) throw new Error('找不到孩子檔案')

  const next = getNextGrade(child.gradeLevel)
  if (!next) throw new Error('已經是最後一個年級，不需升學測試')

  // 確認目前年級所有技能已掌握
  const allMastered = await isGradeAllMastered(childId, child.gradeLevel)
  if (!allMastered) throw new Error('尚未完成所有技能，無法參加升學測試')

  // P1-6：升學測試也只取非 challenge 題
  const skills = await prisma.skill.findMany({
    where: { gradeLevel: child.gradeLevel, isActive: true },
    include: { questions: { where: { isActive: true, isChallenge: false } } },
  })
  if (skills.length === 0 || skills.every((s) => s.questions.length === 0)) {
    throw new Error('目前年級沒有題目可供測試')
  }

  // 也取得下一年級的題目（用來出「預覽題」提前適應新內容）
  const nextSkills = await prisma.skill.findMany({
    where: { gradeLevel: next, isActive: true },
    include: { questions: { where: { isActive: true, isChallenge: false } } },
  })
  const nextTotalQuestions = nextSkills.reduce((sum, s) => sum + s.questions.length, 0)

  const QUESTIONS_PER_SESSION = 10
  // 題目比例：以「目前年級」為主（證明已學內容扎實），下一年級僅少量「預覽題」。
  // 預覽題不計入升學及格判斷（孩子還沒學過，答錯不該懲罰）。
  // 7 題目前年級 + 3 題下一年級預覽（若下一年級題庫不足則全用目前年級）
  const desiredNextGradeCount = nextTotalQuestions > 0 ? 3 : 0
  const currentGradeCount = QUESTIONS_PER_SESSION - desiredNextGradeCount

  type SeedQuestion = {
    templateId: string
    prompt: string
    answer: string
    options?: string[]
    explanation?: string
    /** 標記題目來源年級，用於及格判斷（目前年級才計分） */
    __fromGrade: string
  }
  const currentGradeQuestions: SeedQuestion[] = []
  const nextGradeQuestions: SeedQuestion[] = []

  // 從目前年級出題（平均分配到每個技能，先各出足夠數量再取前 N 題）
  for (const skill of skills) {
    // 每個技能最多取 ceil(currentGradeCount / 技能數)，確保湊得到目標題數
    const perSkill = Math.ceil(currentGradeCount / skills.length)
    const templates = shuffle(skill.questions).slice(0, perSkill)
    for (const t of templates) {
      const q = generateQuestion({
        id: t.id,
        type: t.type,
        prompt: t.prompt,
        paramsJson: t.paramsJson,
        answer: t.answer,
        options: t.options,
      })
      currentGradeQuestions.push({
        templateId: q.templateId!,
        prompt: q.prompt,
        answer: q.answer,
        options: q.options,
        explanation: t.explanation ?? undefined,
        __fromGrade: child.gradeLevel,
      })
    }
  }

  // 從下一年級出題（預覽題 — 提前看看新內容，答錯不影響及格）
  if (nextTotalQuestions > 0) {
    for (const skill of nextSkills) {
      const perSkill = Math.max(1, Math.ceil(desiredNextGradeCount / nextSkills.length))
      const templates = shuffle(skill.questions).slice(0, perSkill)
      for (const t of templates) {
        const q = generateQuestion({
          id: t.id,
          type: t.type,
          prompt: t.prompt,
          paramsJson: t.paramsJson,
          answer: t.answer,
          options: t.options,
        })
        nextGradeQuestions.push({
          templateId: q.templateId!,
          prompt: q.prompt,
          answer: q.answer,
          options: q.options,
          explanation: t.explanation ?? undefined,
          __fromGrade: next,
        })
      }
    }
  }

  // 組合：取足夠的目前年級題 + 預覽題，洗牌後恰好取 QUESTIONS_PER_SESSION 題
  const pickedCurrent = shuffle(currentGradeQuestions).slice(0, currentGradeCount)
  const pickedNext = shuffle(nextGradeQuestions).slice(0, desiredNextGradeCount)
  const finalQuestions = shuffle([...pickedCurrent, ...pickedNext]).slice(0, QUESTIONS_PER_SESSION)

  // 用 __isPromotion: true 標記這是升學測試；保留各題 __fromGrade 以供及格判斷
  const sessionQuestions = finalQuestions.map((q) => ({
    ...q,
    __isPromotion: true,
    __targetGrade: next,
  }))

  // 實際題數可能會少於 QUESTIONS_PER_SESSION（題庫不足時），
  // 以實際數量寫入 totalQuestions，避免學生做完所有題目後仍無法完成 session
  const actualTotal = sessionQuestions.length
  if (actualTotal === 0) throw new Error('沒有可用題目')

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId: skills[0].id, // 用第一個技能存關聯
      parentId: auth.type === 'parent' ? auth.userId : child.parentId,
      totalQuestions: actualTotal,
      questionsJson: JSON.stringify(sessionQuestions),
      kind: 'PROMOTION',
      status: 'IN_PROGRESS',
    },
  })

  redirect(`/practice/${childId}/${skills[0].id}/${practiceSession.id}`)
}

// ============ 提升練習（挑戰練習）============
// 從孩子目前年級可觸及的所有題庫中隨機挑選挑戰題（isChallenge=true），
// 每次 10 題。不影響掌握度、不計入升學判斷，純粹挑戰自我。
const CHALLENGE_QUESTIONS_PER_SESSION = 10

export async function startChallengePractice(childId: string) {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')
  if (!(await canAccessChild(childId))) throw new Error('找不到孩子檔案')

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) throw new Error('找不到孩子檔案')

  // 取得孩子可接觸年級下的所有挑戰題
  const grades = accessibleGrades(child.gradeLevel)
  const challengeQuestions = await prisma.questionTemplate.findMany({
    where: { isActive: true, isChallenge: true, skill: { gradeLevel: { in: grades } } },
    include: { skill: { select: { name: true } } },
  })
  if (challengeQuestions.length === 0) {
    // 無挑戰題時不回傳 500，而是導回練習選單並附加錯誤訊息
    redirect(`/practice/${childId}?error=no_challenge`)
  }

  // 從所有技能中隨機選取一個作為 session 的 skillId（僅供關聯）
  const firstSkill = await prisma.skill.findFirst({ where: { gradeLevel: child.gradeLevel, isActive: true } })
  if (!firstSkill) throw new Error('找不到技能')

  // 隨機挑選 CHALLENGE_QUESTIONS_PER_SESSION 題
  const selected = shuffle(challengeQuestions).slice(0, CHALLENGE_QUESTIONS_PER_SESSION)
  const generated: StoredQuestion[] = selected.map((t) => {
    const q = generateQuestion({
      id: t.id,
      type: t.type,
      prompt: t.prompt,
      paramsJson: t.paramsJson,
      answer: t.answer,
      options: t.options,
    })
    // 解析互動模式
    let interaction: string | undefined
    let rangeMin: number | undefined
    let rangeMax: number | undefined
    let inputMode: string | undefined
    let maxLength: number | undefined
    let placeholder: string | undefined
    if (t.paramsJson) {
      try {
        const parsed = JSON.parse(t.paramsJson)
        interaction = parsed.interaction
        rangeMin = parsed.rangeMin
        rangeMax = parsed.rangeMax
        inputMode = parsed.inputMode
        maxLength = parsed.maxLength
        placeholder = parsed.placeholder
      } catch { /* ignore */ }
    }
    return {
      templateId: q.templateId!,
      prompt: q.prompt,
      answer: q.answer,
      options: q.options,
      explanation: t.explanation ?? undefined,
      interaction,
      rangeMin,
      rangeMax,
      inputMode,
      maxLength,
      placeholder,
      __isChallenge: true, // 標記為提升練習
    }
  })

  // 實際題數可能少於 CHALLENGE_QUESTIONS_PER_SESSION
  const actualTotal = generated.length

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId: firstSkill.id,
      parentId: auth.type === 'parent' ? auth.userId : child.parentId,
      totalQuestions: actualTotal,
      questionsJson: JSON.stringify(generated),
      kind: 'CHALLENGE',
      status: 'IN_PROGRESS',
    },
  })

  redirect(`/practice/${childId}/${firstSkill.id}/${practiceSession.id}`)
}

// ============ 取消未完成的練習（斷點續做中移除）============
// P1-4：使用 status=CANCELLED + cancelledAt，不再濫用 completedAt
export async function cancelSession(sessionId: string) {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    select: { childId: true },
  })
  if (!practiceSession) throw new Error('練習不存在')

  // 使用 canAccessChild 統一驗證（支援 linked parent、self-study child 等場景）
  if (!(await canAccessChild(practiceSession.childId))) throw new Error('無權存取')

  // 只取消進行中的練習
  const now = new Date()
  await prisma.practiceSession.updateMany({
    where: { id: sessionId, status: 'IN_PROGRESS' },
    data: { status: 'CANCELLED', cancelledAt: now },
  })
}
