'use client'

import { useState, useRef, useEffect } from 'react'
import { submitAnswer, type SubmitResult } from '@/actions/practice'
import NumberPad from './number-pad'
import NumberLine from './number-line'

type QuestionItem = {
  templateId: string
  prompt: string
  answer: string
  options?: string[]
  explanation?: string
  interaction?: string
  rangeMin?: number
  rangeMax?: number
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

function getEncouragement(rate: number) {
  if (rate >= 100) return { emoji: '🏆', msg: '完美！全部答對！' }
  if (rate >= 80) return { emoji: '🌟', msg: '好厲害！繼續保持！' }
  if (rate >= 60) return { emoji: '💪', msg: '不錯喔！再加油！' }
  return { emoji: '🌱', msg: '沒關係，多練習就會了！' }
}

type Props = {
  questions: QuestionItem[]
  sessionId: string
  skillName: string
  childNickname: string
  childId: string
}

export default function PracticeClient({
  questions,
  sessionId,
  skillName,
  childNickname,
  childId,
}: Props) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [fillValue, setFillValue] = useState('')
  const [lineValue, setLineValue] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null)
  const [assisted, setAssisted] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [revealCorrect, setRevealCorrect] = useState(false)
  const [bgFlash, setBgFlash] = useState<'green' | 'red' | null>(null)
  const [elapsed, setElapsed] = useState('00:00')
  const [finalTotalMs, setFinalTotalMs] = useState<number | null>(null)
  const startTimeRef = useRef<number>(typeof window !== 'undefined' ? Date.now() : 0)
  const practiceStartRef = useRef<number>(typeof window !== 'undefined' ? Date.now() : 0)
  const firstOptionRef = useRef<HTMLButtonElement | null>(null)
  const completionLinkRef = useRef<HTMLAnchorElement | null>(null)
  const submittingRef = useRef(false)

  const current = questions[index]
  const progress = Math.round((index / questions.length) * 100)
  const totalQuestions = questions.length

  useEffect(() => {
    if (firstOptionRef.current) {
      firstOptionRef.current.focus()
    }
  }, [index])

  useEffect(() => {
    if (index >= questions.length && completionLinkRef.current) {
      completionLinkRef.current.focus()
    }
  }, [index, questions.length])

  // 練習計時器：每秒更新經過時間
  useEffect(() => {
    const interval = setInterval(() => {
      const sec = Math.floor((Date.now() - practiceStartRef.current) / 1000)
      const m = String(Math.floor(sec / 60)).padStart(2, '0')
      const s = String(sec % 60).padStart(2, '0')
      setElapsed(`${m}:${s}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const interaction = current.interaction || (!current.options || current.options.length === 0 ? 'fillin' : 'choice')

  const currentAnswer = interaction === 'numberline'
    ? lineValue !== null ? String(lineValue) : null
    : interaction === 'fillin'
    ? fillValue || null
    : selected

  function handleKeyDown(e: React.KeyboardEvent) {
    if (lastResult) return
    if (interaction === 'choice' && current.options && e.key >= '1' && e.key <= '4') {
      const optIndex = Number(e.key) - 1
      if (optIndex < current.options.length) {
        choose(current.options[optIndex])
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (submittingRef.current || submitting) return
      if (lastResult) {
        nextQuestion()
      } else if (currentAnswer) {
        submittingRef.current = true
        handleSubmit()
      }
    }
  }

  function choose(val: string) {
    if (submitting || lastResult) return
    setSelected(val)
  }

  async function handleSubmit() {
    if (!currentAnswer || submitting) return
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

      // 動畫回饋
      setQuestionResults((prev) => [
        ...prev,
        {
          correct: result.correct,
          assisted,
          correctAnswer: result.correctAnswer,
          userAnswer: currentAnswer,
        },
      ])
      setFeedback(result.correct ? 'correct' : 'incorrect')
      setBgFlash(result.correct ? 'green' : 'red')
      if (!result.correct) {
        setTimeout(() => setRevealCorrect(true), 500)
      }
      setTimeout(() => setBgFlash(null), 300)
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
    setFeedback(null)
    setRevealCorrect(false)
    setBgFlash(null)
    startTimeRef.current = Date.now()
    setIndex((i) => i + 1)
  }

  if (index >= questions.length || (lastResult?.finished && index === questions.length - 1)) {
    const starsEarned = correctCount
    const accuracy = Math.round((correctCount / questions.length) * 100)
    const encouragement = getEncouragement(accuracy)
    const totalTime = finalTotalMs != null ? finalTotalMs : Date.now() - practiceStartRef.current
    return (
      <div className="flex flex-col items-center gap-6 text-center" role="region" aria-label="練習完成">
        <div className="text-6xl">{encouragement.emoji}</div>
        <h2 className="text-2xl font-bold">{childNickname} 完成了！</h2>
        <p className="text-lg font-medium text-indigo-600">{encouragement.emoji} {encouragement.msg}</p>

        {/* 答對題數 + 總花費時間 */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          <p className="text-lg text-neutral-600">
            答對 <span className="font-bold text-green-600">{correctCount}</span> / {questions.length} 題
          </p>
          <p className="text-lg text-neutral-600">
            共花費 <span className="font-mono font-bold text-blue-600">⏱️ {formatDuration(totalTime)}</span>
          </p>
        </div>

        {/* 正確率進度條 */}
        <div className="w-full max-w-md">
          <div className="mb-1 flex justify-between text-sm text-neutral-500">
            <span>正確率</span>
            <span className="font-bold text-green-600">{accuracy}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-neutral-200" role="progressbar" aria-valuenow={accuracy} aria-valuemin={0} aria-valuemax={100} aria-label={"正確率 " + accuracy + "%"}>
            <div
              className="h-3 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700"
              style={{ width: accuracy + "%" }}
            />
          </div>
        </div>

        {/* 星星獎勵顯示 + 動畫灑落 */}
        {starsEarned > 0 && (
          <div className="stars-container my-2">
            <div className="flex flex-wrap justify-center gap-1" aria-label={`獲得 ${starsEarned} 顆星星`}>
              {Array.from({ length: starsEarned }).map((_, i) => (
                <span
                  key={i}
                  className="star-fall inline-block text-2xl"
                  style={{
                    animation: `starDrop 0.5s ease-out ${i * 0.15}s both`,
                    fontSize: `${1.5 + Math.random() * 1}rem`,
                  }}
                >
                  ⭐
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm font-medium text-amber-600">
              +{starsEarned} 顆星星 ⭐
            </p>
          </div>
        )}

        {/* 每題結果一覽 */}
        <div className="w-full max-w-md">
          <h3 className="mb-2 text-sm font-semibold text-neutral-500">每題結果一覽</h3>
          <ol className="flex flex-col gap-1.5">
            {questions.map((q, i) => {
              const r = questionResults[i]
              let icon = '○'
              let label = '未作答'
              let cls = 'border-neutral-200 bg-neutral-50 text-neutral-400'
              let detail: string | null = null
              if (r) {
                if (r.assisted) {
                  icon = '🤝'
                  label = '家長協助'
                  cls = 'border-amber-200 bg-amber-50 text-amber-700'
                  detail = '答案：' + r.correctAnswer
                } else if (r.correct) {
                  icon = '✅'
                  label = '答對'
                  cls = 'border-green-200 bg-green-50 text-green-700'
                } else {
                  icon = '❌'
                  label = '答錯'
                  cls = 'border-red-200 bg-red-50 text-red-700'
                  detail = '正確答案：' + r.correctAnswer
                }
              }
              return (
                <li key={i} className={"flex items-center justify-between rounded-lg border px-3 py-2 text-sm " + cls}>
                  <span className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className="text-neutral-500">第 {i + 1} 題</span>
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

        <div className="flex gap-3">
          <a
            ref={completionLinkRef}
            href={"/children/" + childId}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
          >
            查看學習概覽
          </a>
          <a
            href={"/practice/" + childId}
            className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium hover:bg-neutral-50"
          >
            再練一次
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
    )
  }

  const submitDisabled = !currentAnswer || submitting

  const bgFlashClass =
    bgFlash === 'green' ? 'animate-flash-green' : bgFlash === 'red' ? 'animate-flash-red' : ''

  return (
    <div className={"flex w-full flex-col gap-6 " + bgFlashClass} onKeyDown={handleKeyDown}>
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-neutral-500">
          <span>{skillName}</span>
          <span className="flex items-center gap-3">
            <span className="font-mono">⏱️ {elapsed}</span>
            <span>{index + 1} / {totalQuestions}</span>
          </span>
        </div>
        <div className="mb-1 flex justify-end text-xs font-medium text-indigo-500">
          {progress}%
        </div>
        <div
          className="h-2 w-full rounded-full bg-neutral-200"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
          aria-valuetext={"第 " + (index + 1) + " 題，共 " + totalQuestions + " 題"}
          aria-label={"練習進度：第 " + (index + 1) + " 題，共 " + totalQuestions + " 題"}
        >
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: progress + "%" }}
          />
        </div>

        {/* 進度圓點狀態指示器 */}
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {questions.map((_, i) => {
            let dotCls = 'h-3 w-3 rounded-full border-2 border-neutral-300 bg-transparent'
            let icon: string | null = null
            if (i < questionResults.length) {
              const r = questionResults[i]
              if (r.assisted) {
                dotCls = 'flex h-3 w-3 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-400 text-[8px] text-white'
              } else if (r.correct) {
                dotCls = 'flex h-3 w-3 items-center justify-center rounded-full border-2 border-green-500 bg-green-500 text-[8px] text-white'
                icon = '✓'
              } else {
                dotCls = 'flex h-3 w-3 items-center justify-center rounded-full border-2 border-red-400 bg-red-400 text-[8px] text-white'
                icon = '✗'
              }
            } else if (i === index) {
              dotCls = 'h-3 w-3 rounded-full border-2 border-blue-500 bg-blue-500 animate-pulse-dot'
            }
            return (
              <span key={i} className={dotCls}>{icon}</span>
            )
          })}
        </div>
      </div>

      <div
        className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm"
        role="region"
        aria-label={"題目 " + (index + 1)}
      >
        <p className="text-3xl font-bold tracking-wide">{current.prompt}</p>
      </div>

      {interaction === 'choice' && current.options ? (
        <div className="grid grid-cols-2 gap-3">
          {current.options.map((opt, optIdx) => {
            let cls = 'border-neutral-300 bg-white hover:border-blue-400'
            if (selected === opt) cls = 'border-blue-500 bg-blue-50'
            if (lastResult && feedback) {
              if (feedback === 'correct' && selected === opt) {
                cls = 'border-green-500 bg-green-100 animate-pop animate-ripple'
              } else if (feedback === 'incorrect') {
                if (selected === opt) {
                  cls = 'border-red-400 bg-red-100 animate-shake'
                } else if (opt === current.answer && revealCorrect) {
                  cls = 'border-green-500 bg-green-50 animate-fade-in-up'
                } else {
                  cls = 'border-neutral-200 bg-white opacity-60'
                }
              } else if (feedback === 'correct') {
                if (opt === current.answer) {
                  cls = 'border-green-500 bg-green-50'
                } else {
                  cls = 'border-neutral-200 bg-white opacity-60'
                }
              }
            }
            const showCheck = lastResult && feedback === 'correct' && selected === opt
            const showCross = lastResult && feedback === 'incorrect' && selected === opt
            return (
              <button
                key={"opt-" + optIdx}
                ref={optIdx === 0 ? firstOptionRef : undefined}
                onClick={() => choose(opt)}
                disabled={!!lastResult || submitting}
                aria-pressed={selected === opt}
                aria-keyshortcuts={"" + (optIdx + 1)}
                className={"rounded-xl border-2 px-4 py-5 text-2xl font-bold transition " + cls}
              >
                <span className="inline-flex items-center gap-2">
                  {opt}
                  {!lastResult && (
                    <span className="text-xs text-neutral-400">({optIdx + 1})</span>
                  )}
                  {showCheck && <span aria-hidden="true">✓</span>}
                  {showCross && <span aria-hidden="true">✗</span>}
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
        />
      ) : null}

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      {lastResult && (
        <div
          className={"animate-fade-in-up rounded-xl p-4 text-center " + (lastResult.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}
          role="alert"
        >
          <p className="text-lg font-bold">
            {lastResult.correct ? '✓ 答對了！' : '✗ 正確答案是 ' + lastResult.correctAnswer}
          </p>
          {lastResult.explanation && (
            <p className="mt-2 text-sm opacity-80">💡 {lastResult.explanation}</p>
          )}
        </div>
      )}

      {interaction !== 'fillin' && (
        <label className="flex items-center justify-center gap-2 text-sm text-neutral-500">
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
              className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              {submitting ? '送出中…' : '送出答案'}
            </button>
          ) : null
        ) : (
          <button
            onClick={nextQuestion}
            className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition hover:bg-blue-700"
          >
            下一題 →
          </button>
        )}
      </div>
    </div>
  )
}