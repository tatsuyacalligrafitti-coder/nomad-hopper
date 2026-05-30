import { NextRequest } from 'next/server'
import { verifyLineSignature, pushLineMessage } from '@/lib/line'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''

  if (!verifyLineSignature(rawBody, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { events } = JSON.parse(rawBody) as { events: LineEvent[] }

  await Promise.all(
    events.map(async (event) => {
      if (event.type === 'follow' && event.source.userId) {
        const userId = event.source.userId
        await pushLineMessage(
          userId,
          `✈️ Tobira へようこそ！\n\n価格アラートの通知先として LINE を設定できます。\n\nあなたの LINE User ID は以下の通りです。アラート設定画面に貼り付けてください：\n\n${userId}`
        )
      }
    })
  )

  return Response.json({ ok: true })
}

interface LineEvent {
  type: string
  source: { userId?: string }
}
