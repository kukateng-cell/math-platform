import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { prisma } from '@/lib/prisma'
import { buildChildCsv } from '@/lib/export-data'
import { csvFileName } from '@/lib/csv'

// GET /api/export/child/[childId]
// 匯出單一孩子的完整學習資料（CSV，含 BOM，Excel 可直接開啟中文）
// P2-1：同時支援家長 session（getSession）與孩子本人 session（getChildSession）
// P2-7：若家長 session 無此孩子權限，fallthrough 嘗試 child session
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const { childId } = await params

  // 先嘗試家長 session
  const session = await getSession()
  if (session) {
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
    if (child) {
      // 家長有權限 → 直接匯出
      return sendCsv(childId)
    }
    // P2-7：家長無此孩子權限 → fallthrough 嘗試 child session
  }

  // 再嘗試孩子本人 session（自主學習孩子可匯出自己的資料）
  const childSession = await getChildSession()
  if (childSession && childSession.childId === childId) {
    return sendCsv(childId)
  }

  // 兩種身份都無法授權
  return new NextResponse(session ? '找不到孩子或無權限' : '未登入', {
    status: session ? 403 : 401,
  })
}

// 共用的 CSV 回應輔助函式
async function sendCsv(childId: string) {
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
