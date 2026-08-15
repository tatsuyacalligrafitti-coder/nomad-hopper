'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// 予約サイトのような1枚のカレンダー。往路→復路を続けて選ぶ。
// 外部の日付ライブラリは使わない（読み込む量を増やさないため）。

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

const pad = (n: number) => String(n).padStart(2, '0')
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const todayIso = () => toIso(new Date())

const jp = (iso: string) => {
  const d = fromIso(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** その月のマス目。前の月ぶんは空白で埋める */
function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(first.getDay()).fill(null)
  for (let d = 1; d <= days; d++) cells.push(toIso(new Date(year, month, d)))
  return cells
}

interface Props {
  /** 'range' は往路と復路、'single' は1日だけ */
  mode: 'range' | 'single'
  start: string
  end: string
  min: string
  max?: string
  onChange: (start: string, end: string) => void
  /** 両方そろった／片道で確定したときに閉じる */
  onDone: () => void
}

export default function RangeCalendar({ mode, start, end, min, max, onChange, onDone }: Props) {
  const base = fromIso(start || min)
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() })
  // 開くたびに往路の選び直しから始める（予約サイトと同じ振る舞い）。
  // このカレンダーは開いたときに作られ、閉じると消えるので、初期値がそのまま「1回目」になる。
  const [phase, setPhase] = useState<'start' | 'end'>('start')

  const cells = monthCells(view.y, view.m)
  const minD = fromIso(min)
  const maxD = max ? fromIso(max) : null

  const pick = (iso: string) => {
    if (mode === 'single') {
      onChange(iso, '')
      onDone()
      return
    }
    // 1回目、または往路より前を押したときは往路として置き直す
    if (phase === 'start' || !start || iso < start) {
      onChange(iso, '')
      setPhase('end')
      return
    }
    onChange(start, iso)
    onDone()
  }

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  const canGoBack = new Date(view.y, view.m, 1) > new Date(minD.getFullYear(), minD.getMonth(), 1)

  const hint =
    mode === 'single' ? 'この区間を出発する日を選んでください'
    : phase === 'start' ? '出発する日を選んでください'
    : !end ? '帰ってくる日を選んでください（片道ならそのまま下のボタンへ）'
    : ''

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          aria-label="前の月"
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-base font-bold text-gray-900">
          {view.y}年{view.m + 1}月
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="次の月"
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEK.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-semibold py-1 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`blank-${i}`} />
          const d = fromIso(iso)
          const disabled = d < minD || (maxD !== null && d > maxD)
          const isStart = iso === start
          const isEnd = iso === end
          const inRange = !!start && !!end && iso > start && iso < end

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => pick(iso)}
              aria-label={`${view.y}年${view.m + 1}月${d.getDate()}日`}
              aria-pressed={isStart || isEnd}
              className={[
                'h-11 sm:h-12 rounded-xl text-sm font-semibold transition-colors',
                disabled ? 'text-gray-200 cursor-default' : 'text-gray-900 hover:bg-indigo-50',
                isStart || isEnd ? 'bg-indigo-600 text-white hover:bg-indigo-600' : '',
                inRange ? 'bg-indigo-100 text-indigo-900' : '',
              ].join(' ')}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      {hint && <p className="mt-3 text-sm text-gray-500">{hint}</p>}

      {mode === 'range' && phase === 'end' && start && !end && (
        <button
          type="button"
          onClick={onDone}
          className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          {jp(start)}に出発する片道でよい
        </button>
      )}
    </div>
  )
}

export { jp as jpDate }
