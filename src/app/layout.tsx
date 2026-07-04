import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "數學小達人 | K-2 數學練習平台",
  description: "讓家長陪伴孩子建立扎實的數學基礎",
};

// viewport meta：手機/平板自適應螢幕的關鍵。Next.js App Router 不會自動產生此標籤，
// 若缺少，行動瀏覽器會以預設 ~980px 視窗渲染，導致 sm/md 響應式斷點不生效、頁面縮成一團、
// 且 input 聚焦時易發生異常縮放。不限制 maximumScale 以保留使用者縮放的無障礙權益。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    if (localStorage.getItem('reduced-motion') === 'true') {
      document.documentElement.classList.add('reduce-motion');
    }
    var theme = localStorage.getItem('theme') || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = theme === 'dark' || (theme !== 'light' && prefersDark);
    if (isDark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
      </body>
    </html>
  );
}
