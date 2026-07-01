'use client'

import { useState } from 'react'
import { deleteChild } from '@/actions/auth'

export default function DeleteChildButton({
  childId,
  nickname,
}: {
  childId: string
  nickname: string
}) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-neutral-400 transition hover:text-red-500"
      >
        刪除檔案
      </button>
    )
  }

  return (
    <form action={deleteChild} className="flex items-center gap-2">
      <input type="hidden" name="childId" value={childId} />
      <span className="text-xs text-red-500">確定刪除「{nickname}」？</span>
      <button
        type="submit"
        className="text-xs font-medium text-red-600 hover:underline"
      >
        確認刪除
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-neutral-400 hover:underline"
      >
        取消
      </button>
    </form>
  )
}
