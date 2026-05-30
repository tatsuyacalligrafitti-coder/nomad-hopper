import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?line_error=auth_failed`)
  }

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${baseUrl}/api/auth/line/callback`,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[auth/line/callback] token exchange failed:', tokenData)
      return NextResponse.redirect(`${baseUrl}/?line_error=token_failed`)
    }

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json()

    const redirectParams = new URLSearchParams({
      line_user_id: profile.userId ?? '',
      line_display_name: profile.displayName ?? '',
    })

    return NextResponse.redirect(`${baseUrl}/?${redirectParams}`)
  } catch (e) {
    console.error('[auth/line/callback]', e)
    return NextResponse.redirect(`${baseUrl}/?line_error=unknown`)
  }
}
