'use client'

import { useState, useRef, useEffect } from 'react'
import { Plane } from 'lucide-react'
import SearchBar, { type SearchBarHandle } from '@/components/SearchBar'
import ModeSelector from '@/components/ModeSelector'
import FlightResults from '@/components/FlightResults'
import AIAnalysis from '@/components/AIAnalysis'
import AIChat from '@/components/AIChat'
import AIExploreChat from '@/components/AIExploreChat'
import MultiCityResults from '@/components/MultiCityResults'
import type { CategorizedFlights, SearchMode, SearchQuery, MultiCityParsedQuery, MultiCitySearchResult } from '@/types'

interface ExploreParams {
  origin?: string
  destination?: string
  rawQuery: string
}

const MODE_HINTS: Record<SearchMode, string> = {
  price:   'お得な最安値の航空券を探します',
  balance: '価格と快適さのバランスで探します',
  elegant: 'ビジネスクラス専用・価格の安い順で表示',
  fastest: '最も早く到着する便を探します',
}

async function fetchFlights(query: SearchQuery): Promise<CategorizedFlights | null> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return data.categorized ?? null
}

export default function HomePage() {
  const [categorized, setCategorized] = useState<CategorizedFlights | null>(null)
  const [baseCategorized, setBaseCategorized] = useState<CategorizedFlights | null>(null)
  const [mode, setMode] = useState<SearchMode>('price')
  const [isLoading, setIsLoading] = useState(false)
  const [elegantLoading, setElegantLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [lastQuery, setLastQuery] = useState<SearchQuery | null>(null)

  const [multiCityResult, setMultiCityResult] = useState<MultiCitySearchResult | null>(null)
  const [isMultiCityLoading, setIsMultiCityLoading] = useState(false)
  const [multiCityError, setMultiCityError] = useState('')

  const [exploreParams, setExploreParams] = useState<ExploreParams | null>(null)
  const [pendingSelections, setPendingSelections] = useState<Record<number, number> | null>(null)

  const searchBarRef = useRef<SearchBarHandle>(null)

  // Auto-search from shared URL (?q=...&sel=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    const sel = params.get('sel')
    if (!q) return

    searchBarRef.current?.setQuery(q)

    if (sel) {
      const indices = sel.split(',').map(n => parseInt(n, 10) || 0)
      const selections: Record<number, number> = {}
      indices.forEach((idx, segIdx) => { if (idx !== 0) selections[segIdx] = idx })
      setPendingSelections(selections)
    }

    fetch('/api/parse-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.type === 'multi-city') handleMultiCitySearch(data)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleModeChange = async (newMode: SearchMode) => {
    const prevMode = mode
    setMode(newMode)

    if (!searched || !lastQuery) {
      searchBarRef.current?.focus()
      return
    }

    if (newMode === 'elegant') {
      setElegantLoading(true)
      setError('')
      try {
        const results = await fetchFlights({ ...lastQuery, cabinClass: 'business' })
        setCategorized(results)
      } catch (err) {
        setError(err instanceof Error ? err.message : '検索に失敗しました')
      } finally {
        setElegantLoading(false)
      }
    } else if (prevMode === 'elegant' && baseCategorized) {
      setCategorized(baseCategorized)
    }
  }

  const handleExplore = (params: ExploreParams) => {
    setExploreParams(params)
    setCategorized(null)
    setSearched(false)
    setMultiCityResult(null)
    setMultiCityError('')
    setError('')
  }

  const handleMultiCitySearch = async (query: MultiCityParsedQuery) => {
    setIsMultiCityLoading(true)
    setMultiCityError('')
    setMultiCityResult(null)
    setCategorized(null)
    setSearched(false)
    setExploreParams(null)
    try {
      const res = await fetch('/api/search-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: query.segments,
          passengers: query.passengers,
          cabinClass: query.cabinClass,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '検索に失敗しました')
      setMultiCityResult(data)
    } catch (err) {
      setMultiCityError(err instanceof Error ? err.message : '検索に失敗しました')
    } finally {
      setIsMultiCityLoading(false)
    }
  }

  const handleSearch = async (query: SearchQuery) => {
    setIsLoading(true)
    setError('')
    setSearched(true)
    setLastQuery(query)
    setMultiCityResult(null)
    setMultiCityError('')
    setExploreParams(null)

    const searchQuery: SearchQuery =
      mode === 'elegant' ? { ...query, cabinClass: 'business' } : query

    try {
      const results = await fetchFlights(searchQuery)
      setCategorized(results)
      if (mode !== 'elegant') setBaseCategorized(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました')
      setCategorized(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <div className="flex items-center gap-2 text-indigo-700">
            <Plane size={22} style={{ transform: 'rotate(-45deg)' }} />
            <span className="text-xl font-extrabold tracking-tight">Nomad Hopper</span>
          </div>
          <span className="text-xs text-gray-400 hidden sm:block">
            話すように航空券を検索
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-5">

        {/* Hero - always visible */}
        <div className="text-center pt-4 pb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
            <Plane size={32} className="text-indigo-600" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">
            話すように<span className="text-indigo-600">検索</span>しよう
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">
            「東京から沖縄 6/23出発」のように入力するだけ
          </p>
        </div>

        {/* Mode selector - always visible */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {searched ? '並び替えモード' : 'どんな旅を探していますか？'}
          </p>
          <ModeSelector selected={mode} onChange={handleModeChange} />
          {!searched && (
            <p className="text-xs text-indigo-500 mt-2 text-center">
              {MODE_HINTS[mode]}
            </p>
          )}
        </div>

        {/* Search bar */}
        <SearchBar
          ref={searchBarRef}
          onSearch={handleSearch}
          onMultiCitySearch={handleMultiCitySearch}
          onExplore={handleExplore}
          isLoading={isLoading || isMultiCityLoading}
        />

        {/* AI Explore Chat — shown when date is ambiguous */}
        {exploreParams && (
          <AIExploreChat
            origin={exploreParams.origin}
            destination={exploreParams.destination}
            rawQuery={exploreParams.rawQuery}
            onSearch={handleSearch}
            onSetQuery={(q) => searchBarRef.current?.setQuery(q)}
          />
        )}

        {/* AI Analysis */}
        {searched && !isLoading && !elegantLoading && categorized && lastQuery && (
          categorized.cheapest.length > 0 ||
          categorized.cheapestDirect.length > 0 ||
          categorized.recommended.length > 0
        ) && (
          <AIAnalysis
            categorized={categorized}
            query={lastQuery}
            onReSearch={(q) => {
              const raw = `${q.origin}から${q.destination} ${q.departureDate}出発${q.returnDate ? ` ${q.returnDate}帰り` : ''}`
              searchBarRef.current?.setQuery(raw)
              handleSearch({
                origin: q.origin,
                destination: q.destination,
                departureDate: q.departureDate,
                returnDate: q.returnDate,
                passengers: lastQuery.passengers,
                cabinClass: lastQuery.cabinClass,
                rawQuery: raw,
              })
            }}
          />
        )}

        {/* Multi-city results */}
        {(isMultiCityLoading || multiCityResult || multiCityError) && (
          <MultiCityResults
            result={multiCityResult}
            isLoading={isMultiCityLoading}
            error={multiCityError}
            initialSelectedFlights={pendingSelections ?? undefined}
            onReSearch={(q) => {
              const raw = `${q.origin}から${q.destination} ${q.departureDate}出発${q.returnDate ? ` ${q.returnDate}帰り` : ''}`
              searchBarRef.current?.setQuery(raw)
              handleSearch({
                origin: q.origin,
                destination: q.destination,
                departureDate: q.departureDate,
                returnDate: q.returnDate,
                passengers: 1,
                cabinClass: 'economy',
                rawQuery: raw,
              })
            }}
          />
        )}

        {/* Results */}
        {searched && (
          <FlightResults
            categorized={categorized}
            isLoading={isLoading || elegantLoading}
            error={error}
            query={lastQuery}
            mode={mode}
            loadingMessage={elegantLoading || (isLoading && mode === 'elegant') ? 'ビジネスクラスを検索中...' : undefined}
          />
        )}

      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 mt-4">
        2025 Nomad Hopper · Powered by Travelpayouts
      </footer>

      {/* AI Chat — fixed position, always rendered */}
      <AIChat query={lastQuery} categorized={categorized} />
    </div>
  )
}
