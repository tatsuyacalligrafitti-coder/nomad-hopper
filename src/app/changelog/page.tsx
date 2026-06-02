import Link from 'next/link'
import { CHANGELOG } from '@/lib/changelog'

function formatDateJa(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-sky-50">
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 transition-colors mb-6"
          >
            ← Tobiraに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">更新履歴</h1>
          <p className="text-sm text-gray-500 mt-1">Tobiraの最新アップデート情報をご覧いただけます</p>
        </div>

        <div className="space-y-5">
          {CHANGELOG.map((entry, i) => (
            <div
              key={`${entry.date}-${i}`}
              className={[
                'bg-white rounded-2xl border px-6 py-5 shadow-sm',
                i === 0 ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">{formatDateJa(entry.date)}</p>
                  <h2 className="font-bold text-gray-900 text-base leading-snug">{entry.title}</h2>
                </div>
                {i === 0 && (
                  <span className="shrink-0 text-xs bg-indigo-600 text-white font-bold rounded-full px-2.5 py-1">
                    最新
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {entry.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="shrink-0 text-green-500 mt-0.5">✅</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
