import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { buildChildCsv } from '@/lib/export-data'
import { csvFileName } from '@/lib/csv'

// GET /api/export/child/[childId]
// 家長匯出單一孩子的完整學習資料（CSV，含 BOM，Excel 可直接開啟中文）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return new NextResponse('未登入', { status: 401 })
  }

  const { childId } = await params

  // 驗證家長可存取這個孩子（建立或綁定）
  const child = await prisma.childProfile.findFirst({
    where: {
      id: childId,
      OR: [
        { parentId: session.userId },
        { parentLinks: { some: { parentId: session.userId } } },
      ],
    },
    select: { id: true },
  })
  if (!child) {
    return new NextResponse('找不到孩子或無權限', { status: 403 })
  }

  const { nickname, csv } = await buildChildCsv(childId)
  const filename = csvFileName(`child-${encodeURIComponent(nickname)}`)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
