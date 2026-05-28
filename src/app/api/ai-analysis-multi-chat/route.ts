import { NextRequest } from 'next/server'
import type { MultiCitySearchResult } from '@/types'

interface MultiCityAnalysis {
  verdict: string
  reason: string
  tip: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages: ChatMessage[]
  result: MultiCitySearchResult
  analysis: MultiCityAnalysis
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}時間${m}分` : `${h}時間`
}

function buildSystemPrompt(result: MultiCitySearchResult, analysis: MultiCityAnalysis): string {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const segLines = result.segments.map((seg, i) => {
    const parts = [`区間${i + 1}: ${seg.origin} → ${seg.destination}（${seg.date}出発）`]
    if (seg.cheapestPrice !== null && seg.cheapestFlight) {
      const carrier = seg.cheapestFlight.segments[0]?.carrierName ?? ''
      const dur = seg.cheapestFlight.totalDuration
      parts.push(`  最安値: ¥${Math.round(seg.cheapestPrice).toLocaleString()}`)
      if (carrier) parts.push(`  航空会社: ${carrier}`)
      if (dur > 0) parts.push(`  所要時間: ${formatDuration(dur)}`)
    } else {
      parts.push('  便が見つかりませんでした')
    }
    return parts.join('\n')
  }).join('\n')

  return `今日の日付は${today}です。

あなたはNomad Hopperのマルチシティ旅程アシスタントです。
以下のマルチシティ旅程とAI分析結果をもとに、ユーザーの質問に日本語で簡潔・親切に答えてください。

--- マルチシティ旅程 ---
${segLines}

合計金額: ¥${Math.round(result.totalPrice).toLocaleString()}
区間数: ${result.segments.length}

--- AI分析結果 ---
判定: ${analysis.verdict}
理由: ${analysis.reason}${analysis.tip ? `\n提案: ${analysis.tip}` : ''}

【出力形式】
必ず以下のJSON形式のみで返してください。余分なテキストは一切出力しないでください：
{
  "answer": "回答テキスト",
  "suggestions": ["次の質問1", "次の質問2"],
  "searchSuggestion": null
}

suggestionsは会話の流れに沿った具体的な質問を2〜3個。

searchSuggestionについて：
- 回答の中で具体的な日程・ルート変更を提案する場合は以下の形式で値を入れてください：
  {"show": true, "origin": "HND", "destination": "BKK", "departureDate": "2026-08-01", "returnDate": null, "label": "8月1日出発で再検索する"}
- returnDateが不要な場合はnullにしてください。
- 条件変更の提案がない場合はsearchSuggestion: nullにしてください。`
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { messages, result, analysis } = body

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
      system: buildSystemPrompt(result, analysis),
      messages: apiMessages,
    }),
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.json().catch(() => ({}))
    return Response.json(
      { error: (err as { error?: { message?: string } }).error?.message ?? 'Claude API error' },
      { status: 500 },
    )
  }

  const data = await claudeRes.json()
  const text: string = data.content?.[0]?.text ?? ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        answer?: string
        suggestions?: string[]
        searchSuggestion?: {
          show: boolean
          origin: string
          destination: string
          departureDate: string
          returnDate?: string | null
          label: string
        } | null
      }
      return Response.json({
        content: parsed.answer ?? text,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        searchSuggestion: parsed.searchSuggestion?.show ? parsed.searchSuggestion : null,
      })
    } catch {
      // fall through
    }
  }

  return Response.json({ content: text, suggestions: [], searchSuggestion: null })
}
