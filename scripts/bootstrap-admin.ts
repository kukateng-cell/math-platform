#!/usr/bin/env node
/**
 * Admin 引引 CLI — 安全地建立 / 重設管理員帳號
 *
 * 正式環境用：可指定真實 Email（收 OTP），避免 seed 建立無法收信的 .local 帳號。
 *
 * 用法：
 *   npx tsx scripts/bootstrap-admin.ts              # 互動式
 *   ADMIN_EMAIL=admin@x.com ADMIN_PASSWORD=xxx npx tsx scripts/bootstrap-admin.ts  # 免互動
 *
 * 安全：
 *   - 正式環境不允許 .local Email
 *   - 密碼至少 8 碼、不可為 admin123
 *   - 使用 upsert：已存在的管理員不會被重設密碼（除非指定 --force）
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function randomPassword(): string {
  return randomBytes(18)
    .toString('base64url')
    .replace(/[Il1O0]/g, 'x')
    .slice(0, 24)
}

function prompt(query: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a.trim()) }))
}

async function main() {
  const isProd = process.env.NODE_ENV === 'production'
  const args = process.argv.slice(2)
  const forceReset = args.includes('--force')

  let email = process.env.ADMIN_EMAIL?.trim() || ''
  let password = process.env.ADMIN_PASSWORD?.trim() || ''

  // 互動式輸入
  if (!email) {
    email = await prompt('管理員 Email（正式環境必填）: ')
  }
  if (!password) {
    password = await prompt('管理員密碼（留空自動產生）: ')
  }

  email = email.trim().toLowerCase()

  if (!email) {
    console.error('❌ Email 不可為空')
    process.exit(1)
  }

  if (isProd && email.endsWith('.local')) {
    console.error('❌ 正式環境不允許使用 .local Email')
    process.exit(1)
  }

  // 密碼處理
  if (!password) {
    password = randomPassword()
    console.log(`\n🔑 已自動產生密碼: ${password}`)
    console.log('   請務必保存此密碼！\n')
  } else if (password.length < 8 || password === 'admin123') {
    console.error('❌ 密碼至少 8 碼，且不可為 admin123')
    process.exit(1)
  }

  // 查詢是否已存在
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && !forceReset) {
    console.log(`ℹ️  管理員 ${email} 已存在，跳過（使用 --force 可重設密碼）`)
    await prisma.$disconnect()
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const admin = await prisma.user.upsert({
    where: { email },
    update: forceReset ? { passwordHash, tokenVersion: { increment: 1 } } : {},
    create: { email, name: '管理員', passwordHash, role: 'ADMIN' },
  })

  console.log(`✅ 管理員 ${admin.email} (${existing ? '已更新' : '已建立'})`)
  if (forceReset && existing) {
    console.log('   🔄 密碼已重設，tokenVersion 已遞增，舊 session 已失效')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
