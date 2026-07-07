import { Icon, type IconName } from './icon'

interface AnimatedBackgroundProps {
  /**
   * 主漸層背景的 Tailwind class。
   * 登入用 indigo/blue/purple；註冊用 emerald/teal/blue。
   */
  gradient?: string;
  /**
   * 模糊色塊（blob）的配色組合，給背景增加深度感。
   * 預設為藍紫系。
   */
  blobColors?: [string, string, string];
}

/**
 * 全螢幕數學主題動態背景。
 *
 * 包含多層視覺元素：
 * 1. 模糊色塊（blob）：在背景緩慢變形，營造柔和的色彩深度
 * 2. 數學方格紙底紋：淡淡的網格，呼應數學練習本的氛圍
 * 3. 浮動幾何形狀：圓形 / 三角形 / 方形，輕微旋轉漂浮
 * 4. 數學運算子：＋ − × ÷ ＝ ＜ ＞ π ½，完整的運算家族
 * 5. 數學工具：直尺 / 三角板 / 算盤 / 時鐘 / 硬幣
 * 6. 數字與算式：單一數字與 2+3、=10、5-2 等簡單算式
 * 7. 純幾何形狀：△ ○ □，呼應形狀單元
 * 8. 閃爍星星：散布的星形以 twinkle 動畫點綴
 *
 * 所有圖示皆為 inline SVG（取代原本 emoji，確保跨平台視覺一致）。
 * 所有動畫都會被 `.reduce-motion` 自動關閉（見 globals.css）。
 *
 * 元素皆為 `pointer-events-none` 與 `aria-hidden`，不影響互動與無障礙。
 */

/** 一個漂浮的裝飾圖示：外層 div 處理定位/動畫，內含白色 SVG。 */
function FloatIcon({
  icon, box, anim = 'animate-float-y', delay,
}: { icon: IconName; box: string; anim?: string; delay?: string }) {
  return (
    <div
      className={`absolute ${box} ${anim} text-white`}
      style={delay ? { animationDelay: delay } : undefined}
    >
      <Icon name={icon} className="h-full w-full" />
    </div>
  )
}

