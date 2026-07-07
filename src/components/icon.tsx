import React from 'react'

// ====================================================================
// 集中式 SVG 圖示庫（取代全站 emoji）
// --------------------------------------------------------------------
// 動機：emoji 在不同平台（Apple / Google / Microsoft / Samsung）渲染
// 差異極大，造成視覺不一致。改用 inline SVG（stroke + currentColor）
// 後：矢量清晰、可縮放、自動跟隨文字顏色（含 dark mode）、跨平台一致。
//
// 設計規範：
//  - viewBox 0 0 24 24（業界標準，Lucide / Heroicons 風格）
//  - stroke="currentColor"、strokeWidth={2}、圓角線帽
//  - 顏色繼承父元素 text color（黑底白字、白底黑字自動切換）
//  - 尺寸由 className 控制（預設 h-5 w-5），如 className="h-8 w-8"
//  - 純展示元件，無 hooks → 可同時用於 Server / Client Component
// ====================================================================

export type IconName =
  // 數學運算子
  | 'plus' | 'minus' | 'multiply' | 'divide' | 'equals' | 'percent'
  // 幾何形狀（背景裝飾用，簡單輪廓；彩色版本見 shape-icon.tsx）
  | 'triangle' | 'circle' | 'square'
  // 狀態
  | 'check' | 'check-circle' | 'x'
  // 成就 / 鼓勵
  | 'star' | 'sparkle' | 'trophy' | 'medal' | 'target' | 'fire' | 'gem' | 'bolt' | 'thumbs-up' | 'brain'
  // 自然 / 慶祝
  | 'sprout' | 'leaf' | 'flower' | 'rocket' | 'party'
  // 時間
  | 'stopwatch' | 'clock' | 'calendar'
  // 數學工具
  | 'pencil' | 'ruler' | 'triangle-square' | 'abacus' | 'calculator' | 'coin' | 'books' | 'hundred'
  // UI 控件
  | 'refresh' | 'search' | 'bell' | 'lock' | 'mail' | 'wrench' | 'robot' | 'student'
  | 'graduation' | 'folder' | 'inbox' | 'book' | 'help-circle' | 'note' | 'sun' | 'moon' | 'laptop'
  | 'lightbulb' | 'chevron-down' | 'download'
  | 'backspace' | 'link' | 'trash' | 'alert'
  | 'key' | 'chart' | 'eye' | 'arrow-up' | 'arrow-down' | 'tree' | 'gear'
  | 'clipboard' | 'folder-open' | 'hand' | 'wave'

