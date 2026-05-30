import { createHmac } from 'crypto'
import type { AlertRequest } from '@/types'

const PUSH_URL = 'https://api.line.me/v2/bot/message/push'

export function verifyLineSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const hash = createHmac('sha256', secret).update(rawBody).digest('base64')
  return hash === signature
}

export async function pushLineMessage(userId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.warn('[line] LINE_CHANNEL_ACCESS_TOKEN not set — skipping push')
    return
  }

  const res = await fetch(PUSH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`LINE push failed (${res.status}): ${detail}`)
  }
}

export function formatLineAlertMessage(alert: AlertRequest): string {
  const discount = alert.currentPrice
    ? Math.round((1 - alert.targetPrice / alert.currentPrice) * 100)
    : null

  return [
    '✈️ 価格アラート設定完了',
    '',
    `区間　　: ${alert.origin} → ${alert.destination}`,
    `出発日　: ${alert.departureDate}`,
    alert.currentPrice ? `現在価格: ¥${alert.currentPrice.toLocaleString()}` : null,
    `目標価格: ¥${alert.targetPrice.toLocaleString()}${discount ? `（${discount}% 引き）` : ''}`,
    '',
    '目標価格を下回ったらお知らせします。',
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}
