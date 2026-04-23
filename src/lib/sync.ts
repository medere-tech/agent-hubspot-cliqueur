import { getTopClickers, parseEmailName } from '@/lib/hubspot'
import { getInscriptionsByEmail } from '@/lib/airtable'
import { createSupabaseAdmin } from '@/lib/supabase'

const HUBSPOT_BASE_URL = 'https://api.hubapi.com'
const DAYS_360_MS = 360 * 24 * 60 * 60 * 1000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeCount {
  theme: string
  clicks: number
  lastClick: string // ISO date
}

export interface ContactClickThemes {
  email: string
  contactId: string
  totalClicks: number
  themes: ThemeCount[]
}

export interface SyncResult {
  synced: number
  errors: number
  duration: number // ms
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface ClickEvent {
  type: string
  emailCampaignId?: number
  created: number
}

interface EventsPage {
  hasMore: boolean
  offset?: string
  events: ClickEvent[]
}

interface CampaignDetail {
  name?: string
}

// ─── Campaign name cache (lives for the duration of one sync run) ─────────────

const campaignNameCache = new Map<number, string | null>()

async function fetchCampaignName(campaignId: number, token: string): Promise<string | null> {
  if (campaignNameCache.has(campaignId)) return campaignNameCache.get(campaignId)!

  try {
    const res = await fetch(`${HUBSPOT_BASE_URL}/email/public/v1/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) { campaignNameCache.set(campaignId, null); return null }
    const data = (await res.json()) as CampaignDetail
    const name = data.name ?? null
    campaignNameCache.set(campaignId, name)
    return name
  } catch {
    campaignNameCache.set(campaignId, null)
    return null
  }
}

// ─── getContactClickThemes ────────────────────────────────────────────────────

/**
 * Fetch all CLICK events for a contact (360 days) and aggregate by theme.
 * Uses /email/public/v1/events?type=CLICK&recipient={email}.
 * Returns only themes with >= 3 clicks, sorted by clicks desc.
 */
export async function getContactClickThemes(email: string): Promise<ContactClickThemes> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')

  const sinceMs = Date.now() - DAYS_360_MS
  const campaignClickMap = new Map<number, { count: number; lastClick: number }>()

  let offset: string | undefined

  do {
    const url = new URL(`${HUBSPOT_BASE_URL}/email/public/v1/events`)
    url.searchParams.set('type', 'CLICK')
    url.searchParams.set('recipient', email)
    url.searchParams.set('limit', '100')
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) break

    const data = (await res.json()) as EventsPage
    let hitOldEvent = false

    for (const event of data.events ?? []) {
      if (event.created < sinceMs) { hitOldEvent = true; break }
      if (event.type !== 'CLICK' || !event.emailCampaignId) continue

      const existing = campaignClickMap.get(event.emailCampaignId)
      if (existing) {
        existing.count++
        if (event.created > existing.lastClick) existing.lastClick = event.created
      } else {
        campaignClickMap.set(event.emailCampaignId, { count: 1, lastClick: event.created })
      }
    }

    if (hitOldEvent) break
    offset = data.hasMore ? data.offset : undefined
  } while (offset)

  // Resolve campaign IDs → names → themes
  const themeMap = new Map<string, { clicks: number; lastClick: number }>()

  for (const [campaignId, { count, lastClick }] of campaignClickMap) {
    const name = await fetchCampaignName(campaignId, token)
    if (!name) continue

    const { theme } = parseEmailName(name)
    if (!theme || theme === 'Sans thème' || theme === 'Newsletter') continue

    const existing = themeMap.get(theme)
    if (existing) {
      existing.clicks += count
      if (lastClick > existing.lastClick) existing.lastClick = lastClick
    } else {
      themeMap.set(theme, { clicks: count, lastClick })
    }
  }

  const themes: ThemeCount[] = [...themeMap.entries()]
    .filter(([, { clicks }]) => clicks >= 3)
    .map(([theme, { clicks, lastClick }]) => ({
      theme,
      clicks,
      lastClick: new Date(lastClick).toISOString(),
    }))
    .sort((a, b) => b.clicks - a.clicks)

  return { email: email.toLowerCase(), contactId: '', totalClicks: 0, themes }
}

// ─── syncAllTopClickers ───────────────────────────────────────────────────────

/**
 * Full sync: top 100 HubSpot clickers → click themes → Supabase upsert.
 * Sequential processing to respect HubSpot rate limits (~10 req/s v1 API).
 *
 * @param onProgress  Optional callback for real-time log messages.
 * @param maxContacts Limit for testing (default: all 100).
 */
export async function syncAllTopClickers(
  onProgress?: (msg: string) => void,
  maxContacts?: number
): Promise<SyncResult> {
  const start = Date.now()

  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')

  const supabase = createSupabaseAdmin()
  campaignNameCache.clear()

  onProgress?.('[sync] Récupération des top cliqueurs HubSpot...')
  const allClickers = await getTopClickers(360)
  const clickers = maxContacts ? allClickers.slice(0, maxContacts) : allClickers

  onProgress?.(`[sync] ${clickers.length} contacts à synchroniser`)
  onProgress?.('[sync] Récupération des inscriptions Airtable...')

  const emails = clickers.map((c) => c.emailAddress)
  const inscriptionsMap = await getInscriptionsByEmail(emails)

  onProgress?.(`[sync] Inscriptions chargées — démarrage de la sync contact par contact`)

  let synced = 0
  let errors = 0

  for (let i = 0; i < clickers.length; i++) {
    const contact = clickers[i]
    const label = `Contact ${i + 1}/${clickers.length} — ${contact.emailAddress}`
    onProgress?.(label)

    try {
      // 1. Fetch click events and derive themes
      const clickThemes = await getContactClickThemes(contact.emailAddress)

      // 2. Cross-reference inscriptions
      const inscriptions = inscriptionsMap.get(contact.emailAddress.toLowerCase()) ?? []
      const isInscrit = inscriptions.length > 0

      // 3. Upsert to Supabase
      const row = {
        email:          contact.emailAddress.toLowerCase(),
        contact_id:     String(contact.contactId),
        total_clicks:   contact.totalClicks,
        themes:         clickThemes.themes,
        is_inscrit:     isInscrit,
        inscriptions:   inscriptions.map((ins) => ({
          nomFormation: ins.nomFormation,
          specialite:   ins.specialite,
          dateCreation: ins.dateCreation,
        })),
        last_synced_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('contact_click_themes')
        .upsert(row, { onConflict: 'email' })

      if (error) throw new Error(error.message)

      synced++
      onProgress?.(`  → OK — ${clickThemes.themes.length} thème(s) — inscrit=${isInscrit}`)
    } catch (err) {
      errors++
      onProgress?.(`  → ERREUR — ${err instanceof Error ? err.message : String(err)}`)
    }

    // 150ms between contacts to stay under HubSpot v1 rate limit (100 req/10s)
    if (i < clickers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  const duration = Date.now() - start
  onProgress?.(`[sync] Terminé — ${synced} synced, ${errors} errors, ${(duration / 1000).toFixed(1)}s`)

  return { synced, errors, duration }
}
