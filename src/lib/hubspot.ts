// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignType = 'CV' | 'PRES' | 'ELEARNING' | 'AUTRE'
export type CampaignAudience = 'MG' | 'CD' | 'MK' | 'PROSPECT' | 'CLIENTS' | 'AUTRE'

export interface ParsedCampaignName {
  type: CampaignType
  audience: CampaignAudience
  edition: string | null
  theme: string
  isABTest: boolean
  envoi: number | null
  periode: string | null
}

export interface HubSpotCampaignRaw {
  id: string
  properties: {
    hs_name?: string | null
    hs_start_date?: string | null
    hs_end_date?: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface HubSpotEmailRaw {
  id: string
  properties: {
    hs_name?: string | null
    hs_subject?: string | null
    hs_send_date?: string | null
    hs_email_status?: string | null
    hs_opens_count?: string | null
    hs_clicks_count?: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface Campaign extends ParsedCampaignName {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

export interface MarketingEmail extends ParsedCampaignName {
  id: string
  name: string
  subject: string | null
  sendDate: string | null
  status: string | null
  opensCount: number | null
  clicksCount: number | null
  createdAt: string
  updatedAt: string
}

interface HubSpotListResponse<T> {
  total?: number
  results: T[]
  paging?: {
    next?: {
      after: string
    }
  }
}

// ─── HubSpot client ───────────────────────────────────────────────────────────

const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

interface FetchOptions {
  /** Next.js ISR revalidation in seconds. Omit for no-store. */
  revalidate?: number
}

async function hubspotFetch<T>(
  path: string,
  params: Record<string, string> = {},
  options: FetchOptions = {}
): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')

  const url = new URL(`${HUBSPOT_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const nextOptions =
    options.revalidate !== undefined
      ? { next: { revalidate: options.revalidate } }
      : { cache: 'no-store' as const }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...nextOptions,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

// ─── parseEmailName ───────────────────────────────────────────────────────────

/**
 * Parse a HubSpot campaign name following Médéré naming convention:
 * [TYPE] - [AUDIENCE] - [EDITION?] - [THEME] (Xème envoi MMAAAA)
 *
 * Examples:
 *   "(A) CV - MG - Sommeil (5ème envoi 032026)"
 *   "PRES - CD - RM7 - Chirurgie guidée (2eme envoi 032026)"
 *   "CV - MK - Pathologies de l'épaule (3eme envoi 032026)"
 *   "PRES - MG (prospect) - RM7 - ECG (2eme envoi 032026)"
 */
export function parseEmailName(name: string): ParsedCampaignName {
  let working = name.trim()

  // 1. A/B test prefix
  const isABTest = /^\(A\)/i.test(working)
  if (isABTest) {
    working = working.replace(/^\(A\)\s*/i, '').trim()
  }

  // 2. Extract envoi + periode from end
  let envoi: number | null = null
  let periode: string | null = null

  const envoiMatch = working.match(
    /\((\d+)\s*[eè](?:me|re|r)?\s+envoi\s+(\d{6})\)\s*$/i
  )
  if (envoiMatch) {
    envoi = parseInt(envoiMatch[1], 10)
    periode = envoiMatch[2]
    working = working.slice(0, envoiMatch.index).trim()
  }

  // 3. Split by ' - '
  const parts = working.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean)

  // 4. Type (first segment)
  const rawType = parts[0]?.toUpperCase() ?? ''
  let type: CampaignType = 'AUTRE'
  if (rawType === 'CV') type = 'CV'
  else if (rawType === 'PRES') type = 'PRES'
  else if (rawType === 'ELEARNING' || rawType === 'E-LEARNING') type = 'ELEARNING'

  // 5. Audience (second segment — may contain sub-segment like "MG (prospect)")
  const rawAudience = parts[1] ?? ''
  const audienceBase = rawAudience.replace(/\s*\([^)]+\)/g, '').trim().toUpperCase()
  const qualifierMatch = rawAudience.match(/\(([^)]+)\)/i)
  const qualifier = qualifierMatch?.[1]?.trim().toUpperCase() ?? ''

  let audience: CampaignAudience = 'AUTRE'
  if (audienceBase === 'MG') audience = 'MG'
  else if (audienceBase === 'CD') audience = 'CD'
  else if (audienceBase === 'MK') audience = 'MK'
  else if (audienceBase === 'PROSPECT' || qualifier === 'PROSPECT') audience = 'PROSPECT'
  else if (audienceBase === 'CLIENTS' || qualifier === 'CLIENTS') audience = 'CLIENTS'

  // 6. Edition + theme from remaining segments
  const EDITION_RE = /^[A-Z]{1,4}\d+$/
  const remaining = parts.slice(2)

  let edition: string | null = null
  let themeStartIndex = 0

  if (remaining.length > 0 && EDITION_RE.test(remaining[0])) {
    edition = remaining[0]
    themeStartIndex = 1
  }

  const theme = remaining.slice(themeStartIndex).join(' - ').trim() || 'Sans thème'

  return { type, audience, edition, theme, isABTest, envoi, periode }
}

// ─── getCampaigns ─────────────────────────────────────────────────────────────

/**
 * Fetch all marketing campaign groups from HubSpot.
 * Requires scope: marketing.campaigns.read
 */
export async function getCampaigns(days: 7 | 28 | 90 | 360): Promise<Campaign[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString()

  const allRaw: HubSpotCampaignRaw[] = []
  let after: string | undefined

  do {
    const params: Record<string, string> = {
      limit: '100',
      properties: 'hs_name,hs_start_date,hs_end_date',
      ...(after ? { after } : {}),
    }

    const page = await hubspotFetch<HubSpotListResponse<HubSpotCampaignRaw>>(
      '/marketing/v3/campaigns',
      params,
      { revalidate: 300 }
    )

    allRaw.push(...page.results)
    after = page.paging?.next?.after
  } while (after)

  const filtered = allRaw.filter((c) => c.updatedAt >= sinceIso)

  return filtered.map((c) => {
    const name = c.properties.hs_name?.trim() || 'Sans nom'
    return {
      id: c.id,
      name,
      startDate: c.properties.hs_start_date ?? null,
      endDate: c.properties.hs_end_date ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      ...parseEmailName(name),
    }
  })
}

// ─── getMarketingEmails ───────────────────────────────────────────────────────

/**
 * Fetch individual marketing email sends from HubSpot.
 * Requires scope: content
 * Returns empty array and logs a warning if the scope is missing (403).
 */
export async function getMarketingEmails(
  days: 7 | 28 | 90 | 360
): Promise<MarketingEmail[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString()

  const EMAIL_PROPERTIES =
    'hs_name,hs_subject,hs_send_date,hs_email_status,hs_opens_count,hs_clicks_count'

  const allRaw: HubSpotEmailRaw[] = []
  let after: string | undefined

  do {
    const params: Record<string, string> = {
      limit: '50',
      properties: EMAIL_PROPERTIES,
      ...(after ? { after } : {}),
    }

    const page = await hubspotFetch<HubSpotListResponse<HubSpotEmailRaw>>(
      '/marketing/v3/emails',
      params,
      { revalidate: 300 }
    )

    allRaw.push(...page.results)
    after = page.paging?.next?.after
  } while (after)

  // Filter on send date if available, otherwise fall back to updatedAt
  const filtered = allRaw.filter((e) => {
    const date = e.properties.hs_send_date ?? e.updatedAt
    return date >= sinceIso
  })

  return filtered.map((e) => {
    const name = e.properties.hs_name?.trim() || 'Sans nom'
    const opensRaw = e.properties.hs_opens_count
    const clicksRaw = e.properties.hs_clicks_count
    return {
      id: e.id,
      name,
      subject: e.properties.hs_subject ?? null,
      sendDate: e.properties.hs_send_date ?? null,
      status: e.properties.hs_email_status ?? null,
      opensCount: opensRaw != null ? parseInt(opensRaw, 10) : null,
      clicksCount: clicksRaw != null ? parseInt(clicksRaw, 10) : null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      ...parseEmailName(name),
    }
  })
}
