'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createChildSession, deleteChildSession } from '@/lib/child-session'

type ChildLoginState = { error?: string } | undefined

// 孩子用 PIN 碼登入練習模式
export async function childLogin(state: ChildLoginState, formData: FormData): Promise<ChildLoginState> {
  // 組合 4 位數 PIN
  const pin = [0, 1, 2, 3].map((i) => String(formData.get(`d${i}`) || '')).join('')

  if (pin.length !== 4) {
    return { error: '請輸入完整的 4 位數 PIN 碼' }
  }

  // 只允許家長建立的孩子（STANDARD 模式）用 PIN 登入
  const child = await prisma.childProfile.findFirst({
    where: { pin, mode: 'STANDARD' },
  })

  if (!child) {
    return { error: 'PIN 碼錯誤，請再試一次' }
  }

  await createChildSession({
    childId: child.id,
    parentId: child.parentId ?? '',
    nickname: child.nickname,
  })

  // redirect 由 Next.js server action 機制處理
  redirect(`/practice/${child.id}`)
}

// 孩子練習完登出（回到首頁）
export async function childLogout() {
  await deleteChildSession()
  redirect('/')
}
