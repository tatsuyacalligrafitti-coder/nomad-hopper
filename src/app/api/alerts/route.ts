import { NextRequest } from 'next/server'
import { pushLineMessage, formatLineAlertMessage } from '@/lib/line'
import { sendConfirmationEmail } from '@/lib/email'
import { saveAlert } from '@/lib/alert-store'
import type { AlertRequest } from '@/types'

export async function POST(request: NextRequest) {
  const body: AlertRequest = await request.json()

  if (!body.email && !body.lineUserId) {
    return Response.json(
      { error: 'メールアドレスまたはLINEユーザーIDが必要です' },
      { status: 400 }
    )
  }

  if (!body.origin || !body.destination || !body.departureDate || !body.targetPrice) {
    return Response.json({ error: '必須フィールドが不足しています' }, { status: 400 })
  }

  // Persist the alert so the price-monitor batch can pick it up later.
  // Failure here is non-fatal: the user still gets their confirmation below.
  try {
    const stored = await saveAlert(body)
    console.log('[alerts] New alert registered:', stored?.alertId ?? '(not persisted)')
  } catch (e) {
    console.error('[alerts] Alert persistence failed:', e)
  }

  if (body.email) {
    try {
      await sendConfirmationEmail(body)
    } catch (e) {
      console.error('[alerts] Email send failed:', e)
      // Non-fatal: still return success to user
    }
  }

  if (body.lineUserId) {
    try {
      await pushLineMessage(body.lineUserId, formatLineAlertMessage(body))
    } catch (e) {
      console.error('[alerts] LINE notification failed:', e)
    }
  }

  return Response.json({
    success: true,
    message: `¥${body.targetPrice.toLocaleString()}を下回った際に通知します`,
  })
}
