import { NextRequest } from 'next/server'
import { pushLineMessage, formatLineAlertMessage } from '@/lib/line'
import type { AlertRequest } from '@/types'

type NotifyBody = { userId: string } & Pick<
  AlertRequest,
  'origin' | 'destination' | 'departureDate' | 'targetPrice' | 'currentPrice'
>

export async function POST(request: NextRequest) {
  const body: NotifyBody = await request.json()

  if (!body.userId || !body.origin || !body.destination || !body.departureDate || !body.targetPrice) {
    return Response.json({ error: 'userId, origin, destination, departureDate, targetPrice は必須です' }, { status: 400 })
  }

  const message = formatLineAlertMessage({
    lineUserId: body.userId,
    origin: body.origin,
    destination: body.destination,
    departureDate: body.departureDate,
    targetPrice: body.targetPrice,
    currentPrice: body.currentPrice,
    flightId: '',
  })

  try {
    await pushLineMessage(body.userId, message)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[line-notify] Push failed:', e)
    return Response.json(
      { error: e instanceof Error ? e.message : 'Push failed' },
      { status: 502 }
    )
  }
}
