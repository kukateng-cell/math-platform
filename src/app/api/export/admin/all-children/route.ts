import { NextResponse } from 'next/server'
import { getVerifiedSession } from '@/lib/session'
import { buildAllChildrenCsv } from '@/lib/export-data'
import { csvFileName } from '@/lib/csv'

// GET /api/export/admin/all-children
// Admin 匯出全部孩子的練習紀錄總表（CSV）
// 使用 getVerifiedSession() 查 DB 確認 role，防止降級後舊 JWT 繼續使用
export async function GET() {
  const session = await getVerifiedSession()
  if (!session || session.role !== 'ADMIN') {
    return new NextResponse('需要管理員權限', { status: 403 })
  }

  const csv = await buildAllChildrenCsv()
  const filename = csvFileName('all-children')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