export default function AnimatedBackground({
  gradient = "from-indigo-500 via-blue-600 to-purple-700",
  blobColors = ["bg-purple-400/30", "bg-blue-400/30", "bg-indigo-300/30"],
}: AnimatedBackgroundProps) {
  return (
    <>
      {/* 模糊色塊：背景深度感 */}
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-br ${gradient}`}
        aria-hidden="true"
      >
        <div
          className={`absolute -left-24 -top-24 h-[28rem] w-[28rem] animate-blob ${blobColors[0]} blur-3xl`}
        />
        <div
          className={`absolute -bottom-32 -right-20 h-[32rem] w-[32rem] animate-blob ${blobColors[1]} blur-3xl`}
          style={{ animationDelay: "-5s" }}
        />
        <div
          className={`absolute left-1/2 top-1/3 h-[24rem] w-[24rem] -translate-x-1/2 animate-blob ${blobColors[2]} blur-3xl`}
          style={{ animationDelay: "-10s" }}
        />
        {/* 夜間模式：覆蓋深色半透明層，讓彩色漸層與色塊變得非常暗（仍保留一點藍色調） */}
        <div className="absolute inset-0 hidden dark:block bg-slate-950/85" />
      </div>

      {/* 數學方格紙底紋：淡淡的網格呼應練習本 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* 浮動幾何形狀 */}
      <div
        className="pointer-events-none absolute inset-0 select-none"
        aria-hidden="true"
      >
        {/* 大圓環 */}
        <div className="absolute left-[6%] top-[18%] h-24 w-24 animate-spin-slow rounded-full border-8 border-white/20" />
        {/* 三角形（CSS border 技巧） */}
        <div
          className="absolute right-[8%] top-[60%] animate-float-y"
          style={{
            width: 0,
            height: 0,
            borderLeft: "2rem solid transparent",
            borderRight: "2rem solid transparent",
            borderBottom: "3.5rem solid rgba(255,255,255,0.18)",
          }}
        />
        {/* 小圓點 */}
        <div className="absolute left-[78%] top-[16%] h-6 w-6 animate-float-y rounded-full bg-white/25" />
        <div
          className="absolute left-[24%] top-[72%] h-5 w-5 animate-float-y-reverse rounded-full bg-white/20"
          style={{ animationDelay: "-2s" }}
        />
        {/* 方形 */}
        <div
          className="absolute left-[88%] top-[42%] h-12 w-12 animate-float-y rounded-lg bg-white/15"
          style={{ animationDelay: "-3s" }}
        />
        <div className="absolute left-[3%] top-[55%] h-8 w-8 animate-drift rounded-md bg-white/20" />
      </div>

      {/* 數學符號與數字 */}
      <div
        className="pointer-events-none absolute inset-0 select-none opacity-25"
        aria-hidden="true"
      >
        <FloatIcon icon="plus" box="left-[8%] top-[12%] h-24 w-24" />
        <FloatIcon icon="multiply" box="right-[10%] top-[22%] h-20 w-20" anim="animate-float-y-reverse" delay="-1.5s" />
        <FloatIcon icon="divide" box="bottom-[14%] left-[18%] h-16 w-16" anim="animate-drift" delay="-3s" />
        <FloatIcon icon="calculator" box="right-[16%] bottom-[10%] h-24 w-24" />
        <FloatIcon icon="star" box="left-[44%] top-[6%] h-12 w-12" anim="animate-twinkle" />
        {/* 缺漏的運算子：減號、等號、不等號、圓周率、分數 */}
        <FloatIcon icon="minus" box="left-[20%] top-[40%] h-20 w-20" anim="animate-float-y-reverse" delay="-2s" />
        <FloatIcon icon="equals" box="right-[35%] top-[30%] h-16 w-16" anim="animate-float-y" delay="-3.5s" />
        <div
          className="absolute left-[55%] top-[15%] animate-drift font-mono text-6xl font-bold text-white"
          style={{ animationDelay: "-4.5s" }}
        >
          &lt;
        </div>
        <div
          className="absolute right-[5%] top-[75%] animate-float-y-reverse font-mono text-6xl font-bold text-white"
          style={{ animationDelay: "-2.5s" }}
        >
          &gt;
        </div>
        <div
          className="absolute left-[12%] top-[85%] animate-float-y font-serif text-7xl italic text-white"
          style={{ animationDelay: "-5s" }}
        >
          π
        </div>
        <div
          className="absolute right-[50%] top-[88%] animate-float-y-reverse text-6xl text-white"
          style={{ animationDelay: "-1.5s" }}
        >
          ½
        </div>
        {/* 數字元素 */}
        <div
          className="absolute left-[30%] top-[68%] animate-float-y font-mono text-7xl font-bold text-white"
          style={{ animationDelay: "-2.5s" }}
        >
          7
        </div>
        <div
          className="absolute right-[28%] top-[50%] animate-float-y-reverse font-mono text-6xl font-bold text-white"
          style={{ animationDelay: "-4s" }}
        >
          3
        </div>
        <div
          className="absolute left-[60%] top-[80%] animate-drift font-mono text-5xl font-bold text-white"
          style={{ animationDelay: "-6s" }}
        >
          +5
        </div>
        {/* 簡單算式：呼應練習題 */}
        <div
          className="absolute left-[68%] top-[35%] animate-float-y font-mono text-4xl font-bold text-white"
          style={{ animationDelay: "-3s" }}
        >
          2+3
        </div>
        <div
          className="absolute right-[6%] top-[48%] animate-float-y-reverse font-mono text-4xl font-bold text-white"
          style={{ animationDelay: "-5s" }}
        >
          =10
        </div>
        <div
          className="absolute left-[38%] top-[42%] animate-drift font-mono text-4xl font-bold text-white"
          style={{ animationDelay: "-7s" }}
        >
          5−2
        </div>
        <FloatIcon icon="hundred" box="right-[40%] bottom-[20%] h-12 w-12" anim="animate-float-y" delay="-1s" />
      </div>

      {/* 數學工具：測量、算盤、時鐘、硬幣 */}
      <div
        className="pointer-events-none absolute inset-0 select-none opacity-25"
        aria-hidden="true"
      >
        <FloatIcon icon="ruler" box="left-[50%] top-[55%] h-16 w-16" anim="animate-float-y" delay="-1s" />
        <FloatIcon icon="triangle-square" box="right-[18%] top-[8%] h-16 w-16" anim="animate-float-y-reverse" delay="-4s" />
        <FloatIcon icon="abacus" box="left-[5%] top-[35%] h-20 w-20" anim="animate-drift" delay="-2.5s" />
        <FloatIcon icon="clock" box="right-[48%] top-[20%] h-16 w-16" anim="animate-float-y" delay="-3.5s" />
        <FloatIcon icon="coin" box="left-[82%] top-[28%] h-12 w-12" anim="animate-float-y-reverse" delay="-6s" />
      </div>

      {/* 純幾何形狀：呼應形狀單元（△ ○ □） */}
      <div
        className="pointer-events-none absolute inset-0 select-none opacity-30"
        aria-hidden="true"
      >
        <FloatIcon icon="triangle" box="left-[46%] top-[78%] h-16 w-16" anim="animate-float-y" delay="-2s" />
        <FloatIcon icon="circle" box="right-[32%] top-[68%] h-16 w-16" anim="animate-float-y-reverse" delay="-4.5s" />
        <FloatIcon icon="square" box="left-[15%] top-[58%] h-16 w-16" anim="animate-drift" delay="-5.5s" />
      </div>

      {/* 閃爍小星星 */}
      <div
        className="pointer-events-none absolute inset-0 select-none"
        aria-hidden="true"
      >
        <FloatIcon icon="sparkle" box="left-[15%] top-[28%] h-6 w-6" anim="animate-twinkle" />
        <FloatIcon icon="sparkle" box="right-[22%] top-[40%] h-5 w-5" anim="animate-twinkle" delay="-1s" />
        <FloatIcon icon="star" box="left-[70%] top-[8%] h-6 w-6" anim="animate-twinkle" delay="-2s" />
        <FloatIcon icon="sparkle" box="left-[40%] bottom-[12%] h-5 w-5" anim="animate-twinkle" delay="-1.5s" />
        <FloatIcon icon="star" box="right-[8%] bottom-[30%] h-6 w-6" anim="animate-twinkle" delay="-2.5s" />
      </div>
    </>
  );
}
