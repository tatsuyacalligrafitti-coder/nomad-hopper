import { NextRequest } from 'next/server'
import type { CategorizedFlights, SearchQuery } from '@/types'

const BASE_SYSTEM = `あなたはNomad Hopperの旅行AIアシスタントです。
ユーザーの航空券探しや旅行計画を日本語でサポートします。
現在の検索情報（出発地・目的地・日程・価格データ）が提供される場合はそれを参考に回答してください。
陸マイラー戦略、最安値の見つけ方、旅程の最適化なども得意です。
返答は簡潔で親しみやすいトーンで。`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Context {
  query: SearchQuery | null
  categorized: CategorizedFlights | null
}

interface RequestBody {
  messages: ChatMessage[]
  context?: Context
  multiCityContext?: string
}

function buildSystemPrompt(context: Context | undefined, multiCityContext?: string): string {
  const multiCityPrefix = multiCityContext
    ? `以下は現在ユーザーが見ているマルチシティ旅程の情報です：\n${multiCityContext}\nこの情報を踏まえて回答してください。\n\n`
    : ''

  if (!context?.query) return multiCityPrefix + BASE_SYSTEM

  const { query, categorized } = context
  const lines: string[] = [
    '',
    '--- 現在の検索状況 ---',
    `出発地: ${query.origin}`,
    `目的地: ${query.destination}`,
    `出発日: ${query.departureDate}`,
  ]
  if (query.returnDate) lines.push(`帰国日: ${query.returnDate}`)
  lines.push(`座席クラス: ${query.cabinClass === 'business' ? 'ビジネスクラス' : 'エコノミー'}`)

  if (categorized) {
    const all = [...categorized.cheapest, ...categorized.cheapestDirect, ...categorized.recommended]
    const seen = new Set<string>()
    const unique = all.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true })

    if (unique.length > 0) {
      const prices = unique.map(f => f.totalPrice)
      lines.push(`最安値: ¥${Math.round(Math.min(...prices)).toLocaleString()}`)
      lines.push(`最高値: ¥${Math.round(Math.max(...prices)).toLocaleString()}`)
      lines.push('検索結果（上位3件）:')
      unique.slice(0, 3).forEach(f => {
        const seg = f.segments[0]
        const airline = seg.carrierName || seg.carrierCode || '不明'
        const stops = f.stops === 0 ? '直行' : `${f.stops}回乗継`
        lines.push(`  - ${airline} ¥${Math.round(f.totalPrice).toLocaleString()}（${stops}）`)
      })
    }
  }

  return multiCityPrefix + BASE_SYSTEM + '\n' + lines.join('\n')
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { messages, context, multiCityContext } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages are required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  // Trim to last 20 messages (10 round trips)
  const trimmed = messages.slice(-20)

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(context, multiCityContext),
      messages: trimmed,
    }),
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.json().catch(() => ({}))
    return Response.json(
      { error: (err as { error?: { message?: string } }).error?.message ?? 'Claude API error' },
      { status: 500 }
    )
  }

  const data = await claudeRes.json()
  const content: string = data.content?.[0]?.text ?? ''
  return Response.json({ content })
}
