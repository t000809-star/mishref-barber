export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const stroke = tone === 'dark' ? '#0E4D3F' : '#F5EFE6'
  const accent = tone === 'dark' ? '#C9A24A' : '#C9A24A'
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <circle cx="14" cy="14" r="13" fill="none" stroke={stroke} strokeWidth="1.5" />
        <path d="M7 18 L14 9 L21 18" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="14" cy="20" r="1.5" fill={accent} />
      </svg>
      <span className={`font-display text-lg leading-none ${tone === 'dark' ? 'text-brand' : 'text-cream'}`}>
        Mishref Barber Co.
      </span>
    </span>
  )
}
