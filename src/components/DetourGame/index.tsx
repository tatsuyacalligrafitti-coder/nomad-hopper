'use client'

// 遊び「逆探知1段」— ask for a destination, get one alternative route with a
// single stopover, and see the gap against going straight there.
//
// Everything shown here is an estimate from cached fares. The wording is written
// so that a reader who skims still cannot mistake it for a bookable price, and
// so that the two-separate-tickets risk is never off-screen when a plan is shown.

import { useState } from 'react'
import { ArrowRight, Loader2, Plane } from 'lucide-react'
import DetourMap from '@/components/DetourMap'
import type { DetourResponse, LegQuote } from '@/types'

const YEN = (n: number) => `¥${n.toLocaleString('ja-JP')}`

function formatDate(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return `${Number(m)}月${Number(d)}日`
}

const ESTIMATE_NOTE =
  '概算です。過去に観測された最安値をもとにした目安で、いま買える価格ではありません。実際の価格は検索画面でご確認ください。'

function EstimateTag() {
  return (
    <span className="shrink-0 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
      概算
    </span>
  )
}

function LegCard({ leg, label }: { leg: LegQuote; label: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-xs text-gray-500">{formatDate(leg.departDate)}ごろ</span>
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <span>{leg.origin}</span>
        <ArrowRight size={14} className="text-gray-400" />
        <span>{leg.destination}</span>
        <span className="ml-auto tabular-nums">{YEN(leg.price)}</span>
      </div>
      <a
        href={leg.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-blue-600 underline underline-offset-2"
      >
        この区間を検索する
      </a>
    </div>
  )
}

/** `defaultMonth` (YYYY-MM) comes from the server on JST so the two renders agree. */
export default function DetourGame({ defaultMonth }: { defaultMonth: string }) {
  const [origin, setOrigin] = useState('東京')
  const [destination, setDestination] = useState('')
  const [month, setMonth] = useState(defaultMonth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DetourResponse | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/game/detour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, month }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '検索に失敗しました')
        return
      }
      setResult(json as DetourResponse)
    } catch {
      setError('通信に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const outcome = result?.outcome

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">出発地</span>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="東京"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">行き先</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="バンコク"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">時期</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading || !destination.trim() || !month}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plane size={16} />}
          {loading ? '経由地をさがしています…' : '安いルートをさがす'}
        </button>
        <p className="text-xs text-gray-500">片道で比べます。大人1名・エコノミー。</p>
      </form>

      {/* Directly under the form and never conditional: the map is the ground the
          page stands on, so it must not appear and disappear with the result. It
          draws whatever the last answer gave us — a detour, a direct hop, or
          nothing yet. */}
      <DetourMap
        origin={result?.origin}
        hub={outcome?.status === 'ok' ? outcome.plan.hub : null}
        destination={result?.destination}
      />

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {outcome?.status === 'unavailable' && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          価格を提供しているサービスに接続できませんでした。ルートや時期の問題ではありません。
          設定側の確認が必要です。
        </p>
      )}

      {outcome?.status === 'no-direct' && result && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {result.origin.city}から{result.destination.city}への{outcome.month}の価格データが見つかりませんでした。
          別の時期か、近くの大きな空港でお試しください。
        </p>
      )}

      {outcome?.status === 'no-cheaper' && result && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-base font-medium text-gray-900">今回はそのまま行くのが最善です。</p>
          <p className="text-sm text-gray-700">
            経由地を{outcome.candidatesPriced}通り試しましたが、どれも直行より高くつきました。
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-gray-600">
              {result.origin.city} → {result.destination.city}
            </span>
            <span className="text-xl font-semibold tabular-nums text-gray-900">
              {YEN(outcome.direct.price)}
            </span>
            <EstimateTag />
          </div>
          <p className="text-xs text-gray-500">{ESTIMATE_NOTE}</p>
        </div>
      )}

      {outcome?.status === 'ok' && result && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-gray-500">そのまま行くと</p>
                <p className="text-xl font-semibold tabular-nums text-gray-500 line-through">
                  {YEN(outcome.direct.price)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {outcome.plan.hub.city}を挟むと
                </p>
                <p className="text-xl font-semibold tabular-nums text-gray-900">
                  {YEN(outcome.plan.total)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-orange-700">差額</p>
                <p className="text-2xl font-bold tabular-nums text-orange-600">
                  {YEN(outcome.plan.saving)} 安い
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-gray-500">
              <EstimateTag />
              <span>{ESTIMATE_NOTE}</span>
            </p>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <p className="mb-1 text-xs font-semibold text-orange-800">Radi</p>
            <p className="text-sm leading-relaxed text-gray-800">
              {result.destination.city}へまっすぐ向かうより、{outcome.plan.hub.country}の
              {outcome.plan.hub.city}を挟んだほうが{YEN(outcome.plan.saving)}安く済みます。
              行く国がひとつ増えたのに、値段は下がりました。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LegCard leg={outcome.plan.first} label={`1本目 ${result.origin.city} → ${outcome.plan.hub.city}`} />
            <LegCard leg={outcome.plan.second} label={`2本目 ${outcome.plan.hub.city} → ${result.destination.city}`} />
          </div>

          <div className="space-y-2 rounded-xl border border-gray-300 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
            <p className="font-semibold text-gray-900">この方法のリスク</p>
            <p>
              この2本は<strong>別々の航空券</strong>です。1本目が遅れて2本目に乗れなくても、
              航空会社による振替や補償はありません。時間の余裕を大きく取るか、
              乗り継ぎ地で1泊する前提でお考えください。
            </p>
            <p>
              乗り継ぎ地での入国やトランジットにビザが必要な場合があります。
              預けた荷物はいったん受け取って預け直す必要があり、
              航空券ごとに無料の重量が異なります。いずれもご自身でのご確認をお願いします。
            </p>
            {outcome.plan.datesInconsistent && (
              <p>
                今回の2区間は、それぞれ別の日が最安として出ています。
                この順番のままでは乗り継げません。日程は改めて調整してください。
              </p>
            )}
            <p>
              表示中の日付は、その月でいちばん安かった日です。日付を変えると価格は変わります。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
