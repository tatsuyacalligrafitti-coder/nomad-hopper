'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Search, Loader2, MapPin, Calendar, Users, Plane } from 'lucide-react'
import { parseSearchQuery } from '@/lib/parser'
import type { SearchQuery, ParsedQuery, MultiCityParsedQuery } from '@/types'

const EXAMPLES = [
  '🇹🇭 東京からバンコクへ 来月',
  '🇰🇪 東京からケニアへ 夏休み',
  '🇬🇧 東京からロンドンへ 年末',
  '🇵🇭 大阪からマニラへ 3泊',
]

interface ExploreParams {
  origin?: string
  destination?: string
  rawQuery: string
}

interface Props {
  onSearch: (query: SearchQuery) => void
  onMultiCitySearch?: (query: MultiCityParsedQuery, rawQuery: string) => void
  onExplore?: (params: ExploreParams) => void
  isLoading: boolean
}

export interface SearchBarHandle {
  focus: () => void
  setQuery: (q: string) => void
}

function isMultiCity(p: ParsedQuery | MultiCityParsedQuery | null): p is MultiCityParsedQuery {
  return p !== null && (p as MultiCityParsedQuery).type === 'multi-city'
}

const SearchBar = forwardRef<SearchBarHandle, Props>(function SearchBar(
  { onSearch, onMultiCitySearch, onExplore, isLoading },
  ref,
) {
  const [rawQuery, setRawQuery] = useState('')
  const [parsed, setParsed] = useState<ParsedQuery | MultiCityParsedQuery | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    setQuery: (q: string) => { setRawQuery(q); setParsed(null) },
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

    let p: ParsedQuery | MultiCityParsedQuery | null = parsed

    // Fetch from API if not yet parsed or fields are missing
    if (!p || (!isMultiCity(p) && (!p.origin || !p.destination || !p.departureDate))) {
      setIsParsing(true)
      try {
        const res = await fetch('/api/parse-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: rawQuery }),
        })
        const data = await res.json()
        setParsed(data)
        p = data as ParsedQuery | MultiCityParsedQuery
      } catch {
        // fall through to show error
      } finally {
        setIsParsing(false)
      }
    }

    // Multi-city path
    if (isMultiCity(p)) {
      if (onMultiCitySearch) onMultiCitySearch(p, rawQuery)
      return
    }

    // Single-city validation
    const sq = p as ParsedQuery | null
    if (!sq?.origin) {
      setError('出発地を認識できませんでした（例: 東京から、HND）')
      return
    }
    if (!sq?.destination) {
      setError('目的地を認識できませんでした（例: バンコクへ、BKK）')
      return
    }
    if (!sq?.departureDate) {
      if (onExplore) {
        onExplore({
          origin: sq?.origin ?? undefined,
          destination: sq?.destination ?? undefined,
          rawQuery,
        })
      } else {
        setError('日程を認識できませんでした（例: 12月25日、来週）')
      }
      return
    }

    onSearch({
      origin: sq.origin,
      destination: sq.destination,
      departureDate: sq.departureDate,
      returnDate: sq.returnDate ?? undefined,
      passengers: sq.passengers,
      cabinClass: sq.cabinClass,
      rawQuery,
    })
  }

  // Preview rendering
  const showSinglePreview =
    parsed && !isMultiCity(parsed) &&
    ((parsed as ParsedQuery).origin || (parsed as ParsedQuery).destination || (parsed as ParsedQuery).departureDate)
  const pq = showSinglePreview ? (parsed as ParsedQuery) : null

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

      {/* Multi-city preview */}
      {parsed && isMultiCity(parsed) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 rounded-full px-3 py-1">
            <Plane size={13} style={{ transform: 'rotate(-45deg)' }} />
            <span className="font-semibold">マルチシティ {parsed.segments.length}区間</span>
          </div>
          <span className="text-xs text-gray-500">
            {[parsed.segments[0].origin, ...parsed.segments.map((s) => s.destination)].join(' → ')}
          </span>
        </div>
      )}

      {/* Single-city preview */}
      {pq && (
        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
          {pq.origin && (
            <div className="flex items-center gap-1 bg-green-50 text-green-700 rounded-full px-3 py-1">
              <MapPin size={13} />
              <span>出発: {pq.origin}</span>
            </div>
          )}
          {pq.destination && (
            <div className="flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-3 py-1">
              <MapPin size={13} />
              <span>到着: {pq.destination}</span>
            </div>
          )}
          {pq.departureDate && (
            <div className="flex items-center gap-1 bg-purple-50 text-purple-700 rounded-full px-3 py-1">
              <Calendar size={13} />
              <span>{pq.departureDate}</span>
            </div>
          )}
          {pq.returnDate && (
            <div className="flex items-center gap-1 bg-purple-50 text-purple-700 rounded-full px-3 py-1">
              <Calendar size={13} />
              <span>帰り: {pq.returnDate}</span>
            </div>
          )}
          {pq.passengers > 1 && (
            <div className="flex items-center gap-1 bg-orange-50 text-orange-700 rounded-full px-3 py-1">
              <Users size={13} />
              <span>{pq.passengers}名</span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  )
})

export default SearchBar
