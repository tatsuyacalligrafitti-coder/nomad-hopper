'use client'

import { useState, useRef } from 'react'
import { Plane } from 'lucide-react'
import SearchBar, { type SearchBarHandle } from '@/components/SearchBar'
import ModeSelector from '@/components/ModeSelector'
import FlightResults from '@/components/FlightResults'
import AIAnalysis from '@/components/AIAnalysis'
import AIChat from '@/components/AIChat'
import type { CategorizedFlights, SearchMode, SearchQuery } from '@/types'

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

  const searchBarRef = useRef<SearchBarHandle>(null)

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

  const handleSearch = async (query: SearchQuery) => {
    setIsLoading(true)
    setError('')
    setSearched(true)
    setLastQuery(query)

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
          isLoading={isLoading}
        />

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
