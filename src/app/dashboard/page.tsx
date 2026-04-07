'use client'

import type { Campaign, MarketingEmail } from '@/lib/hubspot'
import { useCallback, useEffect, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 7 | 28 | 90 | 360

interface ApiResponse {
  days: number
  campaigns: { count: number; data: Campaign[] }
  emails: { count: number; data: MarketingEmail[] }
}

interface ThemeRow {
  theme: string
  type: string
  audiences: string[]
  emailCount: number
  totalClicks: number | null
  totalOpens: number | null
  isABTest: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeThemeRows(emails: MarketingEmail[]): ThemeRow[] {
  const map = new Map<string, ThemeRow>()

  for (const e of emails) {
    const key = `${e.theme}__${e.type}`
    const existing = map.get(key)
    if (existing) {
      existing.emailCount++
      if (!existing.audiences.includes(e.audience)) existing.audiences.push(e.audience)
      if (e.isABTest) existing.isABTest = true
      if (e.clicksCount != null)
        existing.totalClicks = (existing.totalClicks ?? 0) + e.clicksCount
      if (e.opensCount != null)
        existing.totalOpens = (existing.totalOpens ?? 0) + e.opensCount
    } else {
      map.set(key, {
        theme: e.theme,
        type: e.type,
        audiences: [e.audience],
        emailCount: 1,
        totalClicks: e.clicksCount,
        totalOpens: e.opensCount,
        isABTest: e.isABTest,
      })
    }
  }

  return [...map.values()].sort((a, b) => b.emailCount - a.emailCount)
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-[#f5f5f5] rounded-[4px] animate-pulse ${className ?? ''}`} />
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  loading,
}: {
  label: string
  value: string | number
  loading: boolean
}) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-[6px] p-5">
      <p className="text-xs text-[#737373] font-medium tracking-wide uppercase mb-3">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <p className="text-2xl font-semibold text-[#0a0a0a] leading-none">{value}</p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>(90)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async (days: Period) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/hubspot/campaigns?days=${days}`)
      console.log('[dashboard] API status:', res.status)
      const json: ApiResponse = await res.json()
      console.log('[dashboard] API response:', json)
      console.log('[dashboard] emails:', json.emails)
      if (!res.ok) throw new Error((json as unknown as { error?: string })?.error ?? `Erreur ${res.status}`)
      setData(json)
    } catch (err) {
      console.error('[dashboard] API error:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [period, fetchData])

  const campaigns = data?.campaigns
  const emails = data?.emails
  const emailList = emails?.data ?? []

  const uniqueThemes = new Set(emailList.map((e) => e.theme)).size
  const uniqueAudiences = new Set(emailList.map((e) => e.audience)).size
  const themeRows = computeThemeRows(emailList)

  const PERIODS: { label: string; value: Period }[] = [
    { label: '7 j', value: 7 },
    { label: '28 j', value: 28 },
    { label: '90 j', value: 90 },
    { label: '360 j', value: 360 },
  ]

  return (
    <div className="px-8 py-8 max-w-[1200px]">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-sm text-[#737373] mt-0.5">
            Analyse des campagnes email HubSpot
          </p>
        </div>

        <div className="flex items-center border border-[#e5e5e5] rounded-[4px] overflow-hidden">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === value
                  ? 'bg-[#0a0a0a] text-white'
                  : 'bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#0a0a0a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-6 border border-red-200 bg-red-50 rounded-[4px]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" stroke="#ef4444" strokeWidth="1.2" />
            <path d="M7 4.5v3M7 9.5v.2" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total campagnes"
          value={campaigns?.count ?? 0}
          loading={loading}
        />
        <MetricCard
          label="Emails envoyés"
          value={emails?.count ?? 0}
          loading={loading}
        />
        <MetricCard
          label="Thématiques uniques"
          value={uniqueThemes}
          loading={loading}
        />
        <MetricCard
          label="Audiences actives"
          value={uniqueAudiences}
          loading={loading}
        />
      </div>

      {/* Theme table */}
      <div className="bg-white border border-[#e5e5e5] rounded-[6px]">
        <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0a0a0a]">Thématiques</h2>
          {!loading && (
            <span className="text-xs text-[#a3a3a3]">
              {themeRows.length} thème{themeRows.length !== 1 ? 's' : ''}
              {emails?.count === 0 && (
                <span className="ml-2 text-[#a3a3a3]">— emails non disponibles (scope manquant)</span>
              )}
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f5f5f5]">
              {['Thème', 'Type', 'Audience(s)', 'Emails', 'Clics', 'Ouvertures'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-[#a3a3a3] tracking-wide uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#f5f5f5] last:border-0">
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-8" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-8" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-14" /></td>
                </tr>
              ))
            ) : themeRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#a3a3a3]">
                  {emails?.count === 0
                    ? 'Les emails individuels nécessitent le scope "content" dans l\'app HubSpot.'
                    : 'Aucun email sur cette période.'}
                </td>
              </tr>
            ) : (
              themeRows.map((row, i) => (
                <tr
                  key={`${row.theme}-${i}`}
                  className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors"
                >
                  <td className="px-5 py-3.5 text-[#0a0a0a] font-medium">
                    <span className="flex items-center gap-2">
                      {row.theme}
                      {row.isABTest && (
                        <span className="text-[10px] font-semibold text-[#737373] border border-[#e5e5e5] px-1.5 py-0.5 rounded-[2px]">
                          A/B
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#737373]">{row.type}</td>
                  <td className="px-5 py-3.5 text-[#737373]">{row.audiences.join(', ')}</td>
                  <td className="px-5 py-3.5 text-[#0a0a0a] tabular-nums">{row.emailCount}</td>
                  <td className="px-5 py-3.5 text-[#0a0a0a] tabular-nums">
                    {row.totalClicks ?? <span className="text-[#a3a3a3]">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-[#0a0a0a] tabular-nums">
                    {row.totalOpens ?? <span className="text-[#a3a3a3]">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
