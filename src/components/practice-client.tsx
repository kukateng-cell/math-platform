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
  const focusRef = useRef<HTMLDivElement>(null)

  const current = questions[index]
  const progress = Math.round((index / questions.length) * 100)

  // 判斷互動模式
  // 沒有選項且未指定互動模式 → 預設填答鍵盤
  const interaction = current.interaction || (!current.options || current.options.length === 0 ? 'fillin' : 'choice')

  // 取得當前作答值（依模式不同）
  const currentAnswer = interaction === 'numberline'
    ? lineValue !== null ? String(lineValue) : null
    : interaction === 'fillin'
    ? fillValue || null
    : selected

  // 自動聚焦
  useEffect(() => {
    focusRef.current?.focus()
  }, [index])

  // 鍵盤快捷鍵
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (submitting || lastResult) return

      if (interaction === 'choice' && current.options) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= current.options.length) {
          e.preventDefault()
          choose(current.options[num - 1])
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (lastResult) nextQuestion()
        else if (currentAnswer) handleSubmit()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [interaction, submitting, lastResult, currentAnswer, current])

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

  // 完成頁
  if (index >= questions.length || (lastResult?.finished && index === questions.length - 1)) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">{correctCount >= questions.length / 2 ? '🎉' : '💪'}</div>
        <h2 className="text-2xl font-bold">{childNickname} 完成了！</h2>
        <p className="text-lg text-neutral-600">
          答對 <span className="font-bold text-green-600">{correctCount}</span> / {questions.length} 題
        </p>
        <p className="text-sm text-neutral-400">
          正確率 {Math.round((correctCount / questions.length) * 100)}%
        </p>
        <div className="flex gap-3">
          <a
            href={`/children/${childId}`}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
          >
            查看學習概覽
          </a>
          <a
            href={`/practice/${childId}`}
            className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium hover:bg-neutral-50"
          >
            再練一次
          </a>
        </div>
      </div>
    )
  }

  const submitDisabled = !currentAnswer || submitting

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 進度條 */}
      <div>
        <div className="mb-1 flex justify-between text-sm text-neutral-500">
          <span>{skillName}</span>
          <span>{index + 1} / {questions.length}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-neutral-200">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 題目 */}
      <div ref={focusRef} tabIndex={-1} role="region" aria-label={`題目 ${index + 1}`} className="outline-none">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-3xl font-bold tracking-wide">{current.prompt}</p>
        </div>
      </div>

      {/* 互動區 — 依模式切換 */}
      {interaction === 'choice' && current.options ? (
        <div className="grid grid-cols-2 gap-3">
          {current.options.map((opt, oi) => {
            let cls = 'border-neutral-300 bg-white hover:border-blue-400'
            if (selected === opt) cls = 'border-blue-500 bg-blue-50'
            if (lastResult) {
              if (opt === current.answer) cls = 'border-green-500 bg-green-50'
              else if (selected === opt) cls = 'border-red-400 bg-red-50'
              else cls = 'border-neutral-200 bg-white opacity-60'
            }
            return (
              <button
                key={`opt-${oi}`}
                onClick={() => choose(opt)}
                disabled={!!lastResult || submitting}
                aria-pressed={selected === opt}
                className={`rounded-xl border-2 px-4 py-5 text-2xl font-bold transition ${cls}`}
              >
                {opt}
                {!lastResult && (
                  <span className="ml-2 text-xs text-neutral-400">({oi + 1})</span>
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

      {/* 錯誤提示 */}
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      {/* 回饋 */}
      {lastResult && (
        <div
          className={`rounded-xl p-4 text-center ${
            lastResult.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
          role="alert"
        >
          <p className="text-lg font-bold">
            {lastResult.correct ? '✓ 答對了！' : `✗ 正確答案是 ${lastResult.correctAnswer}`}
          </p>
          {lastResult.explanation && (
            <p className="mt-2 text-sm opacity-80">💡 {lastResult.explanation}</p>
          )}
        </div>
      )}

      {/* 陪伴模式 */}
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

      {/* 動作按鈕 */}
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
          ) : null /* fillin 模式用鍵盤的確認按鈕 */
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
