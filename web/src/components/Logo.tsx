import React from 'react'

export default function Logo({ size = 32, withTagline = false }: Readonly<{ size?: number; withTagline?: boolean }>) {
  return (
    <div className="flex items-center gap-2">
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Twitan logo">
        <defs>
          <linearGradient id="twitanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8"/>
            <stop offset="100%" stopColor="#6366f1"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#twitanGrad)"/>
        <path d="M18 38c6-2 12-12 14-20 4 10 10 18 14 20 2 1 4 1 6 0-6 8-13 12-20 12S24 46 18 38z" fill="#fff" fillOpacity="0.9"/>
        <path d="M24 28h16M20 34h24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-tight">Twitan</div>
        {withTagline && <div className="text-[11px] md:text-xs opacity-70 -mt-0.5">Rally. Rank. Reign.</div>}
      </div>
    </div>
  )
}
