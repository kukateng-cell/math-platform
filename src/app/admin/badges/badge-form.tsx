'use client'

import { useActionState, useState } from 'react'
import { createBadge, updateBadge, type BadgeFormState } from '@/actions/admin'

type BaseBadge = { id: string; name: string; icon: string; condition: string }

type Props =
  | { mode: 'create'; badge?: never }
  | { mode: 'edit'; badge: BaseBadge }

export default function BadgeForm(props: Props) {
  const { mode } = props
  const actionFn = mode === 'create' ? createBadge : updateBadge
  const [state, action, pending] = useActionState<BadgeFormState, FormData>(actionFn, undefined)
  const [showEdit, setShowEdit] = useState(false)

  if (state?.ok && mode === 'create') {
    // 建立成功後重置（透過重新整理）
  }

  if (mode === 'create') {
    return (
      <form action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">代碼 *</label>
            <input name="code" required className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="例：streak-50" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">名稱 *</label>
            <input name="name" required className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="例：連續 50 天" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">圖示（emoji）</label>
            <input name="icon" defaultValue="🏅" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">解鎖條件 *</label>
            <input name="condition" required className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="例：連續練習 50 天" />
          </div>
        </div>
        {state?.message && <p className="text-sm text-red-500">{state.message}</p>}
        {state?.ok && <p className="text-sm text-green-600">已建立！</p>}
        <button type="submit" disabled={pending} className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {pending ? '儲存中…' : '+ 新增徽章'}
        </button>
      </form>
    )
  }

  // 編輯模式：用彈窗
  if (!showEdit) {
    return (
      <button onClick={() => setShowEdit(true)} className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
        ✏️ 編輯
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowEdit(false) }}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-semibold">編輯徽章：{props.badge.name}</h3>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={props.badge.id} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">名稱</label>
            <input name="name" defaultValue={props.badge.name} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">圖示（emoji）</label>
            <input name="icon" defaultValue={props.badge.icon} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">解鎖條件</label>
            <input name="condition" defaultValue={props.badge.condition} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          {state?.message && <p className="text-sm text-red-500">{state.message}</p>}
          {state?.ok && <p className="text-sm text-green-600">已更新！</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">儲存</button>
            <button type="button" onClick={() => setShowEdit(false)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">取消</button>
          </div>
        </form>
      </div>
    </div>
  )
}
