'use client'

import { useActionState } from 'react'
import { createSkill, updateSkill, type AdminFormState } from '@/actions/admin'

type BaseSkill = { id: string; name: string }

type Props =
  | { mode: 'create'; skills: BaseSkill[]; skill?: never; onDone?: () => void }
  | { mode: 'edit'; skills: BaseSkill[]; skill: { id: string; name: string; description: string | null; gradeLevel: string; prerequisiteId: string | null; order: number }; onDone: () => void }

export default function SkillForm(props: Props) {
  const { skills, mode } = props

  const actionFn = mode === 'create' ? createSkill : updateSkill
  const [state, action, pending] = useActionState<AdminFormState, FormData>(actionFn, undefined)

  // 成功後自動關閉編輯表單
  if (state?.ok && mode === 'edit' && props.onDone) {
    props.onDone()
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {mode === 'edit' && <input type="hidden" name="id" value={props.skill.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">代碼 {mode === 'create' ? '*' : ''}</label>
          <input
            name="code"
            placeholder="add-within-20"
            defaultValue={mode === 'edit' ? '' : undefined}
            disabled={mode === 'edit'}
            className="rounded-lg border border-neutral-300 px-3 py-2 disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
          />
          {mode === 'edit' && (
            <p className="text-xs text-neutral-400 dark:text-gray-500">代碼建立後不可修改</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">名稱 *</label>
          <input
            name="name"
            placeholder="20 以內加法"
            defaultValue={mode === 'edit' ? props.skill.name : undefined}
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">說明</label>
        <input
          name="description"
          placeholder="兩數相加，和不超過 20"
          defaultValue={mode === 'edit' ? (props.skill.description ?? '') : undefined}
          className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">年級</label>
          <select
            name="gradeLevel"
            defaultValue={mode === 'edit' ? props.skill.gradeLevel : 'G1'}
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="K">K</option>
            <option value="G1">G1</option>
            <option value="G2">G2</option>
            <option value="G3">G3</option>
            <option value="G4">G4</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">前置技能</label>
          <select
            name="prerequisiteId"
            defaultValue={mode === 'edit' ? (props.skill.prerequisiteId ?? '') : ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">無</option>
            {skills
              .filter((s) => mode === 'create' || s.id !== props.skill.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">排序</label>
          <input
            name="order"
            type="number"
            defaultValue={mode === 'edit' ? props.skill.order : 0}
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-500">{state.message}</p>}
      {state?.ok && <p className="text-sm text-green-600">{mode === 'edit' ? '已更新！' : '已建立！'}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? '儲存中…' : mode === 'edit' ? '✓ 儲存變更' : '+ 新增技能'}
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={props.onDone}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            取消
          </button>
        )}
      </div>
    </form>
  )
}
