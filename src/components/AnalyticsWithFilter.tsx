'use client'

import { Analytics, type BeforeSend, type BeforeSendEvent } from '@vercel/analytics/react'

// Strip everything after the path: query strings can carry user search terms
// (e.g. ?q=沖縄 3泊) and hashes can carry deep-link state. Only origin + pathname
// is reported. If the URL cannot be parsed we drop the event rather than risk
// sending an unfiltered value.
const stripQueryAndHash: BeforeSend = (event: BeforeSendEvent): BeforeSendEvent | null => {
  try {
    const url = new URL(event.url)
    return { ...event, url: `${url.origin}${url.pathname}` }
  } catch {
    return null
  }
}

export default function AnalyticsWithFilter() {
  return <Analytics beforeSend={stripQueryAndHash} />
}
