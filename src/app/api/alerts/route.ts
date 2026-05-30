import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { pushLineMessage, formatLineAlertMessage } from '@/lib/line'
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

  console.log('[alerts] New alert registered:', body)

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

async function sendConfirmationEmail(alert: AlertRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[alerts] RESEND_API_KEY not set — skipping email')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const discount = alert.currentPrice
    ? Math.round((1 - alert.targetPrice / alert.currentPrice) * 100)
    : null

  await resend.emails.send({
    from,
    to: alert.email!,
    subject: `✈️ 価格アラート設定完了 — ${alert.origin}→${alert.destination}`,
    html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#4f46e5;padding:24px 28px">
      <p style="margin:0;color:#fff;font-size:22px;font-weight:700">✈️ Tobira 価格アラート</p>
      <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px">アラートの設定が完了しました</p>
    </div>
    <div style="padding:28px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:100px">区間</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px">${alert.origin} → ${alert.destination}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">出発日</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px">${alert.departureDate}</td></tr>
        ${alert.currentPrice ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">現在価格</td>
            <td style="padding:8px 0;font-size:14px">¥${alert.currentPrice.toLocaleString()}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">目標価格</td>
            <td style="padding:8px 0;font-weight:700;font-size:18px;color:#4f46e5">¥${alert.targetPrice.toLocaleString()}${discount ? `<span style="font-size:12px;color:#10b981;margin-left:6px">${discount}% 引き</span>` : ''}</td></tr>
      </table>
      <div style="background:#eff6ff;border-radius:10px;padding:14px 16px;font-size:13px;color:#1e40af;line-height:1.6">
        🔔 目標価格を下回ったタイミングでお知らせします。<br>
        ※ 価格監視は近日実装予定です。現在は登録確認のみとなります。
      </div>
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
      Tobira — 世界への扉を、あなたの手に。
    </div>
  </div>
</body>
</html>`,
  })
}
