'use client'

import { useState } from 'react'
import { deleteQuestion } from '@/actions/admin'
import Modal from './modal'
import QuestionForm from './question-form'
import QuestionPreview from './question-preview'

type QuestionData = {
  id: string
  skillId: string
  type: string
  prompt: string
  answer: string
  options: string | null
  paramsJson: string | null
  explanation: string | null
}

type Props = {
  question: QuestionData
  skills: { id: string; name: string }[]
}

export default function QuestionActions({ question, skills }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('id', question.id)
      await deleteQuestion(formData)
      setDeleteOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '刪除失敗')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <QuestionPreview question={question} />

      <button
        onClick={() => setEditOpen(true)}
        className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
      >
        ✏️ 編輯
      </button>

      <button
        onClick={() => setDeleteOpen(true)}
        className="rounded px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
      >
        🗑️ 刪除
      </button>

      {/* 編輯 Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="編輯題目" maxWidth="max-w-lg">
        <QuestionForm
          mode="edit"
          skills={skills}
          question={question}
          onDone={() => setEditOpen(false)}
        />
      </Modal>

      {/* 刪除確認 Modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="確認刪除" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            確定要刪除這道題目嗎？
          </p>
          <div className="rounded-lg bg-neutral-50 p-3 text-sm">
            <p className="truncate font-medium">{question.prompt}</p>
            <p className="mt-1 text-xs text-neutral-400">答案：{question.answer}</p>
          </div>
          <p className="text-xs text-neutral-400">
            若有關聯作答紀錄，將改為「停用」而非真正刪除，以保護歷史資料完整性。
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              {deleting ? '刪除中…' : '確認刪除'}
            </button>
            <button
              onClick={() => setDeleteOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              取消
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
