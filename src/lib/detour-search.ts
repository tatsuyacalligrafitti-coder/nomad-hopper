// SERVER-ONLY. 逆探知1段 — the engine behind the「遊び」page.
//
// The idea: buy two separate tickets instead of one. Compare the plain fare
// O→D against the cheapest O→X→D built from two independently-priced legs, and
// report the gap. One stopover only; no deeper splitting.
//
// Every price here comes from Travelpayouts' cached-fare endpoints
// (v1/prices/cheap), i.e. the cheapest fare *somebody observed recently* for that
// route and month. It is an estimate, never a live bookable price — callers must
// label it as such. That is also why this file does not go through
// flight-search-orchestrator: one game turn needs ~20 route lookups, which the
// live providers (RapidAPI/Duffel/SerpAPI) can neither afford nor rate-limit
// through.

import { aviasalesLink } from '@/lib/travelpayouts'
import { HUBS } from '@/lib/detour-hubs'
import { distanceKm } from '@/lib/geo-coords'
import type { Hub, LegQuote, DetourPlan, DetourOutcome, DirectOutcome } from '@/types'

const TOKEN = process.env.TRAVELPAYOUTS_TOKEN
const API = 'https://api.travelpayouts.com/v1/prices/cheap'

/** Reject stopovers that stretch the trip past this multiple of the direct distance. */
const MAX_DETOUR_RATIO = 1.7
/** How many stopovers we are willing to price per turn (each costs one lookup). */
const MAX_CANDIDATES = 12
/** Parallel Travelpayouts requests. */
const CONCURRENCY = 6

// ── Travelpayouts access ──────────────────────────────────────────────────────

interface CheapEntry {
  airline?: string
  price: number
  flight_number?: number
  departure_at: string
  duration?: number
}

/** All cached fares from `origin`, keyed by destination IATA. */
type FareTable = Map<string, CheapEntry[]>

/**
 * `reachable: false` means the price service itself did not answer (rejected
 * token, outage). That is a very different thing from "this route has no cached
 * fares", and the two must not collapse into the same message on screen.
 */
interface FareLookup {
  reachable: boolean
  table: FareTable
}

const UNREACHABLE: FareLookup = { reachable: false, table: new Map() }

async function fetchCheap(origin: string, destination: string | null, month: string): Promise<FareLookup> {
  if (!TOKEN) return UNREACHABLE

  const params = new URLSearchParams({
    origin,
    currency: 'jpy',
    token: TOKEN,
    depart_date: month,
  })
  if (destination) params.set('destination', destination)

  let json: { success?: boolean; data?: Record<string, Record<string, CheapEntry>> }
  try {
    const res = await fetch(`${API}?${params}`, { next: { revalidate: 3600 } })
    if (!res.ok) {
      console.warn(`[detour] ${origin}→${destination ?? '*'} ${month}: HTTP ${res.status}`)
      return UNREACHABLE
    }
    json = await res.json()
  } catch (err) {
    console.warn('[detour] 価格の取得に失敗:', err instanceof Error ? err.message : String(err))
    return UNREACHABLE
  }
  if (!json.success || !json.data) return { reachable: true, table: new Map() }

  const table: FareTable = new Map()
  for (const [dest, buckets] of Object.entries(json.data)) {
    const entries = Object.values(buckets).filter(
      (e) => e && typeof e.price === 'number' && e.price > 0 && typeof e.departure_at === 'string',
    )
    if (entries.length > 0) table.set(dest.toUpperCase(), entries)
  }

  // 調査用（2026-08-16）: Travelpayouts が応答をどのコードで返すかを確かめる。
  // 空港コードで要求したものが都市コードで返っていないかを見るためのもので、
  // 確認がとれ次第この行は外す。
  console.log(
    `[detour:調査] 要求 origin=${origin} destination=${destination ?? '(なし)'} ` +
      `/ 応答キー=[${[...table.keys()].join(',')}]`,
  )

  return { reachable: true, table }
}

/** Run `jobs` with a bounded number in flight; failures resolve to null. */
async function pooled<T>(jobs: (() => Promise<T>)[], limit: number): Promise<(T | null)[]> {
  const out: (T | null)[] = new Array(jobs.length).fill(null)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    for (let i = next++; i < jobs.length; i = next++) {
      try {
        out[i] = await jobs[i]()
      } catch (err) {
        console.warn('[detour] 区間の取得に失敗:', err instanceof Error ? err.message : String(err))
      }
    }
  })
  await Promise.all(workers)
  return out
}

// ── Quote selection ───────────────────────────────────────────────────────────

function toQuote(origin: string, destination: string, entry: CheapEntry): LegQuote {
  const departDate = entry.departure_at.slice(0, 10)
  return {
    origin,
    destination,
    price: Math.round(entry.price),
    departDate,
    airline: entry.airline ?? null,
    transfers: 0,
    link: aviasalesLink(origin, destination, departDate),
  }
}

/**
 * Cheapest fare for the leg. When `notBefore` is given, prefer the cheapest
 * option that departs on or after it, so the two legs form a travellable order;
 * fall back to the outright cheapest when nothing does.
 */
function pickEntry(entries: CheapEntry[], notBefore?: string): { entry: CheapEntry; ordered: boolean } | null {
  if (entries.length === 0) return null
  const byPrice = [...entries].sort((a, b) => a.price - b.price)
  if (notBefore) {
    const ordered = byPrice.find((e) => e.departure_at.slice(0, 10) >= notBefore)
    if (ordered) return { entry: ordered, ordered: true }
  }
  return { entry: byPrice[0], ordered: !notBefore }
}

