import React from 'react'
import Logo from './Logo'
import { auth, signOut } from '../lib/firebase'

export default function Header({ showTagline = false }: Readonly<{ showTagline?: boolean }>) {
  return (
    <header className="w-full sticky top-0 z-10 bg-base-100/90 backdrop-blur border-b border-base-200">
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-2 md:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Logo size={28} withTagline={showTagline} />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm md:btn-md" onClick={() => signOut(auth)}>Logout</button>
        </div>
      </div>
    </header>
  )
}
