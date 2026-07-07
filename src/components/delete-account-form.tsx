'use client'

import { useActionState, useState } from 'react'
import { deleteAccount, type DeleteAccountState } from '@/actions/auth'
import { Icon } from './icon'

const initialState: DeleteAccountState = undefined

export default function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState)
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <Icon name="trash" className="h-4 w-4" />刪除我的帳號
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border-2 border-red-300 bg-red-50/50 p-5 dark:border-red-800 dark:bg-red-950/20">
      <div className="flex items-center gap-2">
        <Icon name="alert" className="h-5 w-5 text-red-500" />
        <h3 className="text-base font-bold text-red-700 dark:text-red-400">永久刪除帳號</h3>
      </div>

      <div className="space-y-1 text-sm text-red-800 dark:text-red-200">
        <p>此操作<strong>不可復原</strong>，將會永久刪除：</p>
        <ul className="ml-5 list-disc space-y-0.5">
          <li>你的家長帳號與登入資料</li>
          <li>你建立的所有孩子檔案</li>
          <li>所有練習紀錄、作答明細、掌握度與徽章</li>
        </ul>
        <p className="mt-2">
          <strong>建議先匯出資料備份</strong>：到每個孩子的「學習概覽」點「<Icon name="inbox" className="inline-block h-3.5 w-3.5 align-text-bottom" /> 匯出資料」。
        </p>
        <p className="mt-2">若孩子有獨立的自主學習帳號，該帳號不會被刪除（僅解除與你的綁定）。</p>
      </div>

      <div>
        <label htmlFor="del-password" className="block text-sm font-medium text-neutral-700 dark:text-gray-300">
          請輸入密碼以確認身份
        </label>
        <input
          id="del-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="你的登入密碼"
        />
        {state?.errors?.password && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.errors.password[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="del-confirm" className="block text-sm font-medium text-neutral-700 dark:text-gray-300">
          請輸入 <code className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">刪除我的帳號</code> 以確認
        </label>
        <input
          id="del-confirm"
          name="confirm"
          type="text"
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="刪除我的帳號"
        />
        {state?.errors?.confirm && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.errors.confirm[0]}</p>
        )}
      </div>

      {state?.message && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? '刪除中…' : '確認永久刪除'}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
        >
          取消
        </button>
      </div>
    </form>
  )
}