const PATHS: Record<IconName, React.ReactNode> = {
  // ── 數學運算子 ──
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  multiply: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  divide: <><circle cx="12" cy="6" r="1" fill="currentColor" stroke="none" /><line x1="5" y1="12" x2="19" y2="12" /><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" /></>,
  equals: <><line x1="5" y1="9" x2="19" y2="9" /><line x1="5" y1="15" x2="19" y2="15" /></>,
  percent: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,

  // ── 幾何形狀（輪廓版，給背景用）──
  triangle: <polygon points="12,4 21,20 3,20" />,
  circle: <circle cx="12" cy="12" r="9" />,
  square: <rect x="4" y="4" width="16" height="16" rx="1.5" />,

  // ── 狀態 ──
  check: <polyline points="4,13 9.5,18.5 20,5" />,
  'check-circle': <><circle cx="12" cy="12" r="9.5" /><polyline points="8,12.5 11,15.5 16,9.5" /></>,
  x: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,

  // ── 成就 / 鼓勵 ──
  star: <polygon points="12,2.5 14.85,8.8 21.7,9.6 16.6,14.2 18.05,21 12,17.5 5.95,21 7.4,14.2 2.3,9.6 9.15,8.8" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />,
  sparkle: <path d="M12 2 L13.6 9.2 L21 11 L13.6 12.8 L12 20 L10.4 12.8 L3 11 L10.4 9.2 Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />,
  trophy: <>
    <path d="M8 4 h8 v4 a4 4 0 0 1 -8 0 z" />
    <path d="M8 5 H5.5 a2 2 0 0 0 2 3.5" />
    <path d="M16 5 h2.5 a2 2 0 0 1 -2 3.5" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <path d="M9 20 h6 M10 16 h4 l1 4 h-6 z" />
  </>,
  medal: <><circle cx="12" cy="14" r="6" /><path d="M9 9 L7 3 h10 l-2 6" /><polyline points="9.5,14 11.3,15.8 14.5,12.3" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  fire: <path d="M12 3 c0.5 3 -2 4 -2 6.5 a2 2 0 0 0 4 0 c0 -1 0 -1.5 -0.5 -2.5 c2 1 3.5 3 3.5 5.5 a5 5 0 0 1 -10 0 c0 -3.5 3 -5 5 -9.5 z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />,
  gem: <><polygon points="12,3 20,9 12,21 4,9" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="12" y1="3" x2="12" y2="21" /></>,
  bolt: <polygon points="13,2 5,13 11,13 10,22 19,10 13,10" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />,
  'thumbs-up': <><path d="M7 11 v9 H4 a1 1 0 0 1 -1 -1 v-7 a1 1 0 0 1 1 -1 z" /><path d="M7 11 l4 -7 a1.8 1.8 0 0 1 1.8 1.8 v3.2 h4.7 a2 2 0 0 1 2 2.4 l-1.2 6 a2 2 0 0 1 -2 1.6 H7" /></>,
  brain: <><path d="M9 4 a3 3 0 0 0 -3 3 a2.5 2.5 0 0 0 -1 4.8 a2.5 2.5 0 0 0 1.5 4.2 a2.5 2.5 0 0 0 2.5 3 a2.5 2.5 0 0 0 2.5 -2 V4.5" /><path d="M15 4 a3 3 0 0 1 3 3 a2.5 2.5 0 0 1 1 4.8 a2.5 2.5 0 0 1 -1.5 4.2 a2.5 2.5 0 0 1 -2.5 3 a2.5 2.5 0 0 1 -2.5 -2 V4.5" /></>,

  // ── 自然 / 慶祝 ──
  sprout: <><path d="M12 21 v-7" /><path d="M12 14 c0 -3 -2.5 -5 -6 -5 c0 3 2.5 5 6 5 z" /><path d="M12 12 c0 -3 2.5 -5 6 -5 c0 3 -2.5 5 -6 5 z" /></>,
  leaf: <><path d="M5 19 c0 -8 5 -13 14 -14 c0 9 -6 14 -14 14 z" fill="currentColor" fillOpacity="0.25" /><path d="M5 19 c3 -7 7 -10 12 -12" /></>,
  flower: <><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="6.5" r="2.5" /><circle cx="12" cy="17.5" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="12" r="2.5" /></>,
  rocket: <><path d="M5 14 c-1 2 -1 5 -1 5 s3 0 5 -1 c3 -1.5 5 -4 7 -9 c0.5 -3 0 -5 0 -5 s-2 -0.5 -5 0 c-5 2 -7.5 4 -9 7 z" /><circle cx="14.5" cy="9.5" r="1.6" /><path d="M7 15 c-2 0 -3 2 -3 4 s2 1 4 -1" /></>,
  party: <><path d="M4 20 l7 -16 l3 1 l-5 13 z" /><path d="M14 6 l3 1" /><circle cx="18" cy="4.5" r="0.8" fill="currentColor" stroke="none" /><circle cx="19.5" cy="9" r="0.8" fill="currentColor" stroke="none" /><circle cx="16" cy="11" r="0.8" fill="currentColor" stroke="none" /></>,

  // ── 時間 ──
  stopwatch: <><circle cx="12" cy="13" r="7.5" /><line x1="12" y1="13" x2="12" y2="8.5" /><line x1="12" y1="13" x2="15" y2="14.5" /><line x1="10" y1="3.5" x2="14" y2="3.5" /><line x1="12" y1="3.5" x2="12" y2="5.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><polyline points="12,7 12,12 15.5,14" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><line x1="3.5" y1="9.5" x2="20.5" y2="9.5" /><line x1="8" y1="3.5" x2="8" y2="6.5" /><line x1="16" y1="3.5" x2="16" y2="6.5" /><circle cx="8" cy="14" r="0.8" fill="currentColor" stroke="none" /><circle cx="12" cy="14" r="0.8" fill="currentColor" stroke="none" /><circle cx="16" cy="14" r="0.8" fill="currentColor" stroke="none" /></>,

  // ── 數學工具 ──
  pencil: <><path d="M4 20 l1 -4 L15 6 l3 3 L8 19 z" /><line x1="14" y1="7" x2="17" y2="10" /></>,
  ruler: <><rect x="2.5" y="8" width="19" height="8" rx="1" transform="rotate(0 12 12)" /><line x1="6" y1="8" x2="6" y2="11" /><line x1="10" y1="8" x2="10" y2="11" /><line x1="14" y1="8" x2="14" y2="11" /><line x1="18" y1="8" x2="18" y2="11" /></>,
  'triangle-square': <><path d="M3 18 h8 L7 11 z" /><rect x="13" y="9" width="8" height="9" /></>,
  abacus: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><line x1="3" y1="14.5" x2="21" y2="14.5" /><circle cx="8" cy="9.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="9.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="14" cy="14.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="16" cy="14.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="18" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></>,
  calculator: <><rect x="5" y="2.5" width="14" height="19" rx="2" /><line x1="5" y1="7.5" x2="19" y2="7.5" /><circle cx="9" cy="12" r="0.9" fill="currentColor" stroke="none" /><circle cx="13" cy="12" r="0.9" fill="currentColor" stroke="none" /><circle cx="17" cy="12" r="0.9" fill="currentColor" stroke="none" /><circle cx="9" cy="16" r="0.9" fill="currentColor" stroke="none" /><circle cx="13" cy="16" r="0.9" fill="currentColor" stroke="none" /><circle cx="17" cy="16" r="0.9" fill="currentColor" stroke="none" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" /><line x1="12" y1="9.5" x2="12" y2="14.5" /></>,
  books: <><rect x="3" y="4" width="5" height="16" rx="0.5" /><rect x="9.5" y="7" width="5" height="13" rx="0.5" /><path d="M16 7 l4 -1 l2 13 l-4 1 z" /></>,
  hundred: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5 a1.8 1.8 0 0 1 1.8 -1.8 a1.8 1.8 0 0 1 1.8 1.8 v0.7 a1.8 1.8 0 0 1 -1.8 1.8 M8.5 11 v5 M12.1 14.5 a1.8 1.8 0 0 1 1.8 -1.8 a1.8 1.8 0 0 1 1.8 1.8 v0.7 a1.8 1.8 0 0 1 -1.8 1.8 M12.1 11 v5" /></>,

  // ── UI 控件 ──
  refresh: <><path d="M21 12 a9 9 0 0 1 -15.5 6.2 L3 16" /><path d="M3 12 a9 9 0 0 1 15.5 -6.2 L21 8" /><polyline points="3,4 3,8 7,8" /><polyline points="21,20 21,16 17,16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></>,
  bell: <><path d="M6 9 a6 6 0 0 1 12 0 c0 5 2 6 2 6 H4 s2 -1 2 -6 z" /><path d="M10 19 a2 2 0 0 0 4 0" /></>,
  lock: <><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10 V7 a4 4 0 0 1 8 0 v3" /><circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3.5,7 12,13 20.5,7" /></>,
  wrench: <path d="M15 4 a4 4 0 0 0 -5 5 l-6 6 a2 2 0 0 0 3 3 l6 -6 a4 4 0 0 0 5 -5 l-3 3 l-2.5 -0.5 l-0.5 -2.5 z" />,
  robot: <><rect x="5" y="8" width="14" height="11" rx="2" /><line x1="12" y1="4" x2="12" y2="8" /><circle cx="12" cy="3.5" r="1" fill="currentColor" stroke="none" /><circle cx="9.5" cy="13" r="1.2" fill="currentColor" stroke="none" /><circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none" /><line x1="9.5" y1="16" x2="14.5" y2="16" /><line x1="5" y1="12" x2="3" y2="12" /><line x1="19" y1="12" x2="21" y2="12" /></>,
  student: <><path d="M3 9 l9 -4 l9 4 l-9 4 z" /><path d="M7 11 v4 c0 1.5 2.5 3 5 3 s5 -1.5 5 -3 v-4" /><line x1="21" y1="9" x2="21" y2="14" /></>,
  graduation: <><path d="M3 9 l9 -4 l9 4 l-9 4 z" /><path d="M7 11.5 V15 c0 1.5 2.5 2.8 5 2.8 s5 -1.3 5 -2.8 v-3.5" /><line x1="21" y1="9" x2="21" y2="14.5" /></>,
  folder: <path d="M3 7 a1 1 0 0 1 1 -1 h5 l2 2 h8 a1 1 0 0 1 1 1 v9 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 z" />,
  inbox: <><polyline points="3,13 7,13 9,16 15,16 17,13 21,13" /><rect x="3" y="4" width="18" height="16" rx="2" /></>,
  book: <><path d="M5 4 h11 a2 2 0 0 1 2 2 v14 H7 a2 2 0 0 1 -2 -2 z" /><line x1="5" y1="18" x2="18" y2="18" /><line x1="9" y1="8" x2="14" y2="8" /><line x1="9" y1="11" x2="13" y2="11" /></>,
  'help-circle': <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5 a2.5 2.5 0 0 1 4.5 1.5 c0 1.5 -2 2 -2 3" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" /></>,
  note: <><path d="M5 3 h11 l4 4 v14 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 V4 a1 1 0 0 1 1 -1 z" /><polyline points="15,3 15,8 19,8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="16" x2="14" y2="16" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4.5" /><line x1="12" y1="19.5" x2="12" y2="22" /><line x1="2" y1="12" x2="4.5" y2="12" /><line x1="19.5" y1="12" x2="22" y2="12" /><line x1="5" y1="5" x2="6.8" y2="6.8" /><line x1="17.2" y1="17.2" x2="19" y2="19" /><line x1="19" y1="5" x2="17.2" y2="6.8" /><line x1="6.8" y1="17.2" x2="5" y2="19" /></>,
  moon: <path d="M20 14 a8 8 0 0 1 -10 -10 a8 8 0 1 0 10 10 z" />,
  laptop: <><rect x="4" y="5" width="16" height="10" rx="1.5" /><line x1="2" y1="19" x2="22" y2="19" /><line x1="10" y1="19" x2="14" y2="19" /></>,
  lightbulb: <><path d="M9 18 h6" /><path d="M10 21 h4" /><path d="M12 3 a6 6 0 0 0 -4 10.5 c0.8 0.8 1 1.5 1 2.5 h6 c0 -1 0.2 -1.7 1 -2.5 A6 6 0 0 0 12 3 z" /></>,
  'chevron-down': <polyline points="6,9 12,15 18,9" />,
  backspace: <><path d="M9 4 h11 a1 1 0 0 1 1 1 v14 a1 1 0 0 1 -1 1 H9 L3 12 z" /><line x1="11" y1="9.5" x2="17" y2="15.5" /><line x1="17" y1="9.5" x2="11" y2="15.5" /></>,
  link: <><path d="M10 13 a4 4 0 0 0 0 -6 L8 5 a4 4 0 0 0 -6 6 l2 2" /><path d="M14 11 a4 4 0 0 0 0 6 l2 2 a4 4 0 0 0 6 -6 l-2 -2" /><line x1="9" y1="15" x2="15" y2="9" /></>,
  trash: <><polyline points="4,6 6,6 6.5,20 a1 1 0 0 0 1 1 h9 a1 1 0 0 0 1 -1 L18 6 20,6" /><line x1="9" y1="6" x2="9" y2="4.5" /><line x1="15" y1="6" x2="15" y2="4.5" /><line x1="10" y1="10" x2="10" y2="17" /><line x1="14" y1="10" x2="14" y2="17" /></>,
  alert: <><path d="M12 3 L22 20 H2 z" /><line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" /></>,
  key: <><circle cx="8" cy="12" r="4" /><path d="M11 12 H21 M18 12 v3 M21 12 v3" /></>,
  chart: <><line x1="4" y1="20" x2="21" y2="20" /><rect x="6" y="11" width="3" height="9" /><rect x="11" y="7" width="3" height="13" /><rect x="16" y="13" width="3" height="7" /></>,
  eye: <><path d="M2 12 s4 -7 10 -7 s10 7 10 7 s-4 7 -10 7 s-10 -7 -10 -7 z" /><circle cx="12" cy="12" r="3" /></>,
  'arrow-up': <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="6,11 12,5 18,11" /></>,
  'arrow-down': <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="6,13 12,19 18,13" /></>,
  tree: <><path d="M12 2 L6 12 H8 L4 19 H20 L16 12 H18 z" /><line x1="12" y1="19" x2="12" y2="22" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2 v3 M12 19 v3 M22 12 h-3 M5 12 H2 M19 5 l-2 2 M7 17 l-2 2 M19 19 l-2 -2 M7 7 l-2 -2" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="18" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="15" y2="15" /><line x1="9" y1="19" x2="13" y2="19" /></>,
  'folder-open': <><path d="M3 7 a1 1 0 0 1 1 -1 h5 l2 2 h8 a1 1 0 0 1 1 1 v1 H3 z" /><path d="M3 10 h18 l-2 9 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 z" /></>,
  hand: <><path d="M8 13 V5 a1.3 1.3 0 0 1 2.6 0 V11 M10.6 11 V4 a1.3 1.3 0 0 1 2.6 0 V11 M13.2 11 V5.5 a1.3 1.3 0 0 1 2.6 0 V12 M15.8 12 V8 a1.3 1.3 0 0 1 2.6 0 v7 a6 6 0 0 1 -6 6 h-1.5 a5 5 0 0 1 -4 -2 l-3.5 -5 a1.4 1.4 0 0 1 2.2 -1.7 z" /></>,
  wave: <><path d="M3 12 c2 -2 4 -2 6 0 s4 2 6 0 s4 -2 6 0" /><path d="M3 16 c2 -2 4 -2 6 0 s4 2 6 0 s4 -2 6 0" /><path d="M3 8 c2 -2 4 -2 6 0 s4 2 6 0 s4 -2 6 0" /></>,
  download: <><path d="M12 3 v12" /><polyline points="8,11 12,15 16,11" /><line x1="4" y1="17" x2="20" y2="17" /><line x1="4" y1="21" x2="20" y2="21" /></>,
}

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName
  /** 尺寸與顏色透過 className 控制，預設 h-5 w-5（顏色繼承父元素 currentColor） */
  className?: string
}

