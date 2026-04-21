'use client'

import type { TopClicker } from '@/lib/hubspot'
import { useCallback, useEffect, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

type Period = 7 | 28 | 90 | 360

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiResponse {
  days: number
  count: number
  contacts: TopClicker[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

function downloadCSV(contacts: TopClicker[], days: Period) {
  const header = ['Email', 'Clics totaux', 'Thématiques', 'Audiences']
  const rows = contacts.map((c) => [
    c.emailAddress,
    String(c.totalClicks),
    c.clickedThemes.join(' | '),
    c.audiences.join(' | '),
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `top-cliqueurs-${days}j-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-[#f5f5f5] rounded-[4px] animate-pulse ${className ?? ''}`} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopCliqueurs() {
  const [period, setPeriod] = useState<Period>(90)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<PageSizeOption>(10)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (days: Period) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/hubspot/top-cliqueurs?days=${days}`)
      const json: ApiResponse = await res.json()
      if (!res.ok) throw new Error((json as unknown as { error?: string })?.error ?? `Erreur ${res.status}`)
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])
  useEffect(() => { setPage(0) }, [search, period, pageSize])

  // ── Data derivation ────────────────────────────────────────────────────────
  const contacts = data?.contacts ?? []

  const filteredContacts = search.trim()
    ? contacts.filter((c) => {
        const q = search.toLowerCase()
        return (
          c.emailAddress.toLowerCase().includes(q) ||
          c.clickedThemes.some((t) => t.toLowerCase().includes(q)) ||
          c.audiences.some((a) => a.toLowerCase().includes(q))
        )
      })
    : contacts

  const totalRows  = filteredContacts.length
  const pageRows   = filteredContacts.slice(page * pageSize, (page + 1) * pageSize)
  const hasPrev    = page > 0
  const hasNext    = (page + 1) * pageSize < totalRows
  const rangeStart = totalRows === 0 ? 0 : page * pageSize + 1
  const rangeEnd   = Math.min((page + 1) * pageSize, totalRows)

  const PERIODS: { label: string; value: Period }[] = [
    { label: '7 j',   value: 7 },
    { label: '28 j',  value: 28 },
    { label: '90 j',  value: 90 },
    { label: '360 j', value: 360 },
  ]

  return (
    <div className="px-8 py-8 max-w-[1200px]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">Top cliqueurs</h1>
          <p className="text-sm text-[#737373] mt-0.5">Contacts les plus engagés sur les campagnes email</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
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

          {/* Export CSV */}
          {!loading && contacts.length > 0 && (
            <button
              onClick={() => downloadCSV(filteredContacts, period)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#737373] bg-white border border-[#e5e5e5] rounded-[4px] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 2v7M4.5 6.5L7 9l2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11v.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-6 border border-red-200 bg-red-50 rounded-[4px]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" stroke="#ef4444" strokeWidth="1.2" />
            <path d="M7 4.5v3M7 9.5v.2" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="5.5" cy="5.5" r="4" stroke="#a3a3a3" strokeWidth="1.2" />
            <path d="M8.5 8.5l3.5 3.5" stroke="#a3a3a3" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un contact, une thématique, une audience…"
          className="w-full pl-9 pr-4 py-2.5 text-sm text-[#0a0a0a] placeholder-[#a3a3a3] bg-white border border-[#e5e5e5] rounded-[4px] outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a] transition-all duration-150"
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e5e5e5] rounded-[6px]">

        {/* Table header */}
        <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0a0a0a]">Contacts</h2>
          {!loading && (
            <span className="text-xs text-[#a3a3a3]">
              {totalRows} contact{totalRows !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f5f5f5]">
              {['Contact', 'Clics totaux', 'Thématiques', 'Audiences'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-medium text-[#a3a3a3] tracking-wide uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[#f5f5f5] last:border-0">
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-52" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-14" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-72" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-4 w-16" /></td>
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-[#a3a3a3]">
                  {search.trim()
                    ? 'Aucun résultat pour cette recherche.'
                    : 'Aucun contact cliqueur sur cette période.'}
                </td>
              </tr>
            ) : (
              pageRows.map((c, i) => (
                <tr
                  key={`${c.emailAddress}-${i}`}
                  className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors"
                >
                  {/* Contact */}
                  <td className="px-5 py-3.5 font-medium text-[#0a0a0a] whitespace-nowrap">
                    {c.emailAddress}
                  </td>

                  {/* Clics totaux */}
                  <td className="px-5 py-3.5 text-[#0a0a0a] tabular-nums font-semibold whitespace-nowrap">
                    {fmtNumber(c.totalClicks)}
                  </td>

                  {/* Thématiques — badges */}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {c.clickedThemes.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-medium text-[#737373] border border-[#e5e5e5] px-1.5 py-0.5 rounded-[2px] whitespace-nowrap"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Audiences */}
                  <td className="px-5 py-3.5 text-[#737373] whitespace-nowrap">
                    {c.audiences.join(', ')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ── Pagination ──────────────────────────────────────────────────────── */}
        {!loading && totalRows > 0 && (
          <div className="px-5 py-3 border-t border-[#e5e5e5] flex items-center justify-between gap-4">

            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrev}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                hasPrev ? 'text-[#0a0a0a] hover:text-[#737373]' : 'text-[#d4d4d4] cursor-not-allowed'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Précédent
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[#737373]">
                {rangeStart}–{rangeEnd} sur {totalRows} contact{totalRows !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center border border-[#e5e5e5] rounded-[4px] overflow-hidden">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      pageSize === size
                        ? 'bg-[#0a0a0a] text-white'
                        : 'bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#0a0a0a]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                hasNext ? 'text-[#0a0a0a] hover:text-[#737373]' : 'text-[#d4d4d4] cursor-not-allowed'
              }`}
            >
              Suivant
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5.5 3L9.5 7l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

          </div>
        )}

      </div>
    </div>
  )
}
