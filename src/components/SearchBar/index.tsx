'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Search, Loader2, MapPin, Calendar, Users } from 'lucide-react'
import { parseSearchQuery } from '@/lib/parser'
import type { SearchQuery, ParsedQuery } from '@/types'

const EXAMPLES = [
  '東京からバンコクへ 12月25日 1名',
  '成田→ロンドン 来月 ビジネスクラス',
  '大阪からソウル 3日後',
  '羽田からシンガポール 1/15 2名',
]

interface Props {
  onSearch: (query: SearchQuery) => void
  isLoading: boolean
}

export interface SearchBarHandle {
  focus: () => void
}

const SearchBar = forwardRef<SearchBarHandle, Props>(function SearchBar(
  { onSearch, isLoading },
  ref,
) {
  const [rawQuery, setRawQuery] = useState('')
  const [parsed, setParsed] = useState<ParsedQuery | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  useEffect(() => {
    if (!rawQuery.trim()) {
      setParsed(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsParsing(true)
      try {
        const res = await fetch('/api/parse-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: rawQuery }),
        })
        const data = await res.json()
        setParsed(data)
      } finally {
        setIsParsing(false)
      }
    }, 500)
  }, [rawQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Use debounced parsed state if available, otherwise call the API directly.
    // Never fall back to the client-side parser alone — it lacks the airport DB.
    let p = parsed
    if (!p || !p.origin || !p.destination || !p.departureDate) {
      setIsParsing(true)
      try {
        const res = await fetch('/api/parse-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: rawQuery }),
        })
        const data = await res.json()
        setParsed(data)
        p = data
      } catch {
        // fall through to show error below
      } finally {
        setIsParsing(false)
      }
    }

    if (!p?.origin) {
      setError('出発地を認識できませんでした（例: 東京から、HND）')
      return
    }
    if (!p?.destination) {
      setError('目的地を認識できませんでした（例: バンコクへ、BKK）')
      return
    }
    if (!p?.departureDate) {
      setError('日程を認識できませんでした（例: 12月25日、来週）')
      return
    }

    onSearch({
      origin: p.origin,
      destination: p.destination,
      departureDate: p.departureDate,
      returnDate: p.returnDate ?? undefined,
      passengers: p.passengers,
      cabinClass: p.cabinClass,
      rawQuery,
    })
  }

  return (
    <div className="w-full space-y-3">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2 bg-white rounded-2xl shadow-lg border border-gray-200 px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-400 transition-all">
          <Search className="text-gray-400 shrink-0" size={20} />
          <input
            ref={inputRef}
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="例: 東京からバンコクへ 12月25日 1名"
            className="flex-1 outline-none text-gray-800 text-base placeholder-gray-400 bg-transparent"
          />
          {isParsing && <Loader2 className="text-indigo-400 animate-spin shrink-0" size={16} />}
          <button
            type="submit"
            disabled={isLoading || !rawQuery.trim()}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-colors flex items-center gap-1.5"
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            検索
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setRawQuery(ex)}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full px-3 py-1 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {parsed && (parsed.origin || parsed.destination || parsed.departureDate) && (
        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
          {parsed.origin && (
            <div className="flex items-center gap-1 bg-green-50 text-green-700 rounded-full px-3 py-1">
              <MapPin size={13} />
              <span>出発: {parsed.origin}</span>
            </div>
          )}
          {parsed.destination && (
            <div className="flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-3 py-1">
              <MapPin size={13} />
              <span>到着: {parsed.destination}</span>
            </div>
          )}
          {parsed.departureDate && (
            <div className="flex items-center gap-1 bg-purple-50 text-purple-700 rounded-full px-3 py-1">
              <Calendar size={13} />
              <span>{parsed.departureDate}</span>
            </div>
          )}
          {parsed.returnDate && (
            <div className="flex items-center gap-1 bg-purple-50 text-purple-700 rounded-full px-3 py-1">
              <Calendar size={13} />
              <span>帰り: {parsed.returnDate}</span>
            </div>
          )}
          {parsed.passengers > 1 && (
            <div className="flex items-center gap-1 bg-orange-50 text-orange-700 rounded-full px-3 py-1">
              <Users size={13} />
              <span>{parsed.passengers}名</span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  )
})

export default SearchBar
