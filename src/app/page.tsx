'use client'

import { useState, useMemo, useRef } from 'react'
import { Plane } from 'lucide-react'
import SearchBar, { type SearchBarHandle } from '@/components/SearchBar'
import ModeSelector from '@/components/ModeSelector'
import FlightResults from '@/components/FlightResults'
import { sortFlights } from '@/lib/sorting'
import type { FlightResult, SearchMode, SearchQuery } from '@/types'

const MODE_HINTS: Record<SearchMode, string> = {
  price:   'お得な最安値の航空券を探します',
  balance: '価格と快適さのバランスで探します',
  elegant: '快適で所要時間の短い便を探します',
  fastest: '最も早く到着する便を探します',
}

export default function HomePage() {
  const [rawFlights, setRawFlights] = useState<FlightResult[]>([])
  const [mode, setMode] = useState<SearchMode>('price')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [lastQuery, setLastQuery] = useState<SearchQuery | null>(null)

  const searchBarRef = useRef<SearchBarHandle>(null)

  const flights = useMemo(
    () => sortFlights(rawFlights, mode),
    [rawFlights, mode],
  )

  const handleModeChange = (newMode: SearchMode) => {
    setMode(newMode)
    if (!searched) {
      searchBarRef.current?.focus()
    }
  }

  const handleSearch = async (query: SearchQuery) => {
    setIsLoading(true)
    setError('')
    setSearched(true)
    setLastQuery(query)

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRawFlights(data.flights ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました')
      setRawFlights([])
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

        {/* Results */}
        {searched && (
          <FlightResults
            flights={flights}
            isLoading={isLoading}
            error={error}
            query={lastQuery}
          />
        )}

      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 mt-4">
        2025 Nomad Hopper · Powered by Travelpayouts
      </footer>
    </div>
  )
}
