import { NextRequest } from 'next/server'
import type { AlertRequest } from '@/types'

export async function POST(request: NextRequest) {
  const body: AlertRequest = await request.json()

  if (!body.email && !body.lineToken) {
    return Response.json(
      { error: 'メールアドレスまたはLINEトークンが必要です' },
      { status: 400 }
    )
  }

  if (!body.origin || !body.destination || !body.departureDate || !body.targetPrice) {
    return Response.json({ error: '必須フィールドが不足しています' }, { status: 400 })
  }

  // In production: store alert in DB and trigger background worker
  // For MVP: acknowledge and simulate storage
  console.log('[alerts] New alert registered:', body)

  if (body.lineToken) {
    try {
      await sendLineNotification(body.lineToken, body)
    } catch (e) {
      console.error('[alerts] LINE notification failed:', e)
    }
  }

  return Response.json({
    success: true,
    message: `¥${body.targetPrice.toLocaleString()}を下回った際に通知します`,
  })
}

async function sendLineNotification(token: string, alert: AlertRequest) {
  const message =
    `✈️ Nomad Hopper 価格アラート登録完了\n` +
    `${alert.origin} → ${alert.destination}\n` +
    `出発: ${alert.departureDate}\n` +
    `目標価格: ¥${alert.targetPrice.toLocaleString()} 以下になったら通知します`

  await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ message }),
  })
}
