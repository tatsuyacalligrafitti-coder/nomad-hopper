import { randomBytes } from 'crypto'

export async function GET() {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID
  if (!clientId) {
    return Response.json({ error: 'LINE_LOGIN_CHANNEL_ID not configured' }, { status: 500 })
  }

  const state = randomBytes(16).toString('hex')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${baseUrl}/api/auth/line/callback`,
    state,
    scope: 'profile',
  })

  return Response.json({
    url: `https://access.line.me/oauth2/v2.1/authorize?${params}`,
  })
}
