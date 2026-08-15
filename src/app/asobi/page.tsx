import type { Metadata } from 'next'
import Link from 'next/link'
import DetourGame from '@/components/DetourGame'
import { toJstDateString } from '@/lib/date-jst'

// 試験用ページ。プレビューでの検証が目的なので検索エンジンには載せない。
export const metadata: Metadata = {
  title: '国を増やして、安くする（試験中） | Tobira',
  robots: { index: false, follow: false },
}

// The default month is "now + 2 months" on JST, so it must be computed per
// request rather than baked in at build time.
export const dynamic = 'force-dynamic'

function defaultMonth(): string {
  const [y, m] = toJstDateString(Date.now()).split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1 + 2, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function AsobiPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white">
          試験中
        </span>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">国を増やして、安くする</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          行きたい場所を書いてください。まっすぐ向かうより、
          途中でどこか1か国に寄ったほうが安くなることがあります。
          いくら安くなるかを出します。
        </p>
      </div>

      <DetourGame defaultMonth={defaultMonth()} />

      <p className="mt-8 text-xs text-gray-500">
        このページは検証のための試験版です。
        <Link href="/" className="ml-1 underline underline-offset-2">
          通常の検索はこちら
        </Link>
      </p>
    </main>
  )
}
