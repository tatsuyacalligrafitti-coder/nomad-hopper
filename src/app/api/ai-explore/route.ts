import { NextRequest } from 'next/server'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  origin?: string
  destination?: string
  rawQuery: string
  messages?: Message[]
}

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return `今日は${today}です。あなたはNomad Hopperの旅行AIアシスタントです。
ユーザーが日程未定・曖昧な状態で旅行を探しています。
以下の情報を日本語で親しみやすく回答してください：
1. その路線の時期別価格帯（安い時期・高い時期）
2. おすすめの渡航時期（理由付き）
3. 具体的な予算感（エコノミー片道・往復）
4. 混雑度の目安
最後に必ず「いつ頃の出発を考えていますか？」という質問で締めくくる。
回答は200〜300文字程度で簡潔に。

必ずJSON形式のみで回答してください：
{
  "message": "AIからの回答テキスト（改行は\\nで表現）",
  "suggestedDates": [
    { "label": "おすすめ①の説明", "departure": "YYYY-MM-DD", "return": "YYYY-MM-DD" },
    { "label": "おすすめ②の説明", "departure": "YYYY-MM-DD", "return": "YYYY-MM-DD" }
  ]
}

suggestedDatesには今日から2〜12ヶ月以内の実際の日付を入れてください。
フォローアップ質問への回答でsuggestedDatesが不要な場合は空配列 [] にしてください。`
}

function buildInitialUserMessage(origin: string | undefined, destination: string | undefined, rawQuery: string): string {
  const lines: string[] = []
  if (origin && destination) lines.push(`路線: ${origin} → ${destination}`)
  else if (origin) lines.push(`出発地: ${origin}`)
  else if (destination) lines.push(`目的地: ${destination}`)
  lines.push(`ユーザーの入力: "${rawQuery}"`)
  lines.push('\nこの旅行の時期や費用について教えてください。')
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { origin, destination, rawQuery, messages = [] } = body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const initialUserMsg = buildInitialUserMessage(origin, destination, rawQuery)

  // Always prepend the initial context so Claude has the route info throughout the conversation.
  // messages from the client start with 'assistant' (first AI response), so this gives:
  // [user: context, assistant: response, user: follow-up, ...]
  const claudeMessages: Message[] =
    messages.length === 0
      ? [{ role: 'user', content: initialUserMsg }]
      : [{ role: 'user', content: initialUserMsg }, ...messages]

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: buildSystemPrompt(),
      messages: claudeMessages,
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
  const text: string = claudeData.content?.[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return Response.json({ error: 'AI応答の解析に失敗しました' }, { status: 500 })
  }

  const parsed = JSON.parse(jsonMatch[0])
  return Response.json(parsed)
}
