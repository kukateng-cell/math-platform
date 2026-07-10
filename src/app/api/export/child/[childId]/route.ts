import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { prisma } from '@/lib/prisma'
import { buildChildCsv } from '@/lib/export-data'
import { csvFileName } from '@/lib/csv'

// GET /api/export/child/[childId]
// 匯出單一孩子的完整學習資料（CSV，含 BOM，Excel 可直接開啟中文）
// P2-1：同時支援家長 session（getSession）與孩子本人 session（getChildSession）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const { childId } = await params

  // 先嘗試家長 session
  const session = await getSession()
  if (session) {
    // 驗證家長可存取這個孩子
    const child = await prisma.childProfile.findFirst({
      where: {
        id: childId,
        OR: [
          { parentId: session.userId },
          { parentLinks: { some: { parentId: session.userId, status: 'ACTIVE' } } },
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

  // 再嘗試孩子本人 session（自主學習孩子可匯出自己的資料）
  const childSession = await getChildSession()
  if (childSession && childSession.childId === childId) {
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

  return new NextResponse('未登入', { status: 401 })
}
