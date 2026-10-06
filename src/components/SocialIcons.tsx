/** Inline brand marks (lucide v1 no longer ships brand icons). */
export function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" strokeLinejoin="round" />
      <path d="M9 8.5c0 3 2.5 6.5 6 6.8l1.2-1.4-1.9-1-0.9.8c-1.1-.5-2-1.4-2.5-2.5l.8-.9-1-1.9z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" strokeLinecap="round" />
      <path d="M14 3c.4 2.6 2.2 4.4 5 4.6" strokeLinecap="round" />
    </svg>
  );
}

export function FacebookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 8h-2a2 2 0 0 0-2 2v11M8.5 13H15" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9.5" />
    </svg>
  );
}
