import { NextRequest } from 'next/server'
import type { MultiCitySearchResult } from '@/types'

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return `今日の日付は${today}です。

あなたはマルチシティ航空旅程の価格分析専門家です。提供された旅程データを分析し、日本語でJSON形式のみで回答してください：

{
  "verdict": "◎今すぐ",
  "reason": "全体的な価格評価と買い時の判断を2〜3文で",
  "tip": "旅程改善の提案（例:「逆ルートの方が安い可能性があります」「区間2の出発日を数日ずらすと安くなる場合があります」など。提案がない場合はnull）"
}

verdictは必ず「◎今すぐ」「△様子見」「✗待つべき」のいずれかにしてください。
国際線の一般的な相場（例：東京↔バンコク往復6〜12万円、バンコク↔ナイロビ片道5〜15万円など）と比較して総合評価してください。
便が見つからなかった区間があっても、見つかった区間の価格を元に判断してください。`
}

interface RequestBody {
  result: MultiCitySearchResult
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}時間${m}分` : `${h}時間`
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { result } = body

  if (!result?.segments?.length) {
    return Response.json({ error: '旅程データが不足しています' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const segLines = result.segments.map((seg, i) => {
    const lines = [`区間${i + 1}: ${seg.origin} → ${seg.destination}（${seg.date}出発）`]
    if (seg.cheapestPrice !== null && seg.cheapestFlight) {
      const carrier = seg.cheapestFlight.segments[0]?.carrierName ?? ''
      const dur = seg.cheapestFlight.totalDuration
      lines.push(`  最安値: ¥${Math.round(seg.cheapestPrice).toLocaleString()}`)
      if (carrier) lines.push(`  航空会社: ${carrier}`)
      if (dur > 0) lines.push(`  所要時間: ${formatDuration(dur)}`)
    } else {
      lines.push('  便が見つかりませんでした')
    }
    return lines.join('\n')
  })

  const userMessage = [
    'マルチシティ旅程の分析をお願いします。',
    '',
    ...segLines,
    '',
    `合計金額: ¥${Math.round(result.totalPrice).toLocaleString()}`,
    `区間数: ${result.segments.length}`,
    '',
    'この旅程の買い時を評価し、改善提案があればお知らせください。',
  ].join('\n')

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
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
    return Response.json({ error: 'AI分析の解析に失敗しました' }, { status: 500 })
  }

  const parsed = JSON.parse(jsonMatch[0])
  return Response.json(parsed)
}
