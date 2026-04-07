import { auth } from '@/lib/auth'
import { getCampaigns, getMarketingEmails } from '@/lib/hubspot'
import { NextRequest, NextResponse } from 'next/server'

const VALID_DAYS = [7, 28, 90, 360] as const
type ValidDays = (typeof VALID_DAYS)[number]

const CACHE_TTL = 300 // 5 minutes

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

    return NextResponse.json(
      {
        days,
        campaigns: { count: campaigns.length, data: campaigns },
        emails: { count: emails.length, data: emails },
      },
      {
        headers: {
          'Cache-Control': `private, max-age=${CACHE_TTL}`,
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/hubspot/campaigns]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
