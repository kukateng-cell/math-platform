'use client'

import { useActionState } from 'react'
import { createQuestion, type AdminFormState } from '@/actions/admin'

export default function QuestionForm({
  skills,
}: {
  skills: { id: string; name: string }[]
}) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createQuestion, undefined)

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">技能 *</label>
          <select name="skillId" defaultValue="" className="rounded-lg border border-neutral-300 px-3 py-2">
            <option value="" disabled>
              選擇技能
            </option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">題型</label>
          <select name="type" defaultValue="DIRECT" className="rounded-lg border border-neutral-300 px-3 py-2">
            <option value="DIRECT">直接題目</option>
            <option value="ADD">參數化加法</option>
            <option value="SUB">參數化減法</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">題目 *</label>
        <input
          name="prompt"
          placeholder="直接題目：3 + 4 = ?　參數化：{a} + {b} = ?"
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">答案 *</label>
          <input
            name="answer"
            placeholder="直接題：7　參數化：{a+b}"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">選項（選擇題用，逗號分隔）</label>
          <input
            name="options"
            placeholder="留空為填答題"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">參數 JSON（參數化題用）</label>
        <input
          name="paramsJson"
          placeholder='{"aMin":1,"aMax":5,"bMin":1,"bMax":5,"sumMax":10}'
          className="rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">解析</label>
        <input name="explanation" className="rounded-lg border border-neutral-300 px-3 py-2" />
      </div>

      {state?.message && <p className="text-sm text-red-500">{state.message}</p>}
      {state?.ok && <p className="text-sm text-green-600">已建立！</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? '建立中…' : '+ 新增題目'}
      </button>
    </form>
  )
}
