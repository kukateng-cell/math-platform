'use client'

import { useActionState, useState } from 'react'
import { createChild } from '@/actions/auth'

export default function AddChildForm() {
  const [state, action, pending] = useActionState(createChild, undefined)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border-2 border-dashed border-neutral-300 px-4 py-8 text-neutral-500 transition hover:border-blue-400 hover:text-blue-500 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-400 dark:hover:text-blue-400"
      >
        + 新增孩子檔案
      </button>
    )
  }

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-gray-600 dark:bg-gray-900"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="nickname" className="text-sm font-medium">
          孩子暱稱
        </label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          placeholder="小寶"
          maxLength={20}
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          required
        />
        {state?.errors?.nickname && (
          <p className="text-sm text-red-500">{state.errors.nickname[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="gradeLevel" className="text-sm font-medium">
          年級
        </label>
        <select
          id="gradeLevel"
          name="gradeLevel"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          defaultValue="G1"
        >
          <option value="K">幼兒園 (K)</option>
          <option value="G1">一年級 (G1)</option>
          <option value="G2">二年級 (G2)</option>
          <option value="G3">三年級 (G3)</option>
          <option value="G4">四年級 (G4)</option>
          <option value="G5">五年級 (G5)</option>
          <option value="G6">六年級 (G6)</option>
        </select>
        {state?.errors?.gradeLevel && (
          <p className="text-sm text-red-500">{state.errors.gradeLevel[0]}</p>
        )}
      </div>

      {state?.ok && <p className="text-sm text-green-600">已建立！</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? '建立中…' : '建立'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
        >
          取消
        </button>
      </div>
    </form>
  )
}
