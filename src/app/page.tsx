'use client'

import { useState, useRef, useEffect } from 'react'
import { Plane } from 'lucide-react'
import SearchBar, { type SearchBarHandle } from '@/components/SearchBar'
import ModeSelector from '@/components/ModeSelector'
import FlightResults from '@/components/FlightResults'
import AIAnalysis from '@/components/AIAnalysis'
import AIChat, { type AIChatHandle } from '@/components/AIChat'
import AIExploreChat from '@/components/AIExploreChat'
import MultiCityResults from '@/components/MultiCityResults'
import AlertModal from '@/components/AlertModal'
import OnboardingModal from '@/components/OnboardingModal'
import type { CategorizedFlights, SearchMode, SearchQuery, MultiCityParsedQuery, MultiCitySearchResult, FlightResult } from '@/types'

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

function selectByMode(flights: FlightResult[], mode: SearchMode): number {
  if (flights.length === 0) return 0

  if (mode === 'fastest') {
    let bestIdx = 0
    for (let i = 1; i < flights.length; i++) {
      const curr = flights[i], best = flights[bestIdx]
      const stopDiff = (curr.stops ?? 0) - (best.stops ?? 0)
      if (stopDiff < 0) { bestIdx = i; continue }
      if (stopDiff === 0 && (curr.totalDuration || 0) < (best.totalDuration || 0)) bestIdx = i
    }
    return bestIdx
  }

  let bestIdx = 0
  let bestScore = Infinity
  flights.forEach((f, i) => {
    const score =
      mode === 'balance' ? f.totalPrice + f.totalDuration * 80 :
      f.totalPrice
    if (score < bestScore) { bestScore = score; bestIdx = i }
  })
  return bestIdx
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

const SUBCOPY = [
  '行けるかも、をさがそう。',
  '話しかけるだけで、旅が始まる。',
  'あなたの次の冒険、一緒に探します。',
]

function RotatingSubcopy() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % SUBCOPY.length)
        setVisible(true)
      }, 400)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <p
      className="text-gray-500 text-lg transition-opacity duration-400"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {SUBCOPY[index]}
    </p>
  )
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
  const [baseMultiCityResult, setBaseMultiCityResult] = useState<MultiCitySearchResult | null>(null)
  const [lastMultiCityParsedQuery, setLastMultiCityParsedQuery] = useState<MultiCityParsedQuery | null>(null)
  const [multiCityForcedSelections, setMultiCityForcedSelections] = useState<Record<number, number> | null>(null)
  const [isMultiCityLoading, setIsMultiCityLoading] = useState(false)
  const [multiCityError, setMultiCityError] = useState('')
  const [multiCityRawQuery, setMultiCityRawQuery] = useState<string | null>(null)
  const [retryingSegments, setRetryingSegments] = useState<Set<number>>(new Set())
  const [multiCityWarning, setMultiCityWarning] = useState<{ message: string; consultMessage: string; contextSummary: string } | null>(null)

  const [exploreParams, setExploreParams] = useState<ExploreParams | null>(null)
  const [pendingSelections, setPendingSelections] = useState<Record<number, number> | null>(null)

  const [lineCallbackFlight, setLineCallbackFlight] = useState<FlightResult | null>(null)
  const [lineCallbackUserId, setLineCallbackUserId] = useState('')
  const [lineCallbackDisplayName, setLineCallbackDisplayName] = useState('')

  const [showOnboarding, setShowOnboarding] = useState(false)

  const searchBarRef = useRef<SearchBarHandle>(null)
  const aiChatRef = useRef<AIChatHandle>(null)

  // Auto-search from shared URL (?q=...&sel=...) and LINE OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // LINE OAuth callback
    const lineUserId = params.get('line_user_id')
    if (lineUserId) {
      const lineDisplayName = params.get('line_display_name') ?? ''
      try {
        const saved = sessionStorage.getItem('line_oauth_flight')
        if (saved) {
          setLineCallbackFlight(JSON.parse(saved))
          setLineCallbackUserId(lineUserId)
          setLineCallbackDisplayName(lineDisplayName)
          sessionStorage.removeItem('line_oauth_flight')
        }
      } catch {}
      window.history.replaceState({}, '', '/')
      return
    }

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

    // ── Multi-city path ───────────────────────────────────────────────────────
    if (multiCityResult) {
      if (newMode === 'elegant') {
        if (!lastMultiCityParsedQuery) return
        setBaseMultiCityResult(multiCityResult)
        setIsMultiCityLoading(true)
        setMultiCityError('')
        try {
          const res = await fetch('/api/search-multi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              segments: lastMultiCityParsedQuery.segments,
              passengers: lastMultiCityParsedQuery.passengers,
              cabinClass: 'business',
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? '検索に失敗しました')
          setMultiCityResult(data)
          const zeroSels: Record<number, number> = {}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.segments.forEach((_: any, i: number) => { zeroSels[i] = 0 })
          setMultiCityForcedSelections(zeroSels)
        } catch (err) {
          setMultiCityError(err instanceof Error ? err.message : '検索に失敗しました')
        } finally {
          setIsMultiCityLoading(false)
        }
      } else if (baseMultiCityResult) {
        const selections: Record<number, number> = {}
        if (newMode === 'fastest') {
          const fastestResult: MultiCitySearchResult = {
            ...baseMultiCityResult,
            segments: baseMultiCityResult.segments.map(seg => {
              const top5 = [...(seg.top5Flights ?? [])].sort((a, b) => {
                const sd = (a.stops ?? 0) - (b.stops ?? 0)
                return sd !== 0 ? sd : (a.totalDuration || 0) - (b.totalDuration || 0)
              })
              return { ...seg, top5Flights: top5, cheapestFlight: top5[0] ?? null, cheapestPrice: top5[0]?.totalPrice ?? seg.cheapestPrice }
            }),
          }
          setMultiCityResult(fastestResult)
          fastestResult.segments.forEach((_, idx) => { selections[idx] = 0 })
        } else {
          // Use reference comparison instead of prevMode to detect if we're
          // currently showing business (elegant) results.
          if (multiCityResult !== baseMultiCityResult) {
            setMultiCityResult(baseMultiCityResult)
          }
          baseMultiCityResult.segments.forEach((seg, idx) => {
            selections[idx] = selectByMode(seg.top5Flights ?? [], newMode)
          })
        }
        setMultiCityForcedSelections(selections)
      } else if (lastMultiCityParsedQuery) {
        // Fallback: no economy base data — re-fetch with original cabin class
        setIsMultiCityLoading(true)
        setMultiCityError('')
        try {
          const res = await fetch('/api/search-multi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              segments: lastMultiCityParsedQuery.segments,
              passengers: lastMultiCityParsedQuery.passengers,
              cabinClass: lastMultiCityParsedQuery.cabinClass,
            }),
          })
          const data = await res.json() as MultiCitySearchResult
          if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? '検索に失敗しました')
          setMultiCityResult(data)
          setBaseMultiCityResult(data)
          const selections: Record<number, number> = {}
          data.segments.forEach((seg, idx) => {
            selections[idx] = selectByMode(seg.top5Flights ?? [], newMode)
          })
          setMultiCityForcedSelections(selections)
        } catch (err) {
          setMultiCityError(err instanceof Error ? err.message : '検索に失敗しました')
        } finally {
          setIsMultiCityLoading(false)
        }
      }
      return
    }

    // ── Single-city path ──────────────────────────────────────────────────────
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

  const handleMultiCitySearch = async (query: MultiCityParsedQuery, rawQuery?: string) => {
    setIsMultiCityLoading(true)
    setMultiCityError('')
    setMultiCityResult(null)
    setMultiCityForcedSelections(null)
    setLastMultiCityParsedQuery(query)
    if (rawQuery !== undefined) setMultiCityRawQuery(rawQuery)
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
      setBaseMultiCityResult(data)
    } catch (err) {
      setMultiCityError(err instanceof Error ? err.message : '検索に失敗しました')
    } finally {
      setIsMultiCityLoading(false)
    }
  }

  const handleReorderSearch = async (newSegments: Array<{ origin: string; destination: string; date: string }>) => {
    if (!lastMultiCityParsedQuery) return
    setIsMultiCityLoading(true)
    setMultiCityError('')
    try {
      const res = await fetch('/api/search-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: newSegments,
          passengers: lastMultiCityParsedQuery.passengers,
          cabinClass: lastMultiCityParsedQuery.cabinClass,
        }),
      })
      const data = await res.json() as MultiCitySearchResult
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? '検索に失敗しました')
      setMultiCityResult(data)
      setBaseMultiCityResult(data)
      const zeroSels: Record<number, number> = {}
      data.segments.forEach((_, i) => { zeroSels[i] = 0 })
      setMultiCityForcedSelections(zeroSels)
    } catch (err) {
      setMultiCityError(err instanceof Error ? err.message : '検索に失敗しました')
    } finally {
      setIsMultiCityLoading(false)
    }
  }

  const retrySegment = async (segmentIndex: number, newDate?: string, newOrigin?: string, newDest?: string) => {
    if (!multiCityResult || !lastMultiCityParsedQuery) return
    const seg = multiCityResult.segments[segmentIndex]
    const origin = newOrigin ?? seg.origin
    const destination = newDest ?? seg.destination
    const date = newDate ?? seg.date

    setRetryingSegments(prev => new Set([...prev, segmentIndex]))
    setMultiCityWarning(null)
    try {
      const res = await fetch('/api/search-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: [{ origin, destination, date }],
          passengers: lastMultiCityParsedQuery.passengers,
          cabinClass: lastMultiCityParsedQuery.cabinClass,
        }),
      })
      const data = await res.json()
      if (!res.ok) return
      const newSeg = data.segments?.[0]
      if (!newSeg) return
      setMultiCityResult(prev => {
        if (!prev) return prev
        const segs = [...prev.segments]
        segs[segmentIndex] = newSeg
        const newTotal = segs.reduce((sum, s) => sum + (s.cheapestPrice ?? 0), 0)
        return { ...prev, segments: segs, totalPrice: newTotal }
      })
      // Check date conflict with the next segment
      if (newDate) {
        const nextSeg = multiCityResult.segments[segmentIndex + 1]
        if (nextSeg) {
          const diffDays = Math.floor(
            (new Date(nextSeg.date).getTime() - new Date(newDate).getTime()) / 86400000
          )
          if (diffDays < 2) {
            const segLabel = `区間${segmentIndex + 1}`
            const nextLabel = `区間${segmentIndex + 2}`
            // Build itinerary summary for AI context
            const AIRPORT_NAMES: Record<string, string> = {
              HND:'東京羽田', NRT:'東京成田', KIX:'大阪関西',
              ITM:'大阪伊丹', NGO:'名古屋', FUK:'福岡',
              CTS:'札幌', OKA:'那覇', BKK:'バンコク',
              ICN:'ソウル仁川', GMP:'ソウル金浦',
              SIN:'シンガポール', KUL:'クアラルンプール',
              DPS:'バリ', MNL:'マニラ', HAN:'ハノイ',
              SGN:'ホーチミン', NBO:'ナイロビ',
              DXB:'ドバイ', LHR:'ロンドン', CDG:'パリ',
              JFK:'ニューヨーク', LAX:'ロサンゼルス',
              SYD:'シドニー', PRG:'プラハ',
            }
            const apName = (code: string) => {
              const name = AIRPORT_NAMES[code.toUpperCase()]
              return name ? `${name}(${code})` : code
            }
            const summaryLines: string[] = ['旅程：']
            multiCityResult.segments.forEach((seg, i) => {
              const segDate = i === segmentIndex ? newDate : seg.date
              const segResult = i === segmentIndex ? newSeg : seg
              const airline = segResult.cheapestFlight?.segments[0]?.carrierName ?? '未定'
              const price = segResult.cheapestPrice != null
                ? `¥${Math.round(segResult.cheapestPrice).toLocaleString()}`
                : '便なし'
              summaryLines.push(`区間${i + 1}: ${apName(seg.origin)}→${apName(seg.destination)} ${segDate} ${airline} ${price}`)
            })
            const totalForSummary = multiCityResult.segments.reduce((sum, seg, i) => {
              const p = i === segmentIndex ? (newSeg.cheapestPrice ?? 0) : (seg.cheapestPrice ?? 0)
              return sum + p
            }, 0)
            summaryLines.push(`合計：¥${Math.round(totalForSummary).toLocaleString()}`)
            summaryLines.push(`${segLabel}を${newDate}に変更したことで日程の競合が発生しました。`)
            setMultiCityWarning({
              message: `${segLabel}の日程変更により、${nextLabel}まで${diffDays}日しかありません。AIに旅程全体の最適化を相談しますか？`,
              consultMessage: `${segLabel}を${newDate}に変更しました。旅程全体の日程を最適化してください。`,
              contextSummary: summaryLines.join('\n'),
            })
          }
        }
      }
    } catch {
      // silently ignore
    } finally {
      setRetryingSegments(prev => {
        const next = new Set(prev)
        next.delete(segmentIndex)
        return next
      })
    }
  }

  const handleChatSearch = async (rawQuery: string) => {
    searchBarRef.current?.setQuery(rawQuery)
    try {
      const res = await fetch('/api/parse-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: rawQuery }),
      })
      const parsed = await res.json()
      if (parsed?.type === 'multi-city') {
        handleMultiCitySearch(parsed, rawQuery)
      } else if (parsed?.origin && parsed?.destination && parsed?.departureDate) {
        handleSearch(parsed)
      }
      // If parse returns incomplete data (no date/airports), leave the query
      // in the search bar so the user can refine it manually — no error shown.
    } catch {
      // Network or parse error: silently leave query in search bar
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
            <span className="text-xl font-extrabold tracking-tight">Tobira</span>
          </div>
          <span className="text-xs text-gray-400 hidden sm:block">
            世界への扉を、あなたの手に。
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-5">

        {/* Hero - always visible */}
        <div className="text-center pt-6 pb-6 bg-gradient-to-b from-white via-indigo-50/30 to-white rounded-3xl">
          <div className="relative inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
            <Plane size={32} className="text-indigo-600" style={{ transform: 'rotate(-45deg)' }} />
            <span className="absolute -top-2 -right-1 text-indigo-300 text-xs animate-float1">✦</span>
            <span className="absolute -bottom-1 -right-3 text-indigo-200 text-xs animate-float2">✦</span>
            <span className="absolute -top-1 -left-3 text-indigo-300 text-xs animate-float3">✦</span>
            <span className="absolute bottom-0 -left-2 text-indigo-200 text-[10px] animate-float4">✦</span>
          </div>
          <h1 className="font-bold text-4xl text-gray-900 mb-3">
            世界は思ったより、<span className="text-indigo-600">近い。</span>
          </h1>
          <RotatingSubcopy />
        </div>

        {/* Mode selector - always visible */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            どんな旅を探していますか？
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
            forcedSelections={multiCityForcedSelections}
            mode={mode}
            rawQuery={multiCityRawQuery ?? undefined}
            onRetrySegment={retrySegment}
            retryingSegments={retryingSegments}
            warningMessage={multiCityWarning?.message}
            aiConsultMessage={multiCityWarning?.consultMessage}
            onDismissWarning={() => setMultiCityWarning(null)}
            onOpenFloatingChat={(msg) => aiChatRef.current?.openWithMessage(msg, multiCityWarning?.contextSummary)}
            onReorderSearch={handleReorderSearch}
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

      <div className="text-center py-6 border-t border-gray-100">
        <a
          href="https://forms.gle/onzBchqN7EL3yUtj8"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 rounded-full px-5 py-2 transition-colors hover:bg-indigo-50"
        >
          📝 使ってみた感想を教えてください
        </a>
      </div>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 mt-4">
        2026 Tobira · 世界への扉を、あなたの手に。
      </footer>

      {/* AI Chat — fixed position, always rendered */}
      <AIChat
        ref={aiChatRef}
        query={lastQuery}
        categorized={categorized}
        onSearchQuery={handleChatSearch}
        onExploreMode={(rawQuery) => {
          searchBarRef.current?.setQuery(rawQuery)
          handleExplore({ rawQuery })
        }}
      />

      {/* Onboarding modal + help button */}
      <OnboardingModal forcedOpen={showOnboarding} onForcedClose={() => setShowOnboarding(false)} />

      {/* LINE OAuth callback: auto-open alert modal with pre-filled userId */}
      {lineCallbackFlight && lineCallbackUserId && (
        <AlertModal
          flight={lineCallbackFlight}
          onClose={() => { setLineCallbackFlight(null); setLineCallbackUserId('') }}
          prefilledLineUserId={lineCallbackUserId}
          prefilledLineDisplayName={lineCallbackDisplayName}
        />
      )}
    </div>
  )
}