// ── Candidate stopovers ───────────────────────────────────────────────────────

function candidateHubs(origin: string, destination: string): Hub[] {
  const direct = distanceKm(origin, destination)

  const scored = HUBS.filter((h) => h.iata !== origin && h.iata !== destination).map((h) => {
    const viaA = distanceKm(origin, h.iata)
    const viaB = distanceKm(h.iata, destination)
    // Unknown coordinates → no opinion on the geometry; let price decide.
    const ratio = direct && direct > 0 && viaA !== null && viaB !== null ? (viaA + viaB) / direct : null
    return { hub: h, ratio }
  })

  const plausible = scored.filter((s) => s.ratio === null || s.ratio <= MAX_DETOUR_RATIO)
  plausible.sort((a, b) => (a.ratio ?? Infinity) - (b.ratio ?? Infinity))
  return plausible.slice(0, MAX_CANDIDATES).map((s) => s.hub)
}

function detourRatioOf(origin: string, hub: string, destination: string): number | null {
  const direct = distanceKm(origin, destination)
  const a = distanceKm(origin, hub)
  const b = distanceKm(hub, destination)
  if (!direct || direct <= 0 || a === null || b === null) return null
  return (a + b) / direct
}

// ── Entry points ──────────────────────────────────────────────────────────────

type DirectLookup =
  | { status: 'ok'; direct: LegQuote; fromTable: FareTable }
  | { status: 'no-direct' }
  | { status: 'unavailable' }

/**
 * The plain answer, plus the bulk fare table it came from. The table also holds
 * most of the detour's first legs, so a later detour search can reuse it — and
 * because the underlying fetches are cached for an hour, asking twice is cheap.
 */
async function lookupDirect(from: string, to: string, month: string): Promise<DirectLookup> {
  if (!TOKEN) {
    console.warn('[detour] TRAVELPAYOUTS_TOKEN未設定')
    return { status: 'unavailable' }
  }
  if (from === to) return { status: 'no-direct' }

  // One call gives every cached fare out of `from`: the direct fare and most of
  // the first legs at once.
  const fromLookup = await fetchCheap(from, null, month)
  if (!fromLookup.reachable) return { status: 'unavailable' }
  const fromTable = fromLookup.table

  let directEntries = fromTable.get(to)
  if (!directEntries) {
    const retry = await fetchCheap(from, to, month)
    if (!retry.reachable) return { status: 'unavailable' }
    directEntries = retry.table.get(to)
  }
  const directPick = directEntries ? pickEntry(directEntries) : null
  if (!directPick) return { status: 'no-direct' }

  return { status: 'ok', direct: toQuote(from, to, directPick.entry), fromTable }
}

/**
 * 拍2 — what it costs to just go there. No stopover is looked for; the user has
 * not asked for one yet.
 *
 * @param month departure month as `YYYY-MM` — cached-fare data has no finer grain.
 */
export async function findDirectFare(
  origin: string,
  destination: string,
  month: string,
): Promise<DirectOutcome> {
  const found = await lookupDirect(origin.toUpperCase(), destination.toUpperCase(), month)
  return found.status === 'ok'
    ? { status: 'ok', month, direct: found.direct }
    : { status: found.status, month }
}

/**
 * 拍4 — the stopover search, run only once the user has said yes.
 *
 * @param month departure month as `YYYY-MM` — cached-fare data has no finer grain.
 */
export async function findDetour(
  origin: string,
  destination: string,
  month: string,
): Promise<DetourOutcome> {
  const from = origin.toUpperCase()
  const to = destination.toUpperCase()

  const found = await lookupDirect(from, to, month)
  if (found.status !== 'ok') return { status: found.status, month }
  const { direct, fromTable } = found

  const hubs = candidateHubs(from, to)

  // First legs: reuse the bulk table, look up only what it lacks.
  const firstLegJobs = hubs.map((h) => async () => {
    const cached = fromTable.get(h.iata)
    if (cached) return cached
    return (await fetchCheap(from, h.iata, month)).table.get(h.iata) ?? null
  })
  const firstLegs = await pooled(firstLegJobs, CONCURRENCY)

  // Second legs always need their own call — they start somewhere else.
  const secondLegJobs = hubs.map((h, i) => async () => {
    if (!firstLegs[i]) return null // no first leg → the pair can't exist
    return (await fetchCheap(h.iata, to, month)).table.get(to) ?? null
  })
  const secondLegs = await pooled(secondLegJobs, CONCURRENCY)

  let best: DetourPlan | null = null
  let candidatesPriced = 0

  for (let i = 0; i < hubs.length; i++) {
    const hub = hubs[i]
    const firstEntries = firstLegs[i]
    const secondEntries = secondLegs[i]
    if (!firstEntries || !secondEntries) continue

    const firstPick = pickEntry(firstEntries)
    if (!firstPick) continue
    const first = toQuote(from, hub.iata, firstPick.entry)

    const secondPick = pickEntry(secondEntries, first.departDate)
    if (!secondPick) continue
    const second = toQuote(hub.iata, to, secondPick.entry)

    candidatesPriced++

    const total = first.price + second.price
    if (best && total >= best.total) continue

    best = {
      hub,
      first,
      second,
      total,
      saving: direct.price - total,
      datesInconsistent: !secondPick.ordered,
      detourRatio: detourRatioOf(from, hub.iata, to),
    }
  }

  if (!best || best.saving <= 0) {
    return { status: 'no-cheaper', month, direct, candidatesPriced }
  }
  return { status: 'ok', month, direct, plan: best, candidatesPriced }
}
