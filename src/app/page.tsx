'use client'

import { useState } from 'react'
import { Plane } from 'lucide-react'
import SearchBar from '@/components/SearchBar'
import ModeSelector from '@/components/ModeSelector'
import FlightResults from '@/components/FlightResults'
import type { FlightResult, SearchMode, SearchQuery } from '@/types'

export default function HomePage() {
  // Default to 'price' — most users want cheapest first
  const [mode, setMode] = useState<SearchMode>('price')
  const [flights, setFlights] = useState<FlightResult[]>([])
  const [cheapest, setCheapest] = useState<FlightResult[]>([])
  const [isMock, setIsMock] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [lastQuery, setLastQuery] = useState<SearchQuery | null>(null)

  async function fetchFlights(query: SearchQuery, searchMode: SearchMode) {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode: searchMode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data
  }

  const handleSearch = async (query: SearchQuery) => {
    setIsLoading(true)
    setError('')
    setHasSearched(true)
    setLastQuery(query)

    try {
      const data = await fetchFlights(query, mode)
      setFlights(data.flights)
      setCheapest(data.cheapest ?? [])
      setIsMock(!!data.isMock)
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました')
      setFlights([])
      setCheapest([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleModeChange = async (newMode: SearchMode) => {
    setMode(newMode)
    if (!lastQuery) return
    setIsLoading(true)
    try {
      const data = await fetchFlights(lastQuery, newMode)
      setFlights(data.flights)
      setCheapest(data.cheapest ?? [])
      setIsMock(!!data.isMock)
    } catch {
      // keep existing results on re-sort failure
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <div className="flex items-center gap-2 text-indigo-700">
            <Plane size={22} className="-rotate-45" />
            <span className="text-xl font-extrabold tracking-tight">Nomad Hopper</span>
          </div>
          <span className="text-xs text-gray-400 hidden sm:block">— 話すように航空券を検索</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-5">
        {/* ── Hero (first visit only) ──────────────────────────────────────── */}
        {!hasSearched && (
          <div className="text-center pt-4 pb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
              <Plane size={32} className="text-indigo-600 -rotate-45" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">
              話すように<span className="text-indigo-600">検索</span>しよう
            </h1>
            <p className="text-gray-500 text-sm sm:text-base">
              「東京から沖縄 6/23出発 6/27帰り」のように入力するだけ
            </p>
          </div>
        )}

        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <SearchBar onSearch={handleSearch} isLoading={isLoading} />

        {/* ── Mode selector ────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            並び替えモード
          </p>
          <ModeSelector selected={mode} onChange={handleModeChange} />
        </div>

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {hasSearched && (
          <div className="space-y-3">
            {/* Mock data banner */}
            {isMock && !isLoading && flights.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
                <span className="text-base shrink-0">🧪</span>
                <span>
                  テストモードのため実際の空席データが限定的です。表示価格・時刻はデモ用サンプルです。
                  上の「実際の価格で検索」から各サービスで正式な空席・料金をご確認ください。
                </span>
              </div>
            )}

            <FlightResults
              flights={flights}
              cheapest={cheapest}
              isLoading={isLoading}
              error={error}
              query={lastQuery}
            />
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 mt-4">
        © 2025 Nomad Hopper · Powered by Duffel
      </footer>
    </div>
  )
}
