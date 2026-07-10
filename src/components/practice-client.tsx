'use client'

import { useState, useRef, useEffect } from 'react'
import {
  submitAnswer,
  startSession,
  startNextPractice,
  confirmPromotion,
  getNextPractice,
  type SubmitResult,
} from '@/actions/practice'
import NumberPad from './number-pad'
import NumberLine from './number-line'
import { renderTextWithShapes, renderOption, isShapeName } from './shape-icon'
import { Icon, type IconName } from './icon'
import { displayAnswer } from '@/lib/answer-i18n'
import type { Recommendation } from '@/lib/mastery'

type QuestionItem = {
  templateId: string
  prompt: string
  // 注意：不含 answer 欄位。正確答案只存在 server 端，
  // 唯有透過 submitAnswer 提交後才會在回傳值（correctAnswer）中提供。
  options?: string[]
  explanation?: string
  interaction?: string
  rangeMin?: number
  rangeMax?: number
  /** 輸入模式：numeric(數字+小數點) / text(文字)，預設 numeric */
  inputMode?: string
  /** 數字模式最多位數 */
  maxLength?: number
  /** 文字模式 placeholder */
  placeholder?: string
}

type QuestionResult = {
  correct: boolean
  assisted: boolean
  correctAnswer: string
  userAnswer: string
}

function formatDuration(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

// 依正確率回傳鼓勵語 + 對應 SVG 圖示（取代原本 emoji）
function getEncouragement(rate: number): { icon: IconName; msg: string } {
  if (rate >= 100) return { icon: 'trophy', msg: '完美！全部答對！' }
  if (rate >= 80) return { icon: 'sparkle', msg: '好厲害！繼續保持！' }
  if (rate >= 60) return { icon: 'thumbs-up', msg: '不錯喔！再加油！' }
  return { icon: 'sprout', msg: '沒關係，多練習就會了！' }
}

// ============ 完成頁紙屑粒子 ============
// 在「模組層級」產生一次隨機設定（不在元件 render 中呼叫 Math.random），
// 滿足 React「render 必須純粹」的規則。每次完成頁共用同一組粒子，視覺上無差異。
type ConfettiParticle = {
  x: number
  delay: number
  color: string
  shape: IconName
  size: number
  duration: number
}

const CONFETTI_COLORS = ['#facc15', '#f97316', '#ef4444', '#a855f7', '#3b82f6', '#22c55e', '#ec4899', '#06b6d4']
const CONFETTI_SHAPES: IconName[] = ['star', 'sparkle', 'circle', 'gem']
const CONFETTI_PARTICLES: ConfettiParticle[] = Array.from({ length: 40 }).map(() => ({
  x: Math.random() * 100,
  delay: Math.random() * 2.5,
  color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  shape: CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)],
  size: 0.5 + Math.random() * 1,
  duration: 1.5 + Math.random() * 2,
}))

type Props = {
  questions: QuestionItem[]
  sessionId: string
  skillName: string
  childNickname: string
  childId: string
  skillId: string
  /** 斷點續做：從第幾題開始（已作答的題數） */
  initialIndex?: number
  /** 斷點續做：已答題中答對的數量 */
  initialCorrectCount?: number
  /** 斷點續做：已答題的逐題結果 */
  initialQuestionResults?: {
    questionIndex: number
    correct: boolean
    assisted: boolean
    correctAnswer: string
    userAnswer: string
  }[]
}

