'use client'

import React from 'react'

// ====================================================================
// 圖形 SVG 元件
// --------------------------------------------------------------------
// 取代原本用 Unicode 符號（□○△▭）表示圖形的做法——這些符號在不同字體/裝置
// 渲染差異大、孩子難以辨識。改用 inline SVG：矢量清晰、可縮放、支援顏色。
//
// 題庫 prompt / explanation 用標記字串 [shape:square] 等，前端渲染時
// 由 renderTextWithShapes() 解析並替換成 <ShapeIcon>。
//
// 支援的形狀：square / circle / triangle / rectangle（對應正方/圓/三角/長方）
// ====================================================================

type ShapeKind = 'square' | 'circle' | 'triangle' | 'rectangle'

// 標記 → 形狀對照（同時容納中英文與舊符號，方便題庫多方寫法）
const SHAPE_ALIASES: Record<string, ShapeKind> = {
  // 標準 key
  square: 'square',
  circle: 'circle',
  triangle: 'triangle',
  rectangle: 'rectangle',
  // 中文別名
  正方形: 'square',
  圓形: 'circle',
  圆形: 'circle',
  三角形: 'triangle',
  長方形: 'rectangle',
  长方形: 'rectangle',
  // 舊 Unicode 符號（相容舊題目，免重 seed 也能正確顯示）
  '□': 'square',
  '○': 'circle',
  '△': 'triangle',
  '▭': 'rectangle',
}

// 每種形狀的配色（鮮豔、對比強，適合 K 年級孩子辨識）
const SHAPE_COLORS: Record<ShapeKind, { fill: string; stroke: string }> = {
  square: { fill: '#ef4444', stroke: '#b91c1c' },     // 紅
  circle: { fill: '#3b82f6', stroke: '#1d4ed8' },     // 藍
  triangle: { fill: '#22c55e', stroke: '#15803d' },   // 綠
  rectangle: { fill: '#f97316', stroke: '#c2410c' },  // 橙
}

const SHAPE_NAMES: Record<ShapeKind, string> = {
  square: '正方形',
  circle: '圓形',
  triangle: '三角形',
  rectangle: '長方形',
}

function resolveKind(token: string): ShapeKind | null {
  const key = token.trim().toLowerCase()
  return SHAPE_ALIASES[key] ?? SHAPE_ALIASES[token.trim()] ?? null
}

type Size = 'sm' | 'md' | 'lg'

const SIZE_PX: Record<Size, number> = { sm: 28, md: 48, lg: 96 }

/**
 * 判斷整個字串是否就是一個形狀名稱（如「正方形」/「square」/「□」）。
 * 用於選擇題選項：若選項本身就是形狀名，則直接用大圖形顯示，不再顯示文字。
 */
export function isShapeName(text: string): boolean {
  return resolveKind(text) !== null
}

/** 單一圖形 SVG。size: sm(選項/說明用) / md / lg(題幹大圖) */
export function ShapeIcon({ kind, size = 'md' }: { kind: ShapeKind; size?: Size }) {
  const px = SIZE_PX[size]
  const { fill, stroke } = SHAPE_COLORS[kind]
  const sw = Math.max(2, Math.round(px * 0.04)) // 描邊隨尺寸縮放

  // 共用屬性：垂直對齊文字基線，避免在文字行內顯示偏移
  const common = {
    width: px,
    height: px,
    role: 'img' as const,
    'aria-label': SHAPE_NAMES[kind],
    style: { display: 'inline-block', verticalAlign: 'middle' } as React.CSSProperties,
  }

  if (kind === 'square') {
    return (
      <svg {...common} viewBox="0 0 100 100">
        <rect x="8" y="8" width="84" height="84" rx="6" fill={fill} stroke={stroke} strokeWidth={sw} />
      </svg>
    )
  }
  if (kind === 'rectangle') {
    return (
      <svg {...common} viewBox="0 0 120 80">
        <rect x="6" y="6" width="108" height="68" rx="5" fill={fill} stroke={stroke} strokeWidth={sw} />
      </svg>
    )
  }
  if (kind === 'circle') {
    return (
      <svg {...common} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill={fill} stroke={stroke} strokeWidth={sw} />
      </svg>
    )
  }
  // triangle
  return (
    <svg {...common} viewBox="0 0 100 100">
      <polygon points="50,8 92,90 8,90" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
  )
}

// ====================================================================
// 解析含 [shape:xxx] 標記的文字，把標記換成 <ShapeIcon>
// --------------------------------------------------------------------
// 例：「這是什麼形狀？[shape:square]」→ 「這是什麼形狀？」+ <大正方形>
//     也相容舊題目的裸符號（□○△▭）——會自動換成對應彩色 SVG。
//
// size: 傳入的預設圖形尺寸（題幹用 lg、說明用 sm）
// ====================================================================
const SHAPE_TAG_RE = /\[shape:([^\]]+)\]/g

export function renderTextWithShapes(text: string, size: Size = 'md'): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0

  // 先處理顯式標記 [shape:xxx]
  let m: RegExpExecArray | null
  SHAPE_TAG_RE.lastIndex = 0
  while ((m = SHAPE_TAG_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(text.slice(lastIndex, m.index))
    }
    const kind = resolveKind(m[1])
    if (kind) {
      nodes.push(<ShapeIcon key={`s${key++}`} kind={kind} size={size} />)
    } else {
      // 無法辨識的標記原樣保留
      nodes.push(m[0])
    }
    lastIndex = m.index + m[0].length
  }

  // 處理剩餘的裸 Unicode 符號（□○△▭）——相容舊題庫
  const tail = lastIndex < text.length ? text.slice(lastIndex) : ''
  // 用佔位符拆分，逐段輸出
  const legacyRe = /[□○△▭]/g
  let lm: RegExpExecArray | null
  let lLast = 0
  legacyRe.lastIndex = 0
  while ((lm = legacyRe.exec(tail)) !== null) {
    if (lm.index > lLast) {
      nodes.push(tail.slice(lLast, lm.index))
    }
    const kind = SHAPE_ALIASES[lm[0]]
    if (kind) {
      nodes.push(<ShapeIcon key={`l${key++}`} kind={kind} size={size} />)
    } else {
      nodes.push(lm[0])
    }
    lLast = lm.index + lm[0].length
  }
  if (lLast < tail.length) {
    nodes.push(tail.slice(lLast))
  }

  return nodes
}

// ====================================================================
// 渲染「選擇題選項」
// --------------------------------------------------------------------
// 「下面哪一個是正方形？」這類題目，選項在題庫裡存成純文字（正方形/圓形/...）。
// 對孩子來說，用圖形顯示比文字更直觀、也更容易辨識。
//
// 規則：
// - 整個選項就是一個形狀名（正方形/square/□…）→ 顯示單一大圖形（不顯示文字）
// - 否則 → 走原本的 renderTextWithShapes（處理內嵌標記 / 舊符號 / 純文字）
// ====================================================================
export function renderOption(text: string, size: Size = 'md'): React.ReactNode {
  // resolveKind 內部已做 trim()，若整串都是形狀名（正方形/square/□…）就顯示單一大圖形；
  // 否則走 renderTextWithShapes（處理內嵌標記 / 舊符號 / 純文字）。
  const kind = resolveKind(text)
  if (kind) {
    return <ShapeIcon kind={kind} size={size} />
  }
  return renderTextWithShapes(text, size)
}
