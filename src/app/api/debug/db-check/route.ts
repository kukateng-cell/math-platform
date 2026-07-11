// 診斷端點：測試 DB 連線是否正常（僅開發用，上線後應移除或加上權限保護）
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 測試基本連線
    await prisma.$queryRaw`SELECT 1 as ok`
    // 測試實際 query
    const userCount = await prisma.user.count()
    return NextResponse.json({
      status: 'ok',
      userCount,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
        nodeEnv: process.env.NODE_ENV,
      },
    })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json(
      {
        status: 'error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        env: {
          hasDbUrl: !!process.env.DATABASE_URL,
          dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
        },
      },
      { status: 500 }
    )
  }
}
