import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Tobira — 自然言語で航空券を検索',
  description: '世界への扉を、あなたの手に。話しかけるだけで旅が始まる。',
  metadataBase: new URL('https://tobira-world.jp'),
  openGraph: {
    title: 'Tobira — 自然言語で航空券を検索',
    description: '世界への扉を、あなたの手に。話しかけるだけで旅が始まる。',
    url: 'https://tobira-world.jp',
    siteName: 'Tobira',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Tobira — 世界への扉を、あなたの手に。',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tobira — 自然言語で航空券を検索',
    description: '世界への扉を、あなたの手に。話しかけるだけで旅が始まる。',
    images: ['/og-image.png'],
  },
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
        <Analytics />
        <footer className="text-center pb-6 pt-2 border-t border-gray-100 mt-4 space-y-1.5">
          <p className="text-xs text-gray-400">2026 Tobira · 世界への扉を、あなたの手に。</p>
          <Link href="/changelog" className="text-sm text-gray-500 hover:text-indigo-500 underline transition-colors">
            更新履歴
          </Link>
        </footer>
      </body>
    </html>
  )
}
