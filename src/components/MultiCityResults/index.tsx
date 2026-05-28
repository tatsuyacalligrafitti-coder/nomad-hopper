'use client'

import { Loader2, Plane } from 'lucide-react'
import { IATA_JP_NAMES } from '@/lib/iata-names'
import type { MultiCitySearchResult } from '@/types'

interface Props {
  result: MultiCitySearchResult | null
  isLoading: boolean
  error?: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

/** Resolve display label for a city node.
 *  Priority: JP name map → English city from API response → IATA code */
function getCityLabel(
  iata: string,
  cityFromApi: string | undefined,
): string {
  const jp = IATA_JP_NAMES[iata.toUpperCase()]
  if (jp) return jp
  if (cityFromApi) return cityFromApi
  return iata
}

export default function MultiCityResults({ result, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 flex items-center gap-3 text-purple-700">
        <Loader2 size={18} className="animate-spin shrink-0" />
        <span className="text-sm font-medium">各区間を順番に検索中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    )
  }

  if (!result) return null

  // Build city node list: origin of seg[0], then each segment's destination
  const cityNodes: Array<{ iata: string; cityFromApi?: string }> = [
    {
      iata: result.segments[0].origin,
      cityFromApi: result.segments[0].originCity,
    },
    ...result.segments.map((s) => ({ iata: s.destination, cityFromApi: s.destinationCity })),
  ]

  return (
    <div className="rounded-2xl border border-purple-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-purple-600 px-5 py-3 flex items-center gap-2">
        <Plane size={16} className="text-white" style={{ transform: 'rotate(-45deg)' }} />
        <span className="text-white font-bold text-sm">マルチシティ旅程</span>
        <span className="ml-auto text-purple-200 text-xs">{result.segments.length}区間</span>
      </div>

      {/* Timeline */}
      <div className="p-5">
        <div className="space-y-0">
          {cityNodes.map(({ iata, cityFromApi }, ci) => {
            const isLast = ci === cityNodes.length - 1
            const seg = !isLast ? result.segments[ci] : null
            const flight = seg?.cheapestFlight ?? null
            const carrier = flight?.segments[0]?.carrierName ?? ''
            const duration = flight?.totalDuration ?? 0
            const label = getCityLabel(iata, cityFromApi)

            return (
              <div key={ci}>
                {/* City node */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-3 h-3 rounded-full bg-purple-600 ring-2 ring-purple-200" />
                    {!isLast && <div className="w-0.5 bg-purple-200 flex-1 min-h-[60px]" />}
                  </div>
                  <div className="pb-0">
                    <p className="font-bold text-gray-900 text-sm">
                      {label}
                      <span className="ml-1.5 text-xs font-normal text-gray-400">({iata})</span>
                    </p>
                  </div>
                </div>

                {/* Flight connector (between cities) */}
                {seg && (
                  <div className="flex items-stretch gap-3">
                    {/* Left rail */}
                    <div className="flex flex-col items-center shrink-0 w-3">
                      <div className="w-0.5 bg-purple-200 flex-1" />
                    </div>
                    {/* Flight card */}
                    <div className="flex-1 ml-0 mb-2">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 my-1">
                        {flight ? (
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="space-y-0.5">
                              <p className="text-xs text-gray-500">
                                {formatDate(seg.date)} 出発
                                {carrier && <span className="ml-1.5 font-medium text-gray-700">{carrier}</span>}
                              </p>
                              {duration > 0 && (
                                <p className="text-xs text-gray-400">所要 {formatDuration(duration)}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-base font-bold text-purple-700 tabular-nums">
                                ¥{Math.round(seg.cheapestPrice!).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-400">片道最安値</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">{formatDate(seg.date)} 出発</p>
                            <p className="text-xs text-gray-400">便が見つかりませんでした</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Total */}
        {result.totalPrice > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">合計（各区間最安値の合算）</p>
              <p className="text-2xl font-bold text-purple-700 tabular-nums">
                ¥{Math.round(result.totalPrice).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">1区間平均</p>
              <p className="text-sm font-semibold text-gray-600 tabular-nums">
                ¥{Math.round(result.totalPrice / result.segments.length).toLocaleString()}/区間
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
