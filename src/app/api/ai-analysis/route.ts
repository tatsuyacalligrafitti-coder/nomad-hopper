import { NextRequest } from 'next/server'
import type { CategorizedFlights, SearchQuery } from '@/types'

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  return `今日の日付は${today}です。

あなたは航空券の価格分析の専門家です。提供された価格データを分析して、以下のJSON形式のみで回答してください。前置き・後書き・コードブロック記号は不要です。JSONだけを出力してください。

{
  "verdict": "◎今すぐ",
  "reason": "判断理由を2〜3文で",
  "recommended": "最もおすすめの便の説明",
  "caution": "注意点（ない場合はnull）",
  "suggestions": [
    {"label": "ボタンラベル（12文字以内）", "airline": "航空会社名", "query": "チャットに送る質問文"}
  ]
}

ルール：
- verdictは必ず「◎今すぐ」「△様子見」「✗待つべき」のいずれか
- suggestionsは必ず1〜3件含めること（同区間の別航空会社・直行便の有無・前後1週間の日程など）
- 東京→バンコクの相場（エコノミー往復6〜12万円、ビジネス20〜40万円）などの知識を活用して判断`
}

interface RequestBody {
  query: SearchQuery
  categorized: CategorizedFlights
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { query, categorized } = body

  if (!query || !categorized) {
    return Response.json({ error: 'query and categorized are required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const allFlights = [
    ...categorized.cheapest,
    ...categorized.cheapestDirect,
    ...categorized.recommended,
  ]
  const seen = new Set<string>()
  const uniqueFlights = allFlights.filter(f => {
    if (seen.has(f.id)) return false
    seen.add(f.id)
    return true
  })

  if (uniqueFlights.length === 0) {
    return Response.json({ error: '分析対象の便が見つかりませんでした' }, { status: 400 })
  }

  const priceList = uniqueFlights.map(f => {
    const seg = f.segments[0]
    const airline = seg.carrierName || seg.carrierCode || '不明'
    const stops = f.stops === 0 ? '直行' : f.stops ? `${f.stops}回乗継` : ''
    return `- ${airline}: ¥${Math.round(f.totalPrice).toLocaleString()}${stops ? `（${stops}）` : ''}`
  }).join('\n')

  const prices = uniqueFlights.map(f => f.totalPrice)
  const minPrice = Math.round(Math.min(...prices)).toLocaleString()
  const maxPrice = Math.round(Math.max(...prices)).toLocaleString()

  const cabinLabel = query.cabinClass === 'business' ? 'ビジネスクラス' : 'エコノミー'

  const userMessage = [
    `出発地: ${query.origin}`,
    `目的地: ${query.destination}`,
    `出発日: ${query.departureDate}`,
    query.returnDate ? `帰国日: ${query.returnDate}` : null,
    `座席クラス: ${cabinLabel}`,
    '',
    '検索結果の価格一覧:',
    priceList,
    '',
    `最安値: ¥${minPrice}`,
    `最高値: ¥${maxPrice}`,
    '',
    'この価格は今が買い時か分析してください。',
  ].filter(l => l !== null).join('\n')

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.json().catch(() => ({}))
    return Response.json(
      { error: (err as { error?: { message?: string } }).error?.message ?? 'Claude API error' },
      { status: 500 }
    )
  }

  const claudeData = await claudeRes.json()
  const text: string = claudeData.content?.[0]?.text ?? ''
  console.log('[ai-analysis] raw response:', text)

  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Fallback: extract first {...} block
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json({ error: 'AI分析の解析に失敗しました' }, { status: 500 })
    }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return Response.json({ error: 'AI分析の解析に失敗しました' }, { status: 500 })
    }
  }

  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  console.log('[ai-analysis] suggestions parsed:', suggestions)

  return Response.json({ ...parsed, suggestions })
}
