'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Search, Loader2, MapPin, Calendar, Users, Plane } from 'lucide-react'
import { parseSearchQuery } from '@/lib/parser'
import type { SearchQuery, ParsedQuery, MultiCityParsedQuery, UnifiedQuery } from '@/types'

function unifiedToSearchBarFormat(uq: UnifiedQuery): ParsedQuery | MultiCityParsedQuery {
  if (uq.type === 'multi-city') {
    return {
      type: 'multi-city',
      segments: uq.legs.map(l => ({ origin: l.origin, destination: l.destination, date: l.date })),
      passengers: uq.passengers ?? 1,
      cabinClass: uq.cabinClass ?? 'economy',
    }
  }
  const dep = uq.legs[0]
  // LLM returns date_role:'departure' for both legs of round-trip; fallback to legs[1]
  const ret = uq.legs.find(l => l.date_role === 'arrival') ?? (uq.type === 'round-trip' ? uq.legs[1] : undefined)
  return {
    origin: dep?.origin ?? null,
    destination: dep?.destination ?? null,
    departureDate: dep?.date ?? null,
    returnDate: ret?.date ?? null,
    passengers: uq.passengers ?? 1,
    cabinClass: uq.cabinClass ?? 'economy',
  }
}

const PLACEHOLDER_EXAMPLES = [
  '東京からバンコクへ 12月25日 1名',
  '予算10万円でGWに南の島へのんびり行きたい',
  '福岡→ソウル→台北→東京 来月 一人旅',
  '9月に涼しくて物価が安い国へ行きたい、3泊くらい',
  '大阪発 ビジネスクラス ロンドン 最速で',
  '子連れで安心して行けるアジアのリゾートは？',
  '成田からシンガポール 来月15日 2名',
  '年末年始に海外でゆっくりしたい、予算15万円',
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

// 曖昧な日付表現を含み、具体的な日付（数字+月/日）がない場合にtrue
function hasAmbiguousDate(query: string): boolean {
  const ambiguous = /来週|今週末|今週|週末|近いうち|そのうち|いつか/
  const specificDate = /\d+\s*[月日]/
  const weekday = /月曜日?|火曜日?|水曜日?|木曜日?|金曜日?|土曜日?|日曜日?/
  return ambiguous.test(query) && !specificDate.test(query) && !weekday.test(query)
}

const SearchBar = forwardRef<SearchBarHandle, Props>(function SearchBar(
  { onSearch, onMultiCitySearch, onExplore, isLoading },
  ref,
) {
  const [rawQuery, setRawQuery] = useState('')
  const [parsed, setParsed] = useState<ParsedQuery | MultiCityParsedQuery | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track which rawQuery was last parsed to detect stale state
  const lastParsedRawRef = useRef<string>('')

  // Typewriter placeholder animation — stops while user is typing
  useEffect(() => {
    if (rawQuery) {
      setPlaceholder('')
      return
    }
    let exIdx = 0
    let charIdx = 0
    let deleting = false
    let tid: ReturnType<typeof setTimeout> | null = null

    function tick() {
      const text = PLACEHOLDER_EXAMPLES[exIdx]
      if (!deleting) {
        charIdx++
        setPlaceholder(text.slice(0, charIdx))
        if (charIdx === text.length) {
          deleting = true
          tid = setTimeout(tick, 2400)
        } else {
          tid = setTimeout(tick, 60)
        }
      } else {
        charIdx--
        setPlaceholder(text.slice(0, charIdx))
        if (charIdx === 0) {
          deleting = false
          exIdx = (exIdx + 1) % PLACEHOLDER_EXAMPLES.length
          tid = setTimeout(tick, 400)
        } else {
          tid = setTimeout(tick, 28)
        }
      }
    }

    tid = setTimeout(tick, 60)
    return () => { if (tid !== null) clearTimeout(tid) }
  }, [rawQuery])

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    setQuery: (q: string) => { setRawQuery(q); setParsed(null); lastParsedRawRef.current = '' },
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
        const data: UnifiedQuery = await res.json()
        lastParsedRawRef.current = rawQuery
        setParsed(unifiedToSearchBarFormat(data))
      } finally {
        setIsParsing(false)
      }
    }, 500)
  }, [rawQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    let p: ParsedQuery | MultiCityParsedQuery | null = parsed

    // Fetch from API if: not yet parsed, fields are missing, OR rawQuery changed since last parse
    // (prevents stale parsed state from a previous query being used — e.g. FSZ origin bug)
    const queryChanged = lastParsedRawRef.current !== rawQuery
    if (!p || queryChanged || (!isMultiCity(p) && (!p.origin || !p.destination || !p.departureDate))) {
      setIsParsing(true)
      try {
        const res = await fetch('/api/parse-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: rawQuery }),
        })
        const data: UnifiedQuery = await res.json()
        const converted = unifiedToSearchBarFormat(data)
        setParsed(converted)
        p = converted
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

    // Any required field missing → explore fallback when available
    if (!sq?.origin || !sq?.destination || !sq?.departureDate) {
      if (onExplore) {
        onExplore({ origin: sq?.origin ?? undefined, destination: sq?.destination ?? undefined, rawQuery })
      } else {
        if (!sq?.origin)        setError('出発地を認識できませんでした（例: 東京から、HND）')
        else if (!sq?.destination) setError('目的地を認識できませんでした（例: バンコクへ、BKK）')
        else                    setError('日程を認識できませんでした（例: 12月25日、来週）')
      }
      return
    }

    // 出発地・目的地が確定しているが日付が曖昧な場合 → 旅の相談モードへ
    if (hasAmbiguousDate(rawQuery) && onExplore) {
      onExplore({ origin: sq.origin, destination: sq.destination, rawQuery })
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
            placeholder={placeholder}
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
