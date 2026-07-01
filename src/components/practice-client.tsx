'use client'

import { useState, useRef } from 'react'
import { submitAnswer, type SubmitResult } from '@/actions/practice'
import type { QuestionInstance } from '@/lib/question'

type Props = {
  questions: { templateId: string; prompt: string; answer: string; options?: string[] }[]
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
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null)
  const [assisted, setAssisted] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const current = questions[index]
  const progress = Math.round((index / questions.length) * 100)

  function choose(val: string) {
    if (submitting || lastResult) return
    setSelected(val)
  }

  async function handleSubmit() {
    if (!selected || submitting) return
    setSubmitting(true)
    setError(null)
    const durationMs = Date.now() - startTimeRef.current

    try {
      const result = await submitAnswer({
        sessionId,
        questionIndex: index,
        userAnswer: selected,
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
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 題目 */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-3xl font-bold tracking-wide">{current.prompt}</p>
      </div>

      {/* 選項 */}
      {current.options ? (
        <div className="grid grid-cols-2 gap-3">
          {current.options.map((opt) => {
            let cls = 'border-neutral-300 bg-white hover:border-blue-400'
            if (selected === opt) cls = 'border-blue-500 bg-blue-50'
            if (lastResult) {
              if (opt === current.answer) cls = 'border-green-500 bg-green-50'
              else if (selected === opt) cls = 'border-red-400 bg-red-50'
              else cls = 'border-neutral-200 bg-white opacity-60'
            }
            return (
              <button
                key={opt}
                onClick={() => choose(opt)}
                disabled={!!lastResult}
                className={`rounded-xl border-2 px-4 py-5 text-2xl font-bold transition ${cls}`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      ) : null}

      {/* 回饋 */}
      {lastResult && (
        <div
          className={`rounded-xl p-4 text-center ${
            lastResult.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {lastResult.correct ? '✓ 答對了！' : `✗ 正確答案是 ${lastResult.correctAnswer}`}
        </div>
      )}

      {/* 陪伴模式 */}
      <label className="flex items-center justify-center gap-2 text-sm text-neutral-500">
        <input
          type="checkbox"
          checked={assisted}
          onChange={(e) => setAssisted(e.target.checked)}
          disabled={!!lastResult}
        />
        這題有家長協助（不計入能力判斷）
      </label>

      {/* 動作按鈕 */}
      <div className="flex justify-center">
        {!lastResult ? (
          <button
            onClick={handleSubmit}
            disabled={!selected || submitting}
            className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
          >
            {submitting ? '送出中…' : '送出答案'}
          </button>
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
