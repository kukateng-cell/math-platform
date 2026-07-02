'use client'

import { useState } from 'react'
import { generateQuestion } from '@/lib/question'
import Modal from './modal'

type QuestionData = {
  id: string
  type: string
  prompt: string
  paramsJson: string | null
  answer: string
  options: string | null
  explanation: string | null
}

const TYPE_LABEL: Record<string, string> = {
  DIRECT: '直接題目',
  ADD: '參數化加法',
  SUB: '參數化減法',
}

export default function QuestionPreview({ question }: { question: QuestionData }) {
  const [open, setOpen] = useState(false)

  // 從 paramsJson 解析互動模式
  const interaction = (() => {
    if (!question.paramsJson) return undefined
    try {
      const p = JSON.parse(question.paramsJson)
      return p.interaction
    } catch { return undefined }
  })()
  const rangeMin = (() => {
    if (!question.paramsJson) return undefined
    try {
      const p = JSON.parse(question.paramsJson)
      return p.rangeMin
    } catch { return undefined }
  })()
  const rangeMax = (() => {
    if (!question.paramsJson) return undefined
    try {
      const p = JSON.parse(question.paramsJson)
      return p.rangeMax
    } catch { return undefined }
  })()

  // 先生成一次預覽實例保留（避免重開 modal 時閃爍），需要時 regenerate
  const [preview, setPreview] = useState(() => {
    if (question.type === 'DIRECT') {
      const options = question.options
        ? question.options.split(',').map((s) => s.trim())
        : undefined
      return { prompt: question.prompt, answer: question.answer, options }
    }
    return generateQuestion({
      id: question.id,
      type: question.type as 'ADD' | 'SUB',
      prompt: question.prompt,
      paramsJson: question.paramsJson,
      answer: question.answer,
      options: question.options,
    })
  })

  function regenerate() {
    if (question.type === 'DIRECT') return
    setPreview(
      generateQuestion({
        id: question.id,
        type: question.type as 'ADD' | 'SUB',
        prompt: question.prompt,
        paramsJson: question.paramsJson,
        answer: question.answer,
        options: question.options,
      })
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-gray-700"
      >
        👁️ 預覽
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="題目預覽" maxWidth="max-w-lg">
        <div className="flex flex-col gap-4">
          {/* 題型與互動模式標籤 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-gray-700 dark:text-gray-300">
              {TYPE_LABEL[question.type] ?? question.type}
            </span>
            {interaction && (
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                {interaction === 'numberline' ? '📏 數字線' : interaction === 'fillin' ? '🔢 填答鍵盤' : '👆 選擇題'}
              </span>
            )}
            {question.type !== 'DIRECT' && (
              <button
                onClick={regenerate}
                className="rounded px-2 py-0.5 text-xs text-blue-600 transition hover:bg-blue-50"
              >
                🔄 重新生成
              </button>
            )}
          </div>

          {/* 題目卡片（模擬學生端樣式） */}
          <div className="rounded-2xl border border-neutral-200 bg-blue-50/30 p-8 text-center">
            <p className="text-3xl font-bold tracking-wide">{preview.prompt}</p>
          </div>

          {/* 互動模式預覽 */}
          {interaction === 'numberline' ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 text-center text-sm text-neutral-500">📏 數字線模式預覽</p>
              <div className="relative mx-auto h-2 w-full max-w-sm rounded-full bg-neutral-200">
                <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-blue-500 bg-white shadow-md" />
              </div>
              <div className="mx-auto mt-2 flex max-w-sm justify-between px-0.5 text-xs text-neutral-400">
                <span>{rangeMin ?? 0}</span>
                <span>{rangeMax ?? 10}</span>
              </div>
              <p className="mt-4 text-center text-sm text-green-600 font-medium">
                正確答案：{preview.answer}
              </p>
            </div>
          ) : interaction === 'fillin' ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 text-center text-sm text-neutral-500">🔢 填答鍵盤模式預覽</p>
              <div className="mx-auto max-w-[160px] rounded-xl border-2 border-neutral-200 bg-neutral-50 p-4 text-center">
                <span className="text-2xl font-bold tracking-wider text-neutral-300 dark:text-gray-600">?</span>
              </div>
              <div className="mx-auto mt-3 grid max-w-[200px] grid-cols-3 gap-1.5 opacity-60">
                {[1,2,3,4,5,6,7,8,9].map((n) => (
                  <div key={n} className="rounded-lg border border-neutral-200 bg-white py-2 text-center text-sm font-bold text-neutral-400">
                    {n}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-sm text-green-600 font-medium">
                正確答案：{preview.answer}
              </p>
            </div>
          ) : preview.options && preview.options.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {preview.options.map((opt) => {
                const isAnswer = opt === preview.answer
                return (
                  <div
                    key={opt}
                    className={`rounded-xl border-2 px-4 py-4 text-center text-xl font-bold ${
                      isAnswer
                        ? 'border-green-500 bg-green-50'
                        : 'border-neutral-200 bg-white opacity-60'
                    }`}
                  >
                    {opt}
                    {isAnswer && (
                      <span className="ml-1 text-xs text-green-600">✓</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
              <span className="text-sm text-neutral-400">此題為填答題，正確答案：</span>
              <span className="ml-1 text-lg font-bold text-green-600">{preview.answer}</span>
            </div>
          )}

          {/* 解析 */}
          {question.explanation && (
            <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
              💡 {question.explanation}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
