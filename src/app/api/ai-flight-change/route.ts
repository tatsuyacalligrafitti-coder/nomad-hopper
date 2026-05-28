import { NextRequest } from 'next/server'

interface FlightInfo {
  carrierName: string
  price: number
  duration: number   // minutes
  stops: number
}

interface RequestBody {
  before: FlightInfo
  after: FlightInfo
  priceDiff: number    // after.price - before.price (positive = more expensive)
  durationDiff: number // after.duration - before.duration (negative = faster)
}

function formatDuration(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  return m > 0 ? `${h}時間${m}分` : `${h}時間`
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { before, after, priceDiff, durationDiff } = body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const priceDiffStr = priceDiff >= 0 ? `+¥${Math.round(priceDiff).toLocaleString()}` : `-¥${Math.round(-priceDiff).toLocaleString()}`
  const durationDiffStr = durationDiff === 0
    ? '変化なし'
    : durationDiff < 0
      ? `-${formatDuration(durationDiff)}（短縮）`
      : `+${formatDuration(durationDiff)}（増加）`

  const prompt = `以下の便の変更を1〜2文で簡潔に評価してください（日本語）：

変更前：${before.carrierName || '不明'}、¥${Math.round(before.price).toLocaleString()}、所要${formatDuration(before.duration)}、${before.stops === 0 ? '直行' : `${before.stops}回乗継`}
変更後：${after.carrierName || '不明'}、¥${Math.round(after.price).toLocaleString()}、所要${formatDuration(after.duration)}、${after.stops === 0 ? '直行' : `${after.stops}回乗継`}
金額変化：${priceDiffStr}
所要時間変化：${durationDiffStr}

例：「乗り継ぎ1回で所要時間が6時間短縮。コストは+¥18,000ですが快適さは大幅に向上します。」
必ず1〜2文以内で。絵文字を1つ使ってOK。`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.json().catch(() => ({}))
    return Response.json(
      { error: (err as { error?: { message?: string } }).error?.message ?? 'Claude API error' },
      { status: 500 },
    )
  }

  const claudeData = await claudeRes.json()
  const comment: string = claudeData.content?.[0]?.text?.trim() ?? ''
  return Response.json({ comment })
}
