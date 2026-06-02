import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Tobira — 自然言語で航空券を検索',
  description: '世界への扉を、あなたの手に。話しかけるだけで旅が始まる。',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Tobira',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#7C3AED',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geist.variable} antialiased`}>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-sky-50">
        {children}
        <footer className="text-center pb-6 pt-2">
          <Link href="/changelog" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">
            更新履歴
          </Link>
        </footer>
      </body>
    </html>
  )
}