export default function PracticeClient({
  questions,
  sessionId,
  skillName,
  childNickname,
  childId,
  skillId,
  initialIndex = 0,
  initialCorrectCount = 0,
  initialQuestionResults = [],
}: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [selected, setSelected] = useState<string | null>(null)
  const [fillValue, setFillValue] = useState('')
  const [lineValue, setLineValue] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null)
  const [assisted, setAssisted] = useState(false)
  const [correctCount, setCorrectCount] = useState(initialCorrectCount)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // questionResults 以 questionIndex 為索引的稀疏陣列
  // 斷點續做時，從 initialQuestionResults 填入對應位置
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>(() => {
    const arr: QuestionResult[] = []
    for (const r of initialQuestionResults) {
      arr[r.questionIndex] = {
        correct: r.correct,
        assisted: r.assisted,
        correctAnswer: r.correctAnswer,
        userAnswer: r.userAnswer,
      }
    }
    return arr
  })
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [revealCorrect, setRevealCorrect] = useState(false)
  const [bgFlash, setBgFlash] = useState<'green' | 'red' | null>(null)
  const [elapsed, setElapsed] = useState('00:00')
  const [finalTotalMs, setFinalTotalMs] = useState<number | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showCelebration, setShowCelebration] = useState(true)
  /** 多設備情境：此練習已在其他裝置被完成，非本地答錯 */
  const [remoteFinished, setRemoteFinished] = useState(false)
  const startTimeRef = useRef<number>(0)
  const practiceStartRef = useRef<number>(0)
  const firstOptionRef = useRef<HTMLButtonElement | null>(null)
  const completionLinkRef = useRef<HTMLAnchorElement | null>(null)
  // 答題回饋區塊：答完後自動滾動至此，避免使用者要手動往下滑找「下一題」
  const feedbackRef = useRef<HTMLDivElement | null>(null)
  const submittingRef = useRef(false)

  // 計時基準時間：在 mount effect 中設定（不可在 render 期間呼叫 Date.now()）。
  // startTimeRef 為「當前題目」起始時間（nextQuestion 中會重設）；practiceStartRef 為整個練習起始時間。
  useEffect(() => {
    const now = Date.now()
    startTimeRef.current = now
    practiceStartRef.current = now
  }, [])

  const current = questions[index]
  const progress = Math.round((index / questions.length) * 100)
  const totalQuestions = questions.length

  // 完成練習時 index 可能短暫越界（questions[index] 為 undefined），
  // 此時 early return 會進入完成頁；為避免存取 undefined 的屬性而崩潰，加 fallback。
  // 提前計算 interaction / currentAnswer，讓下方 effects 與事件處理可直接使用（避免使用前宣告）。
  const interaction = current
    ? (current.interaction || (!current.options || current.options.length === 0 ? 'fillin' : 'choice'))
    : 'choice'

  const currentAnswer = interaction === 'numberline'
    ? lineValue !== null ? String(lineValue) : null
    : interaction === 'fillin'
    ? fillValue || null
    : selected

  // ============ 「下一個練習」推薦 ============
  // 完成練習後查詢系統推薦的下一個技能，讓使用者可直接開始下一個練習
  // 型別直接引用 Recommendation 聯集，呼叫端可對 type 做 exhaustive 判斷
  const [nextRec, setNextRec] = useState<Recommendation | null>(null)
  // 推薦是否已取得結果（成功或失敗皆算完成）。所有 setState 都放在 promise 回呼中，
  // 避免在 effect 主體內同步呼叫 setState（react-hooks/set-state-in-effect）。
  const [recResolved, setRecResolved] = useState(false)

  const isFinished =
    index >= questions.length ||
    (lastResult?.finished && index === questions.length - 1)

  // loading 改為「衍生值」：練習完成但推薦結果尚未取得時顯示載入骨架
  const recLoading = isFinished && !recResolved

  useEffect(() => {
    if (!isFinished || recResolved) return
    let cancelled = false
    getNextPractice(childId)
      .then((rec) => {
        if (!cancelled) setNextRec(rec)
      })
      .catch(() => {
        if (!cancelled) setNextRec(null)
      })
      .finally(() => {
        if (!cancelled) setRecResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [isFinished, childId, recResolved])

  // 每題切換時自動聚焦：選擇題聚焦第一個選項，輸入題聚焦 NumberPad 內部的 input
  useEffect(() => {
    // 選擇題：聚焦第一個選項
    if (interaction === 'choice' && firstOptionRef.current) {
      firstOptionRef.current.focus()
      return
    }
    // 填答題 / 數字線：由對應元件內部自行聚焦
    // 使用 requestAnimationFrame 與瀏覽器繪製同步（比 setTimeout(100) 更快且無感知延遲）
    const raf = requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>('[data-autofocus-next]')
      input?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [index, interaction])

  useEffect(() => {
    if (index >= questions.length && completionLinkRef.current) {
      completionLinkRef.current.focus()
    }
  }, [index, questions.length])

  // 練習計時器：每 2 秒更新一次（原 1 秒），減少 re-render 頻率
  // 注意：練習完成後（finalTotalMs 已固定）就停止計時，避免完成頁每秒重渲染浪費 CPU/電力
  useEffect(() => {
    if (finalTotalMs !== null) return // 練習已結束，不再啟動計時器
    const interval = setInterval(() => {
      const sec = Math.floor((Date.now() - practiceStartRef.current) / 1000)
      const m = String(Math.floor(sec / 60)).padStart(2, '0')
      const s = String(sec % 60).padStart(2, '0')
      setElapsed(`${m}:${s}`)
    }, 2000) // 改為 2 秒更新一次，減少一半 re-render
    return () => clearInterval(interval)
  }, [finalTotalMs])

  // 答題後自動捲動到「回饋 + 下一題」區塊
  // 使用 requestAnimationFrame 替代 setTimeout，跟瀏覽器繪製同步
  useEffect(() => {
    if (!lastResult) return
    const el = feedbackRef.current
    if (!el) return
    const smooth = !document.documentElement.classList.contains('reduce-motion')
    const raf = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' })
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf)
  }, [lastResult])

  // 使用 useRef 保存最新值，避免全局 keydown 監聽器因依賴變更而反覆註冊/卸載
  const lastResultRef = useRef(lastResult)
  const currentAnswerRef = useRef(currentAnswer)
  const submittingRef_forListener = useRef(submitting)
  const indexRef = useRef(index)
  const questionsLenRef = useRef(questions.length)
  const nextQuestionRef = useRef<() => void>(() => {})
  const handleSubmitRef = useRef<() => Promise<void>>(async () => {})

  function handleKeyDown(e: React.KeyboardEvent) {
    // 中文輸入法（IME）組字中不攔截按鍵（Enter 是確認候選字）
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter') {
      e.preventDefault()
      // 練習已完成時不再處理 Enter（避免完成頁按 Enter 重複觸發導致跳轉）
      if (questions.length === 0 || index >= questions.length) return
      if (lastResultRef.current?.finished) return
      if (lastResultRef.current) {
        nextQuestionRef.current()
      } else if (currentAnswerRef.current) {
        // 鎖由 handleSubmit 內部統一管理（入口同步設 ref、finally 釋放）。
        // 不可在此提前設 submittingRef.current=true，否則 handleSubmit 第一行
        // if(submittingRef.current) return 會立即拒絕，鎖永遠不釋放 → 卡死。
        handleSubmitRef.current()
      }
      return
    }
    // 已答題時不處理數字鍵選擇
    if (lastResultRef.current) return
    if (interaction === 'choice' && current.options && e.key >= '1' && e.key <= '4') {
      const optIndex = Number(e.key) - 1
      if (optIndex < current.options.length) {
        choose(current.options[optIndex])
      }
    }
  }

  // 全局 Enter 監聽：使用 ref 讀取最新狀態，只在 mount/unmount 時註冊一次
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return
      // 若焦點在輸入框（如 NumberPad 文字模式），不攔截（輸入框自行處理）
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
      // IME 組字中不攔截
      if (e.isComposing || e.keyCode === 229) return
      if (submittingRef.current || submittingRef_forListener.current) return
      // 練習已完成時不再處理 Enter（避免完成頁上意外觸發跳轉）
      if (indexRef.current >= questionsLenRef.current) return
      if (lastResultRef.current?.finished) return
      if (lastResultRef.current) {
        e.preventDefault()
        nextQuestionRef.current()
      } else if (currentAnswerRef.current) {
        e.preventDefault()
        // 鎖由 handleSubmit 內部統一管理（見 handleKeyDown 的說明）
        handleSubmitRef.current()
      }
    }
    window.addEventListener('keydown', onGlobalKey)
    return () => window.removeEventListener('keydown', onGlobalKey)
  }, []) // 空依賴：只在 mount/unmount 時註冊一次，透過 ref 讀取最新狀態

  function choose(val: string) {
    if (submitting || lastResult) return
    setSelected(val)
  }

  async function handleSubmit() {
    // 統一同步防重入鎖：Enter 事件冒泡鏈（input onKeyDown → 外層 div handleKeyDown →
    // window onGlobalKey）可能讓同一答案走進來多次。submitting 是 state（非同步更新），
    // 第二次呼叫時仍為 false，會導致同一題 submitAnswer 兩次 → 產生重複 Attempt、
    // correctCount 重複計數、練習提前 finished。改用 ref 同步鎖在入口一律擋住。
    if (submittingRef.current) return
    if (!currentAnswer || submitting) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    const durationMs = Date.now() - startTimeRef.current

    try {
      const result = await submitAnswer({
        sessionId,
        questionIndex: index,
        userAnswer: currentAnswer,
        assisted,
        durationMs,
      })

      setLastResult(result)
      if (result.correct && !assisted) setCorrectCount((c) => c + 1)

      // 多設備情境：另一裝置已完成此練習 → 不顯示答錯動畫，直接跳完成頁
      const alreadyFinished = result.finished && !result.correct && result.correctAnswer === ''
      if (alreadyFinished) {
        setRemoteFinished(true)
        setFinalTotalMs(Date.now() - practiceStartRef.current)
        return
      }

      // 動畫回饋
      setQuestionResults((prev) => {
        const next = [...prev]
        next[index] = {
          correct: result.correct,
          assisted,
          correctAnswer: result.correctAnswer,
          userAnswer: currentAnswer,
        }
        return next
      })
      setFeedback(result.correct ? 'correct' : 'incorrect')
      setBgFlash(result.correct ? 'green' : 'red')
      if (!result.correct) {
        setTimeout(() => setRevealCorrect(true), 200)
      }
      setTimeout(() => setBgFlash(null), 150)
      if (result.finished) {
        setFinalTotalMs(Date.now() - practiceStartRef.current)
      }
    } catch {
      setError('送出失敗，請再試一次')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }
  function nextQuestion() {
    setSelected(null)
    setFillValue('')
    setLineValue(null)
    setLastResult(null)
    setAssisted(false)
    setShowHint(false)
    setFeedback(null)
    setRevealCorrect(false)
    setBgFlash(null)
    startTimeRef.current = Date.now()
    setIndex((i) => i + 1)
  }

  // 同步最新狀態到 ref，供「只在 mount 時註冊一次」的全域 keydown 監聽器讀取。
  // 必須在 effect 中寫 ref（而非 render 期間），符合 React 19「不可在 render 中改 ref」的規則。
  // 此 effect 不含依賴陣列，每次 render 後都會執行以保持 ref 為最新值。
  useEffect(() => {
    lastResultRef.current = lastResult
    currentAnswerRef.current = currentAnswer
    submittingRef_forListener.current = submitting
    indexRef.current = index
    questionsLenRef.current = questions.length
    handleSubmitRef.current = handleSubmit
    nextQuestionRef.current = nextQuestion
  })

  if (index >= questions.length || (lastResult?.finished && index === questions.length - 1)) {
    // 多設備情境：另一裝置已完成了此練習，顯示專用提示
    if (remoteFinished) {
      return (
        <div className="flex flex-col items-center gap-4 text-center" role="region" aria-label="練習已在其他裝置完成">
          <div className="text-6xl">📱</div>
          <h2 className="text-2xl font-bold">{childNickname} 的這個練習</h2>
          <p className="text-lg text-neutral-600 dark:text-gray-300">
            已在其他裝置完成囉！
          </p>
          <p className="text-sm text-neutral-500 dark:text-gray-400">
            請回到選單開始新的練習
          </p>
          <a
            ref={completionLinkRef as React.RefObject<HTMLAnchorElement>}
            href={`/practice/${childId}`}
            className="mt-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            返回練習選單
          </a>
        </div>
      )
    }

    const starsEarned = correctCount
    // P2-4：正確率分母用 gradedQuestionCount（排除 assisted 題），不把家長協助題當成錯題
    const gradedQuestionCount = questionResults.filter((r) => r && !r.assisted).length
    const assistedCount = questionResults.filter((r) => r && r.assisted).length
    const accuracy = gradedQuestionCount > 0
      ? Math.round((correctCount / gradedQuestionCount) * 100)
      : Math.round((correctCount / questions.length) * 100)
    const encouragement = getEncouragement(accuracy)
    // totalTime 取自 finalTotalMs（練習完成時已於 handleSubmit / remoteFinished 路徑寫入）。
    // 不在 render 中呼叫 Date.now() 或讀 ref，符合純粹性規則。
    const totalTime = finalTotalMs ?? 0

    return (
      <div className="relative">
        {/* 星星慶祝全螢幕覆蓋層 */}
        {starsEarned > 0 && showCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-overlay-fade-in" style={{ background: 'rgba(0,0,0,0.65)' }}>
            {/* 紙屑粒子 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {CONFETTI_PARTICLES.map((p, i) => (
                <div
                  key={i}
                  className="absolute animate-confetti-fall"
                  style={{
                    left: `${p.x}%`,
                    top: '-5%',
                    animationDelay: `${p.delay}s`,
                    animationDuration: `${p.duration}s`,
                    color: p.color,
                    fontSize: `${p.size * 1.8}rem`,
                  }}
                >
                  <Icon name={p.shape as IconName} style={{ width: '1em', height: '1em' }} />
                </div>
              ))}
            </div>

            {/* 中央慶祝內容 */}
            <div className="relative z-10 mx-4 flex flex-col items-center gap-4">
              {/* 大星星彈出 */}
              <div className="flex justify-center gap-3">
                {Array.from({ length: Math.min(starsEarned, 5) }).map((_, i) => (
                  <span
                    key={i}
                    className="animate-star-drop text-amber-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"
                    style={{ animationDelay: `${i * 0.2}s`, fontSize: `${4 - i * 0.3}rem` }}
                  >
                    <Icon name="star" style={{ width: '1em', height: '1em' }} />
                  </span>
                ))}
              </div>

              {/* 星星數量文字 */}
              <p className="animate-bounce-in text-4xl font-extrabold text-white drop-shadow-lg" style={{ animationDelay: '0.6s' }}>
                獲得 <span className="text-amber-400">{starsEarned}</span> 顆星星！
              </p>

              {/* 鼓勵語 */}
              <p className="animate-float-up flex items-center gap-2 text-xl font-medium text-white/90" style={{ animationDelay: '0.8s' }}>
                <Icon name={encouragement.icon} className="h-6 w-6" /> {encouragement.msg}
              </p>

              {/* 關閉按鈕 */}
              <button
                type="button"
                onClick={() => setShowCelebration(false)}
                className="animate-float-up mt-2 rounded-xl bg-white/20 px-8 py-3 text-lg font-semibold text-white backdrop-blur transition hover:bg-white/30 active:scale-95"
                style={{ animationDelay: '1s' }}
              >
                查看結果 ✨
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-6 text-center" role="region" aria-label="練習完成">
        <div className="flex justify-center text-indigo-500 dark:text-indigo-400"><Icon name={encouragement.icon} className="h-20 w-20" /></div>
        <h2 className="text-2xl font-bold">{childNickname} 完成了！</h2>
        <p className="flex items-center justify-center gap-1.5 text-lg font-medium text-indigo-600 dark:text-indigo-400">
          <Icon name={encouragement.icon} className="h-5 w-5" /> {encouragement.msg}
        </p>

        {/* 答對題數 + 總花費時間 */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          <p className="text-lg text-neutral-700 dark:text-gray-200">
            獨立作答 <span className="font-bold text-green-600 dark:text-green-400">{correctCount}</span> / {gradedQuestionCount || questions.length} 題
          </p>
          {assistedCount > 0 && (
            <p className="text-lg text-neutral-700 dark:text-gray-200">
              家長協助 <span className="font-bold text-amber-600 dark:text-amber-400">{assistedCount}</span> 題
            </p>
          )}
          <p className="text-lg text-neutral-700 dark:text-gray-200">
            共花費 <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-600 dark:text-blue-400"><Icon name="stopwatch" className="h-5 w-5" /> {formatDuration(totalTime)}</span>
          </p>
        </div>

        {/* 正確率進度條 */}
        <div className="w-full max-w-md">
          <div className="mb-1 flex justify-between text-sm font-semibold text-neutral-700 dark:text-gray-200">
            <span>正確率</span>
            <span className="font-bold text-green-600 dark:text-green-400">{accuracy}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-neutral-300 dark:bg-gray-600" role="progressbar" aria-valuenow={accuracy} aria-valuemin={0} aria-valuemax={100} aria-label={"正確率 " + accuracy + "%"}>
            <div
              className="h-3 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
              style={{ width: accuracy + '%' }}
            />
          </div>
        </div>

        {/* 升學測試結果 */}
        {lastResult?.promotion && (
          <div className={`w-full max-w-md rounded-2xl p-5 text-center shadow-lg ${
            lastResult.promotion.qualify
              ? 'bg-gradient-to-r from-yellow-300 to-orange-400 text-white'
              : 'border border-neutral-200 bg-white dark:border-gray-700 dark:bg-gray-900'
          }`}>
            {lastResult.promotion.qualify ? (
              <>
                <div className="mb-1 flex justify-center"><Icon name="party" className="h-10 w-10" /></div>
                <h3 className="text-lg font-bold">升學測試通過！</h3>
                <p className="mt-1 text-sm opacity-90">
                  已達到 {lastResult.promotion.targetGrade} 的升學門檻，點擊下方按鈕升級！
                </p>

                {/* 手動確認升級按鈕 */}
                {!lastResult.promotion.confirmed && (
                  <form
                    action={async () => {
                      if (!lastResult.promotion?.targetGrade) return
                      await confirmPromotion(childId, lastResult.promotion.targetGrade)
                    }}
                    className="mt-4"
                  >
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/25 px-6 py-3 text-base font-bold backdrop-blur transition hover:bg-white/40 active:scale-95"
                    >
                      <Icon name="rocket" className="h-5 w-5" />
                      確認升級至 {lastResult.promotion.targetGrade} 🚀
                    </button>
                  </form>
                )}

                {lastResult.promotion.confirmed && (
                  <p className="mt-2 flex items-center justify-center gap-1 text-sm opacity-90">
                    <Icon name="check-circle" className="h-4 w-4" />
                    已晉升至 {lastResult.promotion.newGrade}！
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="mb-1 flex justify-center text-neutral-400 dark:text-gray-400"><Icon name="target" className="h-10 w-10" /></div>
                <h3 className="text-lg font-bold text-neutral-800 dark:text-white">升學測試未通過</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
                  正確率需達 80% 才能升學至 {lastResult.promotion.targetGrade}，再練熟一些後重新挑戰！
                </p>
              </>
            )}
          </div>
        )}

        {/* 每題結果一覽 */}
        <div className="w-full max-w-md">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-gray-200">每題結果一覽</h3>
          <ol className="flex flex-col gap-1.5">
            {questions.map((q, i) => {
              const r = questionResults[i]
              let icon: IconName = 'circle'
              let label = '未作答'
              let cls = 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
              let detail: string | null = null
              if (r) {
                if (r.assisted) {
                  icon = 'help-circle'
                  label = '家長協助'
                  cls = 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  detail = '答案：' + displayAnswer(r.correctAnswer)
                } else if (r.correct) {
                  icon = 'check-circle'
                  label = '答對'
                  cls = 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                } else {
                  icon = 'x'
                  label = '答錯'
                  cls = 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
                  detail = '正確答案：' + displayAnswer(r.correctAnswer)
                }
              }
              return (
                <li key={i} className={"flex items-center justify-between rounded-lg border px-3 py-2 text-sm " + cls}>
                  <span className="flex items-center gap-2">
                    <Icon name={icon} className="h-4 w-4 shrink-0" />
                    <span className="text-neutral-700 dark:text-gray-200">第 {i + 1} 題</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {detail && <span className="text-xs opacity-70">{detail}</span>}
                    <span className="font-medium">{label}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        {/* 下一個練習（推薦）— 完成後的主操作，可直接開始新練習不必退回選單 */}
        <div className="flex w-full max-w-md flex-col items-center gap-2">
          {recLoading ? (
            <div className="h-[52px] w-full animate-pulse rounded-lg bg-neutral-200 dark:bg-gray-700" />
          ) : nextRec?.skillId ? (
            <>
              <form action={startNextPractice.bind(null, childId)} className="w-full">
                <button
                  type="submit"
                  className="min-h-[52px] w-full rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-blue-700"
                >
                  開始下一個練習 → {nextRec.skillName}
                </button>
              </form>
              <p className="flex items-start gap-1.5 text-sm text-neutral-500 dark:text-gray-400"><Icon name="lightbulb" className="mt-0.5 h-4 w-4 shrink-0" />{nextRec.reason}</p>
            </>
          ) : nextRec?.type === 'ALL_DONE' ? (
            <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950">
              <p className="font-semibold text-amber-700 dark:text-amber-300"><Icon name="party" className="mr-1 inline-block h-4 w-4 align-text-bottom" /> 目前所有技能都已掌握！</p>
            </div>
          ) : (
            <form action={startNextPractice.bind(null, childId)} className="w-full">
              <button
                type="submit"
                className="min-h-[52px] w-full rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700"
              >
                開始下一個練習 →
              </button>
            </form>
          )}
        </div>

        {/* 次要操作：再練一次（同技能）/ 查看概覽 / 錯題本 */}
        <div className="flex flex-wrap justify-center gap-3">
          <form action={startSession.bind(null, childId, skillId)}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            >
              <Icon name="refresh" className="mr-1 inline-block h-4 w-4 align-text-bottom" />再練一次（{skillName}）
            </button>
          </form>
          <a
            href={"/children/" + childId}
            className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
          >
            選擇其他技能
          </a>
          {/* 錯題本連結：只有有錯題時才顯示 */}
          {questionResults.some((r) => r && !r.correct && !r.assisted) && (
            <a
              href={"/children/" + childId + "/review"}
              className="rounded-lg border border-red-200 px-5 py-2.5 font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              <Icon name="note" className="mr-1 inline-block h-4 w-4 align-text-bottom" />查看錯題本
            </a>
          )}
          <a
            href={"/children/" + childId}
            className="rounded-lg px-5 py-2.5 font-medium text-neutral-500 transition hover:text-neutral-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            查看學習概覽
          </a>
        </div>

        <style>{`
          @keyframes starDrop {
            0% { opacity: 0; transform: translateY(-30px) scale(0.3) rotate(0deg); }
            60% { opacity: 1; transform: translateY(5px) scale(1.2) rotate(15deg); }
            100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
          }
        `}</style>
      </div>
    </div>
    )
  }

  const submitDisabled = !currentAnswer || submitting

  const bgFlashClass =
    bgFlash === 'green' ? 'animate-flash-green' : bgFlash === 'red' ? 'animate-flash-red' : ''

  return (
    <div className={"flex w-full flex-col gap-6 outline-none " + bgFlashClass} onKeyDown={handleKeyDown} tabIndex={0}>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-gray-200 sm:text-sm">
          <span className="truncate pr-2">{skillName}</span>
          <span className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1 font-mono"><Icon name="stopwatch" className="h-3.5 w-3.5" /> {elapsed}</span>
            <span>{index + 1} / {totalQuestions}</span>
            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              aria-label="結束練習"
            >
              <span className="inline-flex items-center gap-0.5">
                <Icon name="x" className="h-3 w-3" /> 結束
              </span>
            </button>
          </span>
        </div>
        <div className="mb-1 flex justify-end text-xs font-bold text-indigo-600 dark:text-indigo-400">
          {progress}%
        </div>
        <div
          className="h-2.5 w-full rounded-full bg-neutral-300 dark:bg-gray-600"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
          aria-valuetext={"第 " + (index + 1) + " 題，共 " + totalQuestions + " 題"}
          aria-label={"練習進度：第 " + (index + 1) + " 題，共 " + totalQuestions + " 題"}
        >
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-200"
            style={{ width: progress + "%" }}
          />
        </div>

        {/* 進度圓點狀態指示器 */}
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {questions.map((_, i) => {
            let dotCls = 'h-3 w-3 rounded-full border-2 border-neutral-400 bg-transparent dark:border-gray-500'
            let icon: IconName | null = null
            if (i < questionResults.length) {
              const r = questionResults[i]
              if (r.assisted) {
                dotCls = 'flex h-3 w-3 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-400 text-white'
              } else if (r.correct) {
                dotCls = 'flex h-3 w-3 items-center justify-center rounded-full border-2 border-green-500 bg-green-500 text-white'
                icon = 'check'
              } else {
                dotCls = 'flex h-3 w-3 items-center justify-center rounded-full border-2 border-red-400 bg-red-400 text-white'
                icon = 'x'
              }
            } else if (i === index) {
              dotCls = 'h-3 w-3 rounded-full border-2 border-blue-500 bg-blue-500 animate-pulse-dot'
            }
            return (
              <span key={i} className={dotCls}>{icon && <Icon name={icon} className="h-2 w-2" />}</span>
            )
          })}
        </div>
      </div>

      <div
        className="rounded-2xl border-2 border-neutral-200 bg-white p-8 text-center shadow-lg ring-1 ring-black/5 dark:border-gray-600 dark:bg-gray-900 dark:ring-white/10"
        role="region"
        aria-label={"題目 " + (index + 1)}
      >
        {/* 題幹：解析 [shape:xxx] 標記或舊符號，渲染成彩色 SVG 圖形 */}
        <p className="text-3xl font-bold tracking-wide leading-relaxed text-gray-900 dark:text-white">
          {renderTextWithShapes(current.prompt, 'lg')}
        </p>
      </div>

      {/* 💡 提示按鈕 — 作答前可預先查看解題提示 */}
      {current.explanation && !lastResult && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 transition hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            <span className="text-base">{showHint ? '隱藏提示' : '顯示提示'}</span>
            <Icon name={showHint ? 'chevron-down' : 'lightbulb'} className="h-4 w-4" />
            {showHint ? '隱藏提示' : '顯示提示'}
          </button>
          {showHint && (
            <div className="mx-auto mt-2 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800 animate-fade-in-up dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <span className="inline-flex items-start gap-1.5 align-top"><Icon name="lightbulb" className="mt-0.5 h-4 w-4 shrink-0" />{renderTextWithShapes(current.explanation ?? '', 'sm')}</span>
            </div>
          )}
        </div>
      )}

      {interaction === 'choice' && current.options ? (
        <div className="grid grid-cols-2 gap-4">
          {current.options.map((opt, optIdx) => {
            let cls = 'border-2 border-neutral-300 bg-white shadow-sm hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:border-blue-400 dark:hover:bg-gray-800 transition-all duration-150'
            if (selected === opt) cls = 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
            if (lastResult && feedback) {
              // 用 server 回傳的 lastResult.correctAnswer 來判斷哪個選項是正確的，
              // 不使用題目本身的 answer（答案不會送到 client，P0-2）。
              const correctAnswer = lastResult.correctAnswer
              if (feedback === 'correct' && selected === opt) {
                cls = 'border-green-500 bg-green-100 animate-pop animate-ripple dark:border-green-600 dark:bg-green-950'
              } else if (feedback === 'incorrect') {
                if (selected === opt) {
                  cls = 'border-red-400 bg-red-100 animate-shake dark:border-red-800 dark:bg-red-950'
                } else if (opt === correctAnswer && revealCorrect) {
                  cls = 'border-green-500 bg-green-50 animate-fade-in-up dark:border-green-600 dark:bg-green-950'
                } else {
                  cls = 'border-neutral-200 bg-white opacity-60 dark:border-gray-700 dark:bg-gray-900'
                }
              } else if (feedback === 'correct') {
                if (opt === correctAnswer) {
                  cls = 'border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-950'
                } else {
                  cls = 'border-neutral-200 bg-white opacity-60 dark:border-gray-700 dark:bg-gray-900'
                }
              }
            }
            const showCheck = lastResult && feedback === 'correct' && selected === opt
            const showCross = lastResult && feedback === 'incorrect' && selected === opt
            // 選項是否為單一圖形（正方形/圓形…）→ 用大圖形顯示而非文字
            const isShapeOpt = isShapeName(opt)
            return (
              <button
                key={"opt-" + optIdx}
                ref={optIdx === 0 ? firstOptionRef : undefined}
                onClick={() => choose(opt)}
                disabled={!!lastResult || submitting}
                aria-pressed={selected === opt}
                aria-keyshortcuts={"" + (optIdx + 1)}
                className={"relative rounded-xl border-2 px-4 py-5 text-2xl font-bold transition min-h-[72px] " + cls}
              >
                {/* 數字鍵提示：圖形選項時固定在左上角，文字選項時跟在後面 */}
                {!lastResult && isShapeOpt && (
                  <span className="absolute left-2 top-2 rounded-full bg-neutral-200/80 px-1.5 text-xs font-medium text-neutral-600 dark:bg-gray-700 dark:text-gray-300">{optIdx + 1}</span>
                )}
                <span className="inline-flex items-center gap-2">
                  {isShapeOpt ? renderOption(opt, 'lg') : displayAnswer(opt)}
                  {!lastResult && !isShapeOpt && (
                    <span className="text-xs font-medium text-neutral-500 dark:text-gray-400">({optIdx + 1})</span>
                  )}
                  {showCheck && <Icon name="check" aria-hidden="true" className="h-5 w-5" />}
                  {showCross && <Icon name="x" aria-hidden="true" className="h-5 w-5" />}
                </span>
              </button>
            )
          })}
        </div>
      ) : interaction === 'numberline' ? (
        <NumberLine
          min={current.rangeMin ?? 0}
          max={current.rangeMax ?? 10}
          value={lineValue}
          onChange={setLineValue}
          disabled={!!lastResult}
        />
      ) : interaction === 'fillin' ? (
        <NumberPad
          value={fillValue}
          onChange={setFillValue}
          onSubmit={handleSubmit}
          disabled={!!lastResult}
          index={index}
          // 自動判斷輸入模式：inputMode 由 server 端根據答案決定後送出，
          // client 端不再檢查答案內容（答案不會送到 client，P0-2）。
          // - inputMode='text' → 文字模式（鍵盤輸入中文/英文）
          // - inputMode='numeric' 或未設定 → 數字鍵盤（預設）
          mode={current.inputMode === 'text' ? 'text' : 'numeric'}
          maxLength={current.maxLength}
          placeholder={current.placeholder}
        />
      ) : null}

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">
          {error}
        </div>
      )}

      {/* 答題回饋 + 下一題操作區：包在同一個容器，答題後自動滾動至此區塊 */}
      <div ref={feedbackRef} className="flex flex-col gap-3">
        {lastResult && (
          <div
            className={"animate-fade-in-up rounded-xl p-4 text-center " + (lastResult.correct ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300')}
            role="alert"
          >
            <p className="flex items-center justify-center gap-1.5 text-lg font-bold">
              {lastResult.correct
                ? <><Icon name="check" className="h-5 w-5" /> 答對了！</>
                : <><Icon name="x" className="h-5 w-5" /> 正確答案是 {displayAnswer(lastResult.correctAnswer)}</>}
            </p>
            {lastResult.explanation && (
              <p className="mt-2 flex items-start gap-1.5 text-sm opacity-80"><Icon name="lightbulb" className="mt-0.5 h-4 w-4 shrink-0" />{renderTextWithShapes(lastResult.explanation, 'sm')}</p>
            )}
          </div>
        )}

        {interaction !== 'fillin' && (
          <label className="flex items-center justify-center gap-2 text-sm font-medium text-neutral-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={assisted}
              onChange={(e) => setAssisted(e.target.checked)}
              disabled={!!lastResult}
            />
            這題有家長協助（不計入能力判斷）
          </label>
        )}

        <div className="flex justify-center">
          {!lastResult ? (
            interaction !== 'fillin' ? (
              <button
                onClick={handleSubmit}
                disabled={submitDisabled}
                aria-label="送出答案"
                className="min-h-[52px] w-full rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-40 sm:w-auto"
              >
                {submitting ? '送出中…' : '送出答案'}
              </button>
            ) : null
          ) : (
            <button
              onClick={nextQuestion}
              aria-label="下一題"
              className="min-h-[52px] w-full rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition hover:bg-blue-700 sm:w-auto"
            >
              下一題 →
            </button>
          )}
        </div>
      </div>

      {/* 中途結束練習確認 */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExitConfirm(false)
          }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="mb-2 flex justify-center text-neutral-400 dark:text-gray-400"><Icon name="help-circle" className="h-10 w-10" /></div>
            <h3 className="mb-1 text-center text-lg font-semibold dark:text-white">要結束練習嗎？</h3>
            <p className="mb-4 text-center text-sm text-neutral-500 dark:text-gray-400">
              目前做到第 {index + 1} / {totalQuestions} 題，<br />已完成 {questionResults.length} 題的紀錄會保留。
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={`/practice/${childId}`}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-red-700"
              >
                確定結束
              </a>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="rounded-lg border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
              >
                繼續練習
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
