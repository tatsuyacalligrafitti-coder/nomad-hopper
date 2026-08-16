'use client'

// 遊び「逆探知1段」— laid out as the conversation beats in docs/15_radi_jinkaku.md:
//
//   拍2 まず普通に答える  — the direct fare, nothing else. No flourish.
//   拍3 許可を取る        — Radi asks; nothing is searched until the user says yes.
//   拍4 見せる            — the stopover, the gap, the map.
//   拍5 正直に言う        — the stay length and the separate-ticket risk, in Radi's
//                          own voice. 原則7 forbids demoting these to fine print.
//
// Two rules shape the whole file:
//
//   1. Pressing 調べる must not look for a stopover. Beat 4 lives behind its own
//      request and its own button.
//   2. Every number on this page is a cached-fare estimate, and every one of them
//      says so. The gap is an estimate minus an estimate — same ruler on both
//      sides. Real, bookable prices come from the main search, and /asobi hands
//      the reader over to it rather than quoting one itself.

import { useState } from 'react'
import { ArrowRight, ExternalLink, Loader2, Search } from 'lucide-react'
import DetourMap from '@/components/DetourMap'
import type { DetourResponse, DirectResponse, LegQuote } from '@/types'

const YEN = (n: number) => `¥${n.toLocaleString('ja-JP')}`

function formatDate(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return `${Number(m)}月${Number(d)}日`
}

/** Nights spent at the stopover: the gap between the two legs' departure dates. */
function nightsBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/**
 * A link into the main search, pre-filled. The top page auto-runs whatever `q`
 * holds, so this is the hand-off from estimates to real, bookable prices.
 */
function mainSearchHref(fromCity: string, toCity: string, date: string): string {
  return `/?q=${encodeURIComponent(`${fromCity}から${toCity}へ ${date}`)}`
}

function EstimateTag() {
  return (
    <span className="shrink-0 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
      概算
    </span>
  )
}

/** Radi speaks in a bubble with a name on it, so her voice is never mistaken for chrome. */
function Radi({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 p-4">
      <p className="text-xs font-semibold text-orange-800">Radi</p>
      <div className="space-y-2 text-sm leading-relaxed text-gray-800">{children}</div>
    </div>
  )
}

function LegCard({
  leg,
  label,
  fromCity,
  toCity,
}: {
  leg: LegQuote
  label: string
  fromCity: string
  toCity: string
}) {
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
        <span className="ml-auto flex items-center gap-1.5 tabular-nums">
          {YEN(leg.price)}
          <EstimateTag />
        </span>
      </div>
      <a
        href={mainSearchHref(fromCity, toCity, leg.departDate)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 underline underline-offset-2"
      >
        この区間の実際の価格を調べる
        <ExternalLink size={11} />
      </a>
    </div>
  )
}

