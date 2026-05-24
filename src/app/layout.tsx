import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Nomad Hopper — 自然言語で航空券を検索',
  description: '話すように検索して最安値フライトを見つけよう',
  icons: { icon: '/favicon.ico' },
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
