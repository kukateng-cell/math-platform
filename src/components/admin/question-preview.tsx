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
        className="rounded px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100"
      >
        👁️ 預覽
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="題目預覽" maxWidth="max-w-lg">
        <div className="flex flex-col gap-4">
          {/* 題型標籤 */}
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {TYPE_LABEL[question.type] ?? question.type}
            </span>
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

          {/* 選項（模擬學生端排列） */}
          {preview.options && preview.options.length > 0 ? (
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
