import { auth } from '@/lib/auth'
import { getCampaigns, getMarketingEmails } from '@/lib/hubspot'
import { NextRequest, NextResponse } from 'next/server'

const VALID_DAYS = [7, 28, 90, 360] as const
type ValidDays = (typeof VALID_DAYS)[number]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = req.nextUrl.searchParams.get('days')
  const parsed = raw ? parseInt(raw, 10) : 90
  const days: ValidDays = (VALID_DAYS as readonly number[]).includes(parsed)
    ? (parsed as ValidDays)
    : 90

  try {
    const [campaigns, emails] = await Promise.all([
      getCampaigns(days),
      // getMarketingEmails may 403 if the content scope is missing —
      // we catch it individually so it doesn't fail the whole request.
      getMarketingEmails(days).catch((err: unknown) => {
        console.warn(
          '[api/hubspot/campaigns] getMarketingEmails unavailable:',
          err instanceof Error ? err.message : err
        )
        return []
      }),
    ])

    console.log('[api/hubspot/campaigns] premier email stats:', JSON.stringify({
      id: emails[0]?.id,
      name: emails[0]?.name,
      clicks: (emails[0] as { clicks?: number })?.clicks,
      opens: (emails[0] as { opens?: number })?.opens,
      delivered: (emails[0] as { delivered?: number })?.delivered,
    }))

    return NextResponse.json({
      days,
      campaigns: { count: campaigns.length, data: campaigns },
      emails: { count: emails.length, data: emails },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/hubspot/campaigns]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
