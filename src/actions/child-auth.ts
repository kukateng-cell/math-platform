'use server'

import { redirect } from 'next/navigation'
import { deleteChildSession } from '@/lib/child-session'

// 學生練習完登出（回到首頁）
export async function childLogout() {
  await deleteChildSession()
  redirect('/')
}