/**
 * 通用 SVG 圖示。用法：<Icon name="check" className="h-5 w-5 text-green-500" />
 * 顏色預設跟隨父元素文字色；可加 text-* 覆寫。尺寸用 h-* 或 w-* 控制。
 */
export function Icon({ name, className = 'h-5 w-5', ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}

export default Icon

// ====================================================================
// 徽章代碼 → 圖示對照
// --------------------------------------------------------------------
// 徽章的 icon 在 DB 裡是 emoji 字串（seed 寫死）。為避免重新 seed，
// 這裡改用穩定的 badge.code 映射到 SVG 圖示。
// ====================================================================
export function badgeIconName(code: string): IconName {
  switch (code) {
    case 'first-practice': return 'sparkle'
    case 'streak-7': return 'fire'
    case 'streak-14': return 'fire'
    case 'streak-30': return 'trophy'
    case 'stars-50': return 'star'
    case 'stars-100': return 'star'
    case 'perfect-score': return 'target'
    case 'all-skills': return 'books'
    case 'addition-master': return 'abacus'
    case 'subtraction-master': return 'minus'
    case 'promotion-pass': return 'graduation'
    case 'promotion-star': return 'star'
    case 'persistent-5': return 'calendar'
    case 'combo-10': return 'sparkle'
    case 'combo-25': return 'gem'
    case 'speed-demon': return 'bolt'
    case 'mastery-3': return 'brain'
    default: return 'medal'
  }
}
