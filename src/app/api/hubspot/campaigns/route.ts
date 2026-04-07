import { auth } from '@/lib/auth'
import { getCampaigns } from '@/lib/hubspot'
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
    const campaigns = await getCampaigns(days)
    return NextResponse.json({ days, count: campaigns.length, campaigns })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/hubspot/campaigns]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
