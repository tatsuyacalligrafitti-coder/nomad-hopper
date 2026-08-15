'use client'

import { useState } from 'react'
import { Plus, X, Search, Pencil } from 'lucide-react'

export interface Leg {
  dest: string
  date: string // YYYY-MM-DD（カレンダーの値）
}

export interface FormValues {
  origin: string
  legs: Leg[]
  returnDate: string
}

// カレンダーの日付を、今ある検索が読める書き方にする。
// 年が今年と違うときだけ年を書く（「3月5日」だけだと来年ぶんと区別できないため）。
export function formatDate(iso: string, today: Date = new Date()): string {
  const [y, m, d] = iso.split('-').map(Number)
  return y === today.getFullYear() ? `${m}月${d}日` : `${y}年${m}月${d}日`
}

// フォームの内容を1つの文章にする。今ある検索にそのまま渡すための文。
//   片道          「9月25日に静岡から台北へ」
//   往復          「9月25日に静岡から台北へ、10月2日に帰ってくる」
//   経由地あり    「9月25日 静岡→9月28日 台北→10月2日 バンコク→静岡」
// ３つとも、今の検索が正しく読めることを実測で確かめてある。
export function buildSearchSentence(values: FormValues, today: Date = new Date()): string {
  const fd = (iso: string) => formatDate(iso, today)
  const legs = values.legs.filter(l => l.dest.trim() && l.date)
  if (legs.length === 0) return ''

  if (legs.length === 1) {
    const head = `${fd(legs[0].date)}に${values.origin.trim()}から${legs[0].dest.trim()}へ`
    return values.returnDate ? `${head}、${fd(values.returnDate)}に帰ってくる` : head
  }

  const cities = [values.origin.trim(), ...legs.map(l => l.dest.trim())]
  const dates = legs.map(l => l.date)
  if (values.returnDate) {
    cities.push(values.origin.trim())
    dates.push(values.returnDate)
  }
  return cities.map((city, i) => (dates[i] ? `${fd(dates[i])} ${city}` : city)).join('→')
}

const todayIso = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const fieldClass =
  'w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-base text-gray-900 ' +
  'placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'

const labelClass = 'block text-sm font-semibold text-gray-500 mb-2'

interface Props {
  onSubmitSentence: (sentence: string) => void
  onSwitchToText: () => void
}

export default function SearchForm({ onSubmitSentence, onSwitchToText }: Props) {
  const [origin, setOrigin] = useState('')
  const [legs, setLegs] = useState<Leg[]>([{ dest: '', date: '' }])
  const [returnDate, setReturnDate] = useState('')

  const min = todayIso()
  const values: FormValues = { origin, legs, returnDate }
  const ready = origin.trim() !== '' && legs.every(l => l.dest.trim() !== '' && l.date !== '')
  const lastLegDate = legs[legs.length - 1]?.date || min

  const updateLeg = (i: number, patch: Partial<Leg>) =>
    setLegs(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const addLeg = () => setLegs(prev => [...prev, { dest: '', date: '' }])

  const removeLeg = (i: number) => setLegs(prev => prev.filter((_, idx) => idx !== i))

  return (
    <form
      className="mt-6 sm:mt-8"
      onSubmit={e => {
        e.preventDefault()
        if (!ready) return
        onSubmitSentence(buildSearchSentence(values))
      }}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="form-origin" className={labelClass}>出発地</label>
          <input
            id="form-origin"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            placeholder="静岡 / 東京 / 大阪"
            className={fieldClass}
          />
        </div>

        {legs.map((leg, i) => (
          <div key={i} className="rounded-2xl bg-gray-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-500">
                {legs.length === 1 ? '目的地' : i === 0 ? '目的地（1つめ）' : `経由して行く先（${i + 1}つめ）`}
              </span>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => removeLeg(i)}
                  aria-label="この行き先を消す"
                  className="text-gray-400 hover:text-gray-600 rounded-full p-1"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <input
              value={leg.dest}
              onChange={e => updateLeg(i, { dest: e.target.value })}
              placeholder="台北 / バンコク / パリ"
              aria-label={`目的地${i + 1}`}
              className={fieldClass}
            />

            <div>
              <label htmlFor={`form-date-${i}`} className={labelClass}>
                {i === 0 ? '出発日' : `${legs[i - 1].dest.trim() || '前の行き先'}を出る日`}
              </label>
              <input
                id={`form-date-${i}`}
                type="date"
                value={leg.date}
                min={i === 0 ? min : legs[i - 1].date || min}
                onChange={e => updateLeg(i, { date: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addLeg}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 rounded-full border border-indigo-200 hover:border-indigo-300 px-4 py-2 transition-colors"
        >
          <Plus size={16} />
          経由地を追加
        </button>

        <div>
          <label htmlFor="form-return" className={labelClass}>
            帰着日（選ばなければ片道）
          </label>
          <input
            id="form-return"
            type="date"
            value={returnDate}
            min={lastLegDate}
            onChange={e => setReturnDate(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!ready}
        className="mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-5 text-left shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <span className={`flex items-center gap-2 ${ready ? 'text-white' : 'text-gray-400'}`}>
          <Search size={18} className="shrink-0" />
          <span className="text-base sm:text-lg font-bold">この内容で便を探す</span>
        </span>
        {ready && (
          <span className="block mt-2 text-sm text-indigo-100">
            検索に渡す文：{buildSearchSentence(values)}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onSwitchToText}
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 rounded-full border border-gray-200 hover:border-indigo-300 px-4 py-2 transition-colors"
      >
        <Pencil size={16} />
        文章で入力する
      </button>
    </form>
  )
}
