import React, { useEffect, useState } from 'react'
import Logo from './Logo'
import { auth, signOut } from '../lib/firebase'
import { FiLogOut, FiUser } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'

export default function Header({ showTagline = false }: Readonly<{ showTagline?: boolean }>) {
  const nav = useNavigate()
  const [theme, setTheme] = useState<string>('twitan-light')

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const next = saved || 'twitan-light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }, [])

  function toggleTheme() {
    const next = theme === 'twitan-light' ? 'twitan' : 'twitan-light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }
  return (
    <header className="w-full sticky top-0 z-10 bg-base-100/80 backdrop-blur border-b border-base-200">
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-2 md:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Logo size={28} withTagline={showTagline} />
        </div>
        <div className="flex items-center gap-2">
          <div className="form-control">
            <label className="label cursor-pointer gap-2">
              <span className="label-text">Light</span>
              <input type="checkbox" className="toggle" checked={theme !== 'twitan-light'} onChange={toggleTheme} />
              <span className="label-text">Dark</span>
            </label>
          </div>
          <button className="btn btn-sm md:btn-md btn-ghost gap-2" onClick={() => nav('/profile')}>
            <FiUser />
            <span className="hidden sm:inline">My profile</span>
          </button>
          <button className="btn btn-sm md:btn-md btn-ghost gap-2" onClick={() => signOut(auth)}>
            <FiLogOut />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
