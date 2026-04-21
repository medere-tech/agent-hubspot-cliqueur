export default function TopCliqueurs() {
  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">Top cliqueurs</h1>
        <p className="text-sm text-[#737373] mt-0.5">Contacts les plus engagés par thématique</p>
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-[6px] px-8 py-16 text-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4" aria-hidden="true">
          <circle cx="16" cy="11" r="5" stroke="#d4d4d4" strokeWidth="1.5" />
          <path d="M6 26c0-4.418 4.477-8 10-8s10 3.582 10 8" stroke="#d4d4d4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-[#0a0a0a]">En cours de développement</p>
        <p className="text-xs text-[#a3a3a3] mt-1">Cette fonctionnalité sera disponible prochainement.</p>
      </div>
    </div>
  )
}
