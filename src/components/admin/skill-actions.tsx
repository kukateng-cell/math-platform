'use client'

import { useState } from 'react'
import { deleteSkill, moveSkillUp, moveSkillDown } from '@/actions/admin'
import Modal from './modal'
import SkillForm from './skill-form'

type SkillData = {
  id: string
  code: string
  name: string
  description: string | null
  gradeLevel: string
  order: number
  isActive: boolean
  prerequisiteId: string | null
  prerequisite: { id: string; name: string } | null
  _count: { questions: number }
  dependents: { id: string; name: string }[]
}

type Props = {
  skill: SkillData
  allSkills: { id: string; name: string }[]
  isFirst: boolean
  isLast: boolean
}

export default function SkillActions({ skill, allSkills, isFirst, isLast }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('id', skill.id)
      await deleteSkill(formData)
      setDeleteOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '刪除失敗')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {/* 排序按鈕 */}
      <div className="flex items-center gap-1">
        <form action={moveSkillUp}>
          <input type="hidden" name="id" value={skill.id} />
          <button
            type="submit"
            disabled={isFirst}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
            title="上移"
          >
            ⬆️
          </button>
        </form>
        <form action={moveSkillDown}>
          <input type="hidden" name="id" value={skill.id} />
          <button
            type="submit"
            disabled={isLast}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
            title="下移"
          >
            ⬇️
          </button>
        </form>
        <span className="w-6 text-center text-xs text-neutral-300">{skill.order}</span>
      </div>

      {/* 動作按鈕 */}
      <div className="flex items-center gap-1">
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
      </div>

      {/* 編輯 Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`編輯技能：${skill.name}`} maxWidth="max-w-lg">
        <SkillForm
          mode="edit"
          skills={allSkills}
          skill={{
            id: skill.id,
            name: skill.name,
            description: skill.description,
            gradeLevel: skill.gradeLevel,
            prerequisiteId: skill.prerequisiteId,
            order: skill.order,
          }}
          onDone={() => setEditOpen(false)}
        />
      </Modal>

      {/* 刪除確認 Modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="確認刪除" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">⚠️ 此操作無法復原！</p>
            <p className="mt-1">
              所有關聯的題目（{skill._count.questions} 題）、作答紀錄與掌握度快照將一併刪除。
            </p>
          </div>

          {skill.dependents.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <p className="font-medium">❗ 無法刪除</p>
              <p className="mt-1">
                以下技能以此為前置技能：{skill.dependents.map((d) => d.name).join('、')}
                <br />
                請先修改這些技能的前置關係再刪除。
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting || skill.dependents.length > 0}
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
    </>
  )
}
