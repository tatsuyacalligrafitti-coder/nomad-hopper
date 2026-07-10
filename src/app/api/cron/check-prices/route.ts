import { NextRequest } from 'next/server'
import { searchAllProviders } from '@/lib/flight-search-orchestrator'
import {
  listAllAlerts,
  recordPriceHistory,
  updateAlertNotifiedAt,
} from '@/lib/alert-store'
import type { StoredAlert } from '@/lib/alert-store'
import { sendPriceDropEmail } from '@/lib/email'
import { pushLineMessage, formatLineAlertMessage } from '@/lib/line'
import { buildWatchlistQueries } from '@/lib/watchlist'
import type { SearchQuery } from '@/types'

// Allow long-running batch (many alerts × multi-provider search w/ polling).
export const maxDuration = 300

export async function GET(request: NextRequest) {
  // ── CRON_SECRET protection ────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[cron] CRON_SECRET未設定 — 認証なしで実行（ローカルテスト想定）')
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const today = nowIso.slice(0, 10) // YYYY-MM-DD

  const alerts = await listAllAlerts()
  console.log(`[cron] ${alerts.length}件のアラートをチェック`)

  let checked = 0
  let notified = 0
  const errors: { alertId: string; error: string }[] = []

  for (const alert of alerts) {
    try {
      checked++

      const query: SearchQuery = {
        origin: alert.origin,
        destination: alert.destination,
        departureDate: alert.departureDate,
        passengers: 1,
        cabinClass: 'economy',
        rawQuery: '',
      }

      const { flights } = await searchAllProviders(query)
      if (flights.length === 0) {
        console.log(`[cron] ${alert.origin}→${alert.destination} ${alert.departureDate}: 0件、スキップ`)
        continue
      }

      const lowest = flights.reduce(
        (min, f) => (f.totalPrice < min.totalPrice ? f : min),
        flights[0],
      )
      const lowestPrice = lowest.totalPrice

      // Always record the observed cheapest price, regardless of notification.
      await recordPriceHistory(
        alert.origin,
        alert.destination,
        alert.departureDate,
        lowestPrice,
        nowIso,
      )

      // Only notify when the target is met.
      if (lowestPrice > alert.targetPrice) {
        console.log(`[cron] ${alert.alertId}: ¥${lowestPrice} > 目標¥${alert.targetPrice}、通知なし`)
        continue
      }

      // Dedup: skip if already notified today.
      if (alert.lastNotifiedAt && alert.lastNotifiedAt.slice(0, 10) === today) {
        console.log(`[cron] ${alert.alertId}: 本日通知済み、スキップ`)
        continue
      }

      await notifyAlert(alert, lowestPrice, lowest.bookingLink)
      await updateAlertNotifiedAt(alert.alertId, nowIso)
      notified++
      console.log(`[cron] ${alert.alertId}: 通知送信（¥${lowestPrice} <= 目標¥${alert.targetPrice}）`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron] alert ${alert.alertId} エラー:`, msg)
      errors.push({ alertId: alert.alertId, error: msg })
    }
  }

  // ── Watchlist: observe fixed routes for pricehist, recording only (no notify) ──
  const watchlistQueries = buildWatchlistQueries(now)
  console.log(`[cron] ウォッチリスト ${watchlistQueries.length}件を観測`)
  let watchlistChecked = 0
  const watchlistErrors: string[] = []

  for (const query of watchlistQueries) {
    try {
      watchlistChecked++
      const { flights } = await searchAllProviders(query)
      if (flights.length === 0) {
        console.log(`[cron] watchlist ${query.origin}→${query.destination} ${query.departureDate}: 0件、スキップ`)
        continue
      }
      const lowest = flights.reduce(
        (min, f) => (f.totalPrice < min.totalPrice ? f : min),
        flights[0],
      )
      // Record only — watchlist entries never trigger notifications.
      await recordPriceHistory(
        query.origin,
        query.destination,
        query.departureDate,
        lowest.totalPrice,
        nowIso,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron] watchlist ${query.origin}→${query.destination} ${query.departureDate} エラー:`, msg)
      watchlistErrors.push(`${query.origin}-${query.destination}-${query.departureDate}: ${msg}`)
    }
  }

  const summary = {
    ok: true,
    checked,
    notified,
    errorCount: errors.length,
    errors,
    watchlistChecked,
    watchlistErrors,
    ranAt: nowIso,
  }
  console.log('[cron] 完了:', JSON.stringify(summary))
  return Response.json(summary)
}

async function notifyAlert(
  alert: StoredAlert,
  currentPrice: number,
  bookingUrl?: string,
): Promise<void> {
  if (alert.email) {
    await sendPriceDropEmail({
      email: alert.email,
      origin: alert.origin,
      destination: alert.destination,
      departureDate: alert.departureDate,
      currentPrice,
      targetPrice: alert.targetPrice,
      bookingUrl,
    })
  }

  if (alert.lineUserId) {
    await pushLineMessage(
      alert.lineUserId,
      formatLineAlertMessage({ ...alert, currentPrice }),
    )
  }
}
