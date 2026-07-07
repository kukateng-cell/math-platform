'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { generateQuestion, shuffle } from '@/lib/question'
import { updateMastery, getRecommendation, isGradeAllMastered, type Recommendation } from '@/lib/mastery'
import { updateStars, updateStreak, checkBadges } from '@/lib/gamification'
import { getNextGrade, gradeRank } from '@/lib/grade'
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

  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: { questions: { where: { isActive: true } } },
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

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId,
      parentId: auth.type === 'parent' ? auth.userId : child.parentId,
      totalQuestions: QUESTIONS_PER_SESSION,
      questionsJson: JSON.stringify(generated),
    },
  })

  return { sessionId: practiceSession.id, childId, skillId }
}

// 開始一次練習：在伺服器生成題目快照後建立 session
export async function startSession(childId: string, skillId: string) {
  const { sessionId } = await createPracticeSessionInternal(childId, skillId)
  redirect(`/practice/${childId}/${skillId}/${sessionId}`)
}

// 取得一次練習要做的題目（從 session 的伺服器快照讀取，確保與驗證一致）
// 同時回傳「已作答進度」供斷點續做：已答題數、正確數、每題結果。
export async function getSessionQuestions(
  sessionId: string
): Promise<{
  questions: (StoredQuestion & { interaction?: string; rangeMin?: number; rangeMax?: number })[]
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

  return {
    questions,
    skillName: practiceSession.skill.name,
    childNickname: practiceSession.child.nickname,
    answeredCount: attempts.length,
    correctCount,
    completed: practiceSession.completedAt !== null,
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

  const sessions = await prisma.practiceSession.findMany({
    where: {
      childId,
      completedAt: null,
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
    .filter((s) => {
      // 過濾升學測試（__isPromotion）和提升練習（__isChallenge）
      try {
        const q = JSON.parse(s.questionsJson!)
        const firstQ = Array.isArray(q) ? q[0] : null
        return !firstQ?.__isPromotion && !firstQ?.__isChallenge
      } catch { return true }
    })
    .map((s) => ({
      sessionId: s.id,
      skillId: s.skill.id,
      skillName: s.skill.name,
      totalQuestions: s.totalQuestions,
      answeredCount: s._count.attempts,
      remainingCount: s.totalQuestions - s._count.attempts,
      startedAt: s.startedAt,
    }))
}

export type SubmitResult = {
  correct: boolean
  correctAnswer: string
  finished: boolean
  sessionId: string
  explanation?: string
  /** 升學測試結果（僅在 finished=true 時有值） */
  promotion?: {
    passed: boolean
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
  // 已完成的練習不再接受作答（防重複提交）
  if (practiceSession.completedAt) {
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
    return {
      correct: false,
      correctAnswer: '',
      finished: false,
      sessionId: payload.sessionId,
    }
  }

  const correctAnswer = q.answer
  // 中英文等價驗證：例如「left」「左邊」都視為正確
  const correct = isAnswerCorrect(payload.userAnswer, correctAnswer)

  // durationMs 伺服器驗證：確保為合理範圍（0ms ~ 5 分鐘），防止前端偽造速度類徽章
  const validatedDurationMs = Math.max(0, Math.min(payload.durationMs, 300_000))

  // 防止重複提交同一題（attempt 表有 @@unique([sessionId, questionIndex])，
  // 捕捉 Prisma P2002 錯誤並優雅回退，避免刷高星星與掌握度）
  try {
    await prisma.attempt.create({
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
  } catch (e: unknown) {
    // P2002 = unique constraint violation → 代表此題已提交過
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002') {
      return {
        correct: false,
        correctAnswer: '',
        finished: false,
        sessionId: payload.sessionId,
      }
    }
    throw e
  }

  // 用 questionIndex 判斷完成（避免 attempt.count DB 查詢）
  const finished = payload.questionIndex + 1 >= practiceSession.totalQuestions

  // 判斷是否為提升練習或升學測試（從 questionsJson 的第一題標記判斷）
  // 升學測試混合了多個技能及下一年級的題目，所有作答都歸到第一個技能 ID，
  // 若執行 updateMastery 會嚴重污染掌握度，導致推薦系統把用戶引回舊技能。
  // 因此特殊 session（提升練習/升學測試）一律不更新掌握度。
  let isSpecialSession = false
  let isChallengeSession = false
  try {
    const storedQ = practiceSession.questionsJson ? JSON.parse(practiceSession.questionsJson) : []
    if (Array.isArray(storedQ) && storedQ[0]) {
      if (storedQ[0].__isChallenge) { isSpecialSession = true; isChallengeSession = true }
      if (storedQ[0].__isPromotion) isSpecialSession = true
    }
  } catch { /* ignore */ }

  if (finished) {
    const childId = practiceSession.childId

    // 平行化完成時的 DB 操作：完成時間 + 掌握度（非特殊 session）可同時進行
    // 特殊 session（提升練習/升學測試）不更新掌握度
    const masteryPromise = isSpecialSession
      ? Promise.resolve()
      : updateMastery(payload.sessionId)

    const [sessionAttempts] = await Promise.all([
      prisma.attempt.findMany({ where: { sessionId: payload.sessionId } }),
      prisma.practiceSession.update({
        where: { id: payload.sessionId },
        data: { completedAt: new Date() },
      }),
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
    let isPromotionTest = false
    let passedPromotion = false
    let targetGrade: string | null = null
    try {
      const storedQuestions = JSON.parse(practiceSession.questionsJson ?? '[]')
      if (Array.isArray(storedQuestions) && storedQuestions[0]?.__isPromotion) {
        isPromotionTest = true
        targetGrade = storedQuestions[0].__targetGrade as string
        // 正確率 ≥ 80%（不計 assisted）即升學成功
        const legitAttempts = sessionAttempts.filter((a) => !a.assisted)
        const correctCount = legitAttempts.filter((a) => a.isCorrect).length
        const passRate = legitAttempts.length > 0
          ? correctCount / legitAttempts.length
          : 0

        if (passRate >= 0.8 && targetGrade) {
          await prisma.childProfile.update({
            where: { id: childId },
            data: { gradeLevel: targetGrade },
          })
          passedPromotion = true
          // 升學測試通過：獎勵雙倍星星（再加一倍）
          await updateStars(childId, starsEarned)
        }
      }
    } catch { /* ignore */ }

    await checkBadges({
      childId,
      sessionCorrectCount: starsEarned,
      sessionTotalQuestions: practiceSession.totalQuestions,
      allCorrect,
      isPromotion: isPromotionTest,
      passedPromotion,
      isChallenge: isChallengeSession,
    })
  }

  // 僅在練習完成時重新驗證快取
  if (finished) {
    revalidatePath('/dashboard')
    revalidatePath('/children')
    revalidatePath('/practice', 'layout')
  }

  // 回傳時檢查是否為升學測試且剛完成，附加升學結果
  let promotionResult: SubmitResult['promotion'] = null
  if (finished) {
    try {
      const storedQuestions = JSON.parse(practiceSession.questionsJson ?? '[]')
      if (Array.isArray(storedQuestions) && storedQuestions[0]?.__isPromotion) {
        const targetGrade = storedQuestions[0].__targetGrade as string
        const childId = practiceSession.childId
        const child = await prisma.childProfile.findUnique({ where: { id: childId } })
        const passed = child?.gradeLevel === targetGrade
        promotionResult = { passed, newGrade: passed ? targetGrade : null, targetGrade }
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
      ? await prisma.childProfile.findFirst({
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

  const skills = await prisma.skill.findMany({
    where: { isActive: true, gradeLevel: { in: grades } },
    orderBy: { order: 'asc' },
    include: { _count: { select: { questions: { where: { isActive: true } } } } },
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

  // 取得目前年級的所有技能
  const skills = await prisma.skill.findMany({
    where: { gradeLevel: child.gradeLevel, isActive: true },
    include: { questions: { where: { isActive: true } } },
  })
  if (skills.length === 0 || skills.every((s) => s.questions.length === 0)) {
    throw new Error('目前年級沒有題目可供測試')
  }

  // 也取得下一年級的題目（用來出「預覽題」評估真實實力）
  const nextSkills = await prisma.skill.findMany({
    where: { gradeLevel: next, isActive: true },
    include: { questions: { where: { isActive: true } } },
  })

  const QUESTIONS_PER_SESSION = 10
  // 目前年級約 5 題（保留已學知識的考驗）
  const currentGradeCount = Math.min(5, Math.floor(QUESTIONS_PER_SESSION / 2))
  // 下一年級約 5 題（預覽題，真正有難度）
  const nextGradeCount = Math.min(QUESTIONS_PER_SESSION - currentGradeCount,
    nextSkills.reduce((sum, s) => sum + s.questions.length, 0))

  const allQuestions: { templateId: string; prompt: string; answer: string; options?: string[]; explanation?: string }[] = []

  // 從目前年級出題（驗證已學內容）
  const questionsPerSkill = Math.max(1, Math.floor(currentGradeCount / skills.length))
  for (const skill of skills) {
    const templates = shuffle(skill.questions).slice(0, questionsPerSkill)
    for (const t of templates) {
      const q = generateQuestion({
        id: t.id,
        type: t.type,
        prompt: t.prompt,
        paramsJson: t.paramsJson,
        answer: t.answer,
        options: t.options,
      })
      allQuestions.push({
        templateId: q.templateId!,
        prompt: q.prompt,
        answer: q.answer,
        options: q.options,
        explanation: t.explanation ?? undefined,
      })
    }
  }

  // 從下一年級出題（預覽題 — 真正有難度的挑戰）
  const nextQuestionsPerSkill = nextSkills.length > 0
    ? Math.max(1, Math.floor(nextGradeCount / nextSkills.length))
    : 0
  for (const skill of nextSkills) {
    const templates = shuffle(skill.questions).slice(0, nextQuestionsPerSkill)
    for (const t of templates) {
      const q = generateQuestion({
        id: t.id,
        type: t.type,
        prompt: t.prompt,
        paramsJson: t.paramsJson,
        answer: t.answer,
        options: t.options,
      })
      allQuestions.push({
        templateId: q.templateId!,
        prompt: q.prompt,
        answer: q.answer,
        options: q.options,
        explanation: t.explanation ?? undefined,
      })
    }
  }

  // 洗牌後取 QUESTIONS_PER_SESSION 題
  const finalQuestions = shuffle(allQuestions).slice(0, QUESTIONS_PER_SESSION)

  // 用 __isPromotion: true 標記這是升學測試
  const sessionQuestions = finalQuestions.map((q) => ({
    ...q,
    __isPromotion: true,
    __targetGrade: next,
  }))

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId: skills[0].id, // 用第一個技能存關聯
      parentId: auth.type === 'parent' ? auth.userId : child.parentId,
      totalQuestions: QUESTIONS_PER_SESSION,
      questionsJson: JSON.stringify(sessionQuestions),
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

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId: firstSkill.id,
      parentId: auth.type === 'parent' ? auth.userId : child.parentId,
      totalQuestions: CHALLENGE_QUESTIONS_PER_SESSION,
      questionsJson: JSON.stringify(generated),
    },
  })

  redirect(`/practice/${childId}/${firstSkill.id}/${practiceSession.id}`)
}

// ============ 取消未完成的練習（斷點續做中移除）============
// 讓使用者關閉不想繼續的練習，將其標記為已取消（completedAt 設為當前時間）
export async function cancelSession(sessionId: string) {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    select: { childId: true, parentId: true },
  })
  if (!practiceSession) throw new Error('練習不存在')

  // 驗證權限
  if (auth.type === 'child' && auth.childId !== practiceSession.childId) throw new Error('無權存取')
  if (auth.type === 'parent' && practiceSession.parentId !== auth.userId) throw new Error('無權存取')

  // 只取消未完成的練習
  await prisma.practiceSession.updateMany({
    where: { id: sessionId, completedAt: null },
    data: { completedAt: new Date() },
  })
}
