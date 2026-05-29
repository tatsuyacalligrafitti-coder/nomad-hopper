import { NextRequest } from 'next/server'
import type { MultiCitySearchResult, SearchMode } from '@/types'

const MARKET_RATES = `各区間の相場知識：
- 東京↔バンコク エコノミー往復：6〜12万円、ビジネス：20〜40万円
- 東京↔ナイロビ エコノミー往復：20〜35万円
- 東京↔ロンドン エコノミー往復：10〜18万円、ビジネス：40〜80万円
- バンコク↔ナイロビ エコノミー片道：5〜15万円
- バンコク↔ロンドン エコノミー片道：5〜12万円
- シンガポール↔欧州 エコノミー片道：5〜10万円
- 東京↔ニューヨーク エコノミー往復：12〜22万円`

const MODE_INSTRUCTIONS: Record<SearchMode, string> = {
  price: `【評価基準：価格優先】
安さを最優先に評価してください。相場より安ければ◎今すぐ、相場内なら△様子見、相場より高ければ✗待つべきとしてください。所要時間や乗り継ぎ回数は二次的な情報として添える程度にとどめてください。`,

  fastest: `【評価基準：最速】
所要時間の短さを最優先に評価してください。乗り継ぎが少なく総移動時間が短ければ、価格が高くても◎今すぐとしてください。時短が実現できていなければ✗待つべきとしてください。価格は二次的な判断材料です。`,

  balance: `【評価基準：バランス】
価格と所要時間のバランスを評価してください。両方が妥当であれば◎今すぐ、どちらかが極端に悪ければ△様子見〜✗待つべきとしてください。一方だけが優れていても過大評価しないでください。`,

  elegant: `【評価基準：優雅・ビジネスクラス】
これはビジネスクラスの旅程です。エコノミー相場と比較してはいけません。ビジネスクラスの相場（東京↔バンコク往復30〜60万、東京↔ナイロビ往復80〜150万、東京↔ロンドン往復40〜80万程度）と比較し、ビジネスクラスとして妥当な価格か、快適性に見合うかで評価してください。高額であること自体を否定的に扱わないでください。`,
}

function buildSystemPrompt(mode: SearchMode): string {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return `今日の日付は${today}です。

あなたは航空券の価格分析の専門家です。以下のマルチシティ旅程データを分析して日本語で答えてください。必ずJSON形式のみで回答してください：

{
  "verdict": "◎今すぐ",
  "reason": "全体的な評価と買い時の判断を2〜3文で",
  "recommended": "最もおすすめの区間の組み合わせや乗り方を具体的に説明",
  "tip": "具体的な改善提案（逆ルート・日程変更・航空会社変更など。提案がない場合はnull）"
}

verdictは必ず「◎今すぐ」「△様子見」「✗待つべき」のいずれかにしてください。

${MODE_INSTRUCTIONS[mode]}

${MARKET_RATES}

逆ルートの可能性、滞在日数の調整、エチオピア航空・カタール航空・エミレーツ航空などの代替航空会社も提案してください。`
}

interface RequestBody {
  result: MultiCitySearchResult
  mode?: SearchMode
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}時間${m}分` : `${h}時間`
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { result, mode = 'price' } = body

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
      const stops = seg.cheapestFlight.stops
      const dur = seg.cheapestFlight.totalDuration
      lines.push(`  金額: ¥${Math.round(seg.cheapestPrice).toLocaleString()}`)
      if (carrier) lines.push(`  航空会社: ${carrier}`)
      if (dur > 0) lines.push(`  所要時間: ${formatDuration(dur)}`)
      lines.push(`  乗り継ぎ: ${stops === 0 ? '直行' : `${stops}回`}`)
    } else {
      lines.push('  便が見つかりませんでした')
    }
    return lines.join('\n')
  })

  const userMessage = [
    'マルチシティ旅程の分析をお願いします。以下は現在選択中の便の情報です。',
    '',
    ...segLines,
    '',
    `選択中の合計金額: ¥${Math.round(result.totalPrice).toLocaleString()}`,
    `区間数: ${result.segments.length}`,
    '',
    'この旅程を評価し、おすすめの乗り方と改善提案をお願いします。',
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
      max_tokens: 1000,
      system: buildSystemPrompt(mode),
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
