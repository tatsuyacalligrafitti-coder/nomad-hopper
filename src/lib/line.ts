import { createHmac } from 'crypto'

const PUSH_URL = 'https://api.line.me/v2/bot/message/push'

export function verifyLineSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const hash = createHmac('sha256', secret).update(rawBody).digest('base64')
  return hash === signature
}

export async function pushLineMessage(userId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.warn('[line] LINE_CHANNEL_ACCESS_TOKEN not set — skipping push')
    return
  }

  const res = await fetch(PUSH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`LINE push failed (${res.status}): ${detail}`)
  }
}
