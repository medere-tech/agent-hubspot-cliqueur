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
  name: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
  currencyCode?: string
}

export interface Campaign extends ParsedCampaignName {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

interface HubSpotListResponse {
  results: HubSpotCampaignRaw[]
  paging?: {
    next?: {
      after: string
    }
  }
}

// ─── HubSpot client ───────────────────────────────────────────────────────────

const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

async function hubspotFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')

  const url = new URL(`${HUBSPOT_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
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

  // 2. Extract envoi + periode from end: (Xème envoi MMAAAA) / (Xeme envoi MMAAAA)
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
  // Strip any parenthesised qualifier like "(prospect)"
  const audienceBase = rawAudience.replace(/\s*\([^)]+\)/g, '').trim().toUpperCase()
  // Also check the qualifier itself for PROSPECT / CLIENTS
  const qualifierMatch = rawAudience.match(/\(([^)]+)\)/i)
  const qualifier = qualifierMatch?.[1]?.trim().toUpperCase() ?? ''

  let audience: CampaignAudience = 'AUTRE'
  if (audienceBase === 'MG') audience = 'MG'
  else if (audienceBase === 'CD') audience = 'CD'
  else if (audienceBase === 'MK') audience = 'MK'
  else if (audienceBase === 'PROSPECT' || qualifier === 'PROSPECT') audience = 'PROSPECT'
  else if (audienceBase === 'CLIENTS' || qualifier === 'CLIENTS') audience = 'CLIENTS'

  // 6. Edition + theme from remaining segments
  // Edition = short all-caps + digits segment like RM7, RM8 — no spaces
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
 * Fetch all marketing campaigns from HubSpot for the given period,
 * then parse each name with parseEmailName.
 */
export async function getCampaigns(days: 7 | 28 | 90 | 360): Promise<Campaign[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString()

  const allRaw: HubSpotCampaignRaw[] = []
  let after: string | undefined

  // Paginate through all results
  do {
    const params: Record<string, string> = {
      limit: '100',
      ...(after ? { after } : {}),
    }

    const page = await hubspotFetch<HubSpotListResponse>(
      '/marketing/v3/campaigns',
      params
    )

    allRaw.push(...page.results)
    after = page.paging?.next?.after
  } while (after)

  // Filter by creation date on our side (API doesn't expose date range filter)
  const filtered = allRaw.filter((c) => {
    const date = c.createdAt ?? c.updatedAt
    return date >= sinceIso
  })

  // Parse and assemble
  return filtered.map((c) => ({
    id: c.id,
    name: c.name,
    startDate: c.startDate ?? null,
    endDate: c.endDate ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    ...parseEmailName(c.name),
  }))
}
