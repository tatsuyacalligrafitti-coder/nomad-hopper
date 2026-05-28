import { NextRequest } from 'next/server'
import type { CategorizedFlights, SearchQuery } from '@/types'

interface AnalysisResult {
  verdict: string
  reason: string
  recommended: string
  caution: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages: ChatMessage[]
  query: SearchQuery
  categorized: CategorizedFlights
  analysis: AnalysisResult
}

function buildSystemPrompt(query: SearchQuery, categorized: CategorizedFlights, analysis: AnalysisResult): string {
  const allFlights = [...categorized.cheapest, ...categorized.cheapestDirect, ...categorized.recommended]
  const seen = new Set<string>()
  const unique = allFlights.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true })

  const priceLines = unique.slice(0, 5).map(f => {
    const seg = f.segments[0]
    const airline = seg.carrierName || seg.carrierCode || '不明'
    const stops = f.stops === 0 ? '直行' : `${f.stops}回乗継`
    return `  - ${airline}: ¥${Math.round(f.totalPrice).toLocaleString()}（${stops}）`
  }).join('\n')

  const cabinLabel = query.cabinClass === 'business' ? 'ビジネスクラス' : 'エコノミー'

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  return `今日の日付は${today}です。

あなたはNomad Hopperの旅行AIアシスタントです。
以下の検索結果とAI価格分析結果をもとに、ユーザーの質問に日本語で簡潔・親切に答えてください。

--- 検索情報 ---
出発地: ${query.origin}
目的地: ${query.destination}
出発日: ${query.departureDate}${query.returnDate ? `\n帰国日: ${query.returnDate}` : ''}
座席クラス: ${cabinLabel}

--- 検索結果（上位便） ---
${priceLines}

--- AI価格分析結果 ---
判定: ${analysis.verdict}
理由: ${analysis.reason}
おすすめの便: ${analysis.recommended}${analysis.caution ? `\n注意点: ${analysis.caution}` : ''}

【出力形式】
必ず以下のJSON形式のみで返してください。回答本文と、ユーザーが次に聞きたくなりそうな具体的な質問を2〜3個提案してください：
{"answer": "回答テキスト", "suggestions": ["次の質問1", "次の質問2", "次の質問3"]}
suggestionsは会話の流れに沿った具体的な質問にしてください。余分なテキストは一切出力しないでください。`
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { messages, query, categorized, analysis } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages are required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const apiMessages = messages.slice(-20).map(({ role, content }) => ({ role, content }))

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
      system: buildSystemPrompt(query, categorized, analysis),
      messages: apiMessages,
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
  const text: string = data.content?.[0]?.text ?? ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { answer?: string; suggestions?: string[] }
      return Response.json({
        content: parsed.answer ?? text,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      })
    } catch {
      // fall through to plain text response
    }
  }

  return Response.json({ content: text, suggestions: [] })
}
