import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
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
      </body>
    </html>
  )
}
