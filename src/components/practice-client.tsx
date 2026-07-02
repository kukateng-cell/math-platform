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
  const startTimeRef = useRef<number>(typeof window !== 'undefined' ? Date.now() : 0)
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
    startTimeRef.current = Date.now()
    setIndex((i) => i + 1)
  }

  if (index >= questions.length || (lastResult?.finished && index === questions.length - 1)) {
    const starsEarned = correctCount
    return (
      <div className="flex flex-col items-center gap-6 text-center" role="region" aria-label="練習完成">
        <div className="text-6xl">{correctCount >= questions.length / 2 ? '🎉' : '💪'}</div>
        <h2 className="text-2xl font-bold">{childNickname} 完成了！</h2>
        <p className="text-lg text-neutral-600 dark:text-gray-300">
          答對 <span className="font-bold text-green-600">{correctCount}</span> / {questions.length} 題
        </p>
        <p className="text-sm text-neutral-400 dark:text-gray-500">
          正確率 {Math.round((correctCount / questions.length) * 100)}%
        </p>

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
            className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
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

  return (
    <div className="flex w-full flex-col gap-6" onKeyDown={handleKeyDown}>
      <div>
        <div className="mb-1 flex justify-between text-sm text-neutral-500 dark:text-gray-400">
          <span>{skillName}</span>
          <span>{index + 1} / {totalQuestions}</span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-neutral-200 dark:bg-gray-700"
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
      </div>

      <div
        className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900"
        role="region"
        aria-label={"題目 " + (index + 1)}
      >
        <p className="text-3xl font-bold tracking-wide">{current.prompt}</p>
      </div>

      {interaction === 'choice' && current.options ? (
        <div className="grid grid-cols-2 gap-3">
          {current.options.map((opt, optIdx) => {
            let cls = 'border-neutral-300 bg-white hover:border-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:border-blue-400'
            if (selected === opt) cls = 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
            if (lastResult) {
              if (opt === current.answer) cls = 'border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-950'
              else if (selected === opt) cls = 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950'
              else cls = 'border-neutral-200 bg-white opacity-60 dark:border-gray-700 dark:bg-gray-900'
            }
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
                {opt}
                {!lastResult && (
                  <span className="ml-2 text-xs text-neutral-400 dark:text-gray-500">({optIdx + 1})</span>
                )}
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
          className={"rounded-xl p-4 text-center " + (lastResult.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}
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
        <label className="flex items-center justify-center gap-2 text-sm text-neutral-500 dark:text-gray-400">
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