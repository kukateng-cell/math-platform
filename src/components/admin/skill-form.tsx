'use client'

import { useActionState } from 'react'
import { createSkill, type AdminFormState } from '@/actions/admin'

export default function SkillForm({ skills }: { skills: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createSkill, undefined)

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">代碼 *</label>
          <input
            name="code"
            placeholder="add-within-20"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">名稱 *</label>
          <input
            name="name"
            placeholder="20 以內加法"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">說明</label>
        <input
          name="description"
          placeholder="兩數相加，和不超過 20"
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">年級</label>
          <select name="gradeLevel" defaultValue="G1" className="rounded-lg border border-neutral-300 px-3 py-2">
            <option value="K">K</option>
            <option value="G1">G1</option>
            <option value="G2">G2</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">前置技能</label>
          <select name="prerequisiteId" defaultValue="" className="rounded-lg border border-neutral-300 px-3 py-2">
            <option value="">無</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-500">{state.message}</p>}
      {state?.ok && <p className="text-sm text-green-600">已建立！</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? '建立中…' : '+ 新增技能'}
      </button>
    </form>
  )
}