/** `defaultMonth` (YYYY-MM) comes from the server on JST so the two renders agree. */
export default function DetourGame({ defaultMonth }: { defaultMonth: string }) {
  const [origin, setOrigin] = useState('東京')
  const [destination, setDestination] = useState('')
  const [month, setMonth] = useState(defaultMonth)

  const [loadingDirect, setLoadingDirect] = useState(false)
  const [loadingDetour, setLoadingDetour] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [direct, setDirect] = useState<DirectResponse | null>(null)
  const [detour, setDetour] = useState<DetourResponse | null>(null)

  async function post<T>(url: string): Promise<T | null> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, month }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? '検索に失敗しました')
      return null
    }
    return json as T
  }

  // 拍2. Clears any previous stopover: the user has not asked about this route yet.
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoadingDirect(true)
    setError(null)
    setDirect(null)
    setDetour(null)
    try {
      const json = await post<DirectResponse>('/api/game/direct')
      if (json) setDirect(json)
    } catch {
      setError('通信に失敗しました。もう一度お試しください。')
    } finally {
      setLoadingDirect(false)
    }
  }

  // 拍4. Only ever called from Radi's button.
  async function handleFindDetour() {
    setLoadingDetour(true)
    setError(null)
    try {
      const json = await post<DetourResponse>('/api/game/detour')
      if (json) setDetour(json)
    } catch {
      setError('通信に失敗しました。もう一度お試しください。')
    } finally {
      setLoadingDetour(false)
    }
  }

  const directOutcome = direct?.outcome
  const detourOutcome = detour?.outcome
  const place = detour ?? direct
  const plan = detourOutcome?.status === 'ok' ? detourOutcome.plan : null

  // The permission question stands until it has been answered.
  const askingPermission = directOutcome?.status === 'ok' && !detour && !loadingDetour

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
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
          disabled={loadingDirect || !destination.trim() || !month}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {loadingDirect ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loadingDirect ? '調べています…' : '調べる'}
        </button>
        <p className="text-xs text-gray-500">片道で比べます。大人1名・エコノミー。</p>
      </form>

      {/* Directly under the form and never conditional: the map is the ground the
          page stands on, so it must not appear and disappear with the result. The
          stopover line joins only once the user has asked for one. */}
      <DetourMap origin={place?.origin} hub={plan?.hub} destination={place?.destination} />

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {directOutcome?.status === 'unavailable' && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          価格を提供しているサービスに接続できませんでした。ルートや時期の問題ではありません。
          設定側の確認が必要です。
        </p>
      )}

      {directOutcome?.status === 'no-direct' && direct && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {direct.origin.city}から{direct.destination.city}への{directOutcome.month}の価格データが
          見つかりませんでした。別の時期か、近くの大きな空港でお試しください。
        </p>
      )}

      {/* 拍2 — the plain answer. One number, no flourish. */}
      {directOutcome?.status === 'ok' && direct && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">
            {direct.origin.city} → {direct.destination.city}
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-gray-900">
            {YEN(directOutcome.direct.price)}
            <EstimateTag />
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {formatDate(directOutcome.direct.departDate)}ごろ発
          </p>
        </div>
      )}

      {/* 拍3 — the question. Nothing is searched until this is answered. */}
      {askingPermission && (
        <Radi>
          <p>概算です。いま買える価格ではありません。</p>
          <p>ひとつ、試してみたいことがあります。調べてみましょうか？</p>
          <button
            type="button"
            onClick={handleFindDetour}
            className="mt-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white"
          >
            経由地を探してもらう
          </button>
        </Radi>
      )}

      {loadingDetour && (
        <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin" />
          経由地をさがしています…
        </p>
      )}

      {detourOutcome?.status === 'no-cheaper' && detour && (
        <Radi>
          <p>調べましたが、今回はそのまま行くのが最善です。</p>
          <p className="text-gray-600">
            経由地を{detourOutcome.candidatesPriced}通り試しました。どれも直行より高くつきます。
          </p>
          <p>
            ここまでの金額は概算です。実際に買える価格は、こちらで確かめてください。
          </p>
          <a
            href={mainSearchHref(
              detour.origin.city,
              detour.destination.city,
              detourOutcome.direct.departDate,
            )}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 underline underline-offset-2"
          >
            {detour.origin.city} → {detour.destination.city} の実際の価格を調べる
            <ExternalLink size={12} />
          </a>
        </Radi>
      )}

      {(detourOutcome?.status === 'unavailable' || detourOutcome?.status === 'no-direct') && (
        <Radi>
          <p>探しているあいだに価格を取れなくなりました。私のほうの問題です。</p>
          <p className="text-gray-600">もう一度お試しください。</p>
        </Radi>
      )}

      {/* 拍4 and 拍5 — the gap, then the honest part, in that order. */}
      {detourOutcome?.status === 'ok' && detour && plan && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-gray-500">そのまま行くと</p>
                <p className="text-xl font-semibold tabular-nums text-gray-500 line-through">
                  {YEN(detourOutcome.direct.price)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{plan.hub.city}を挟むと</p>
                <p className="text-xl font-semibold tabular-nums text-gray-900">
                  {YEN(plan.total)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-orange-700">差額</p>
                <p className="text-2xl font-bold tabular-nums text-orange-600">
                  {YEN(plan.saving)} 安い
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <EstimateTag />
              <span>3つとも概算です。同じ出どころの数字どうしを引き算しています。</span>
            </p>
          </div>

          <Radi>
            <p>
              {plan.hub.country}の{plan.hub.city}を挟むと、{YEN(plan.saving)}安くなります。
            </p>
            {plan.datesInconsistent ? (
              <p>
                ひとつ正直に言うと、この2区間は別々の日が最安として出ています。
                この順番のままでは乗り継げないので、日程は組み直しになります。
              </p>
            ) : (
              <p>
                ひとつ正直に言うと、この旅程は{plan.hub.city}で
                {nightsBetween(plan.first.departDate, plan.second.departDate)}日過ごすことになります。
              </p>
            )}
            <p>
              航空券は別々の購入になるため、乗り継ぎの保証はありません。
              1本目が遅れて2本目に乗れなくても、振替や払い戻しは受けられません。
            </p>
            <p>
              金額はどれも概算です。いま買える価格ではありません。
              買えるかどうかは、区間ごとに調べて確かめてください。
            </p>
          </Radi>

          <div className="grid gap-3 sm:grid-cols-2">
            <LegCard
              leg={plan.first}
              label={`1本目 ${detour.origin.city} → ${plan.hub.city}`}
              fromCity={detour.origin.city}
              toCity={plan.hub.city}
            />
            <LegCard
              leg={plan.second}
              label={`2本目 ${plan.hub.city} → ${detour.destination.city}`}
              fromCity={plan.hub.city}
              toCity={detour.destination.city}
            />
          </div>

          {/* Operational detail, not the headline warning — that is Radi's, above. */}
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
            <p>
              乗り継ぎ地での入国やトランジットにビザが必要な場合があります。
              預けた荷物はいったん受け取って預け直す必要があり、
              航空券ごとに無料の重量が異なります。いずれもご自身でのご確認をお願いします。
            </p>
            <p>
              表示中の日付は、その月でいちばん安かった日です。日付を変えると価格は変わります。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
