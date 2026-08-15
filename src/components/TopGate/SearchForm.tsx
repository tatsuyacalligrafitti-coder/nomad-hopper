'use client'

import { useState, Fragment } from 'react'
import { Plus, X, Search, Pencil, CalendarDays } from 'lucide-react'
import RangeCalendar, { todayIso, jpDate } from './RangeCalendar'

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
  // どのカレンダーを開いているか。'trip' は往路と復路をまとめて選ぶもの、
  // 数字は経由地の区間（その区間を出発する日）
  const [openCalendar, setOpenCalendar] = useState<'trip' | number | null>(null)

  const min = todayIso()
  const values: FormValues = { origin, legs, returnDate }
  const ready = origin.trim() !== '' && legs.every(l => l.dest.trim() !== '' && l.date !== '')

  const updateLeg = (i: number, patch: Partial<Leg>) =>
    setLegs(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const addLeg = () => setLegs(prev => [...prev, { dest: '', date: '' }])

  const removeLeg = (i: number) => {
    setLegs(prev => prev.filter((_, idx) => idx !== i))
    setOpenCalendar(null)
  }

  // 往路（1つめの区間の出発日）と復路（帰着日）を1つのカレンダーで受ける
  const setTripRange = (start: string, end: string) => {
    updateLeg(0, { date: start })
    setReturnDate(end)
    // 往路を選び直したら、後ろの区間で辻褄が合わなくなったものは消す
    setLegs(prev => prev.map((l, idx) => (idx > 0 && l.date && l.date < start ? { ...l, date: '' } : l)))
  }

  const tripLabel = !legs[0].date
    ? '日付を選ぶ'
    : returnDate
      ? `${jpDate(legs[0].date)} 〜 ${jpDate(returnDate)}`
      : `${jpDate(legs[0].date)}（片道）`

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
          <Fragment key={i}>
          <div className="rounded-2xl bg-gray-50 p-4 space-y-4">
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

            {/* 1つめの区間の日付は、下の「日程」カレンダーで復路とまとめて選ぶ。
                2つめ以降（経由地）は、その区間を出発する日を同じカレンダーで1日だけ選ぶ */}
            {i > 0 && (
              <div>
                <span className={labelClass}>
                  {legs[i - 1].dest.trim() || '前の行き先'}を出る日
                </span>
                <button
                  type="button"
                  id={`form-date-${i}`}
                  onClick={() => setOpenCalendar(openCalendar === i ? null : i)}
                  className={`${fieldClass} text-left flex items-center gap-2 ${leg.date ? 'text-gray-900' : 'text-gray-400'}`}
                >
                  <CalendarDays size={18} className="shrink-0 text-indigo-500" />
                  {leg.date ? jpDate(leg.date) : '日付を選ぶ'}
                </button>
                {openCalendar === i && (
                  <RangeCalendar
                    mode="single"
                    start={leg.date}
                    end=""
                    min={legs[i - 1].date || min}
                    max={returnDate || undefined}
                    onChange={(s) => updateLeg(i, { date: s })}
                    onDone={() => setOpenCalendar(null)}
                  />
                )}
              </div>
            )}
          </div>

          {/* 1つめの行き先のすぐ下に日程を置く。経由地の欄はそのあとに続く */}
          {i === 0 && (
            <div>
              <span className={labelClass}>日程（帰りを選ばなければ片道）</span>
              <button
                type="button"
                id="form-trip-dates"
                onClick={() => setOpenCalendar(openCalendar === 'trip' ? null : 'trip')}
                className={`${fieldClass} text-left flex items-center gap-2 ${legs[0].date ? 'text-gray-900' : 'text-gray-400'}`}
              >
                <CalendarDays size={18} className="shrink-0 text-indigo-500" />
                {tripLabel}
              </button>
              {openCalendar === 'trip' && (
                <RangeCalendar
                  mode="range"
                  start={legs[0].date}
                  end={returnDate}
                  min={min}
                  onChange={setTripRange}
                  onDone={() => setOpenCalendar(null)}
                />
              )}
            </div>
          )}
          </Fragment>
        ))}

        <button
          type="button"
          onClick={addLeg}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 rounded-full border border-indigo-200 hover:border-indigo-300 px-4 py-2 transition-colors"
        >
          <Plus size={16} />
          経由地を追加
        </button>
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
