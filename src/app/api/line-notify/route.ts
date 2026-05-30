import { NextRequest } from 'next/server'
import { pushLineMessage } from '@/lib/line'

interface NotifyBody {
  userId: string
  message: string
}

export async function POST(request: NextRequest) {
  const body: NotifyBody = await request.json()

  if (!body.userId || !body.message) {
    return Response.json({ error: 'userId と message は必須です' }, { status: 400 })
  }

  try {
    await pushLineMessage(body.userId, body.message)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[line-notify] Push failed:', e)
    return Response.json(
      { error: e instanceof Error ? e.message : 'Push failed' },
      { status: 502 }
    )
  }
}
