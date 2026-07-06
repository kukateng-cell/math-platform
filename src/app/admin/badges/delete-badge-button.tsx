'use client'

// 刪除徽章按鈕（Client Component）
// --------------------------------------------------------------------
// 原本 admin/badges/page.tsx 是 Server Component，卻在刪除按鈕上用了
// onClick + confirm() 做二次確認。Server Component 不能傳事件處理器
// （onClick）給子元件，會擲 "Event handlers cannot be passed to Client
// Component props" 錯誤。故把按鈕抽成獨立的 Client Component。
//
// 仍用 <form action={deleteBadge}> 觸發 server action（保持 POST 語義），
// 僅在提交前用 confirm() 攔截。

import { deleteBadge } from '@/actions/admin'

export default function DeleteBadgeButton({ id }: { id: string }) {
  return (
    <form
      action={deleteBadge}
      onSubmit={(e) => {
        if (!confirm('確定刪除此徽章？所有孩子獲得的此徽章紀錄也將一併刪除。')) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
      >
        🗑️ 刪除
      </button>
    </form>
  )
}
