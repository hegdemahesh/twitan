import React, { useEffect, useState } from 'react'
import { auth, httpsCallable, functions, onAuthStateChanged, signOut } from '../lib/firebase'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) nav('/')
    })
    return () => unsub()
  }, [nav])

  async function createTournament() {
    try {
      setMsg('')
      const call = httpsCallable(functions, 'addEvent')
      const res = await call({
        eventType: 'tournament',
        eventName: 'createBadmintonTournament',
        eventPayload: { type: 'Badminton', name },
      })
      setMsg(`Tournament queued. Event ID: ${(res.data as any).id}`)
    } catch (e: any) {
      setMsg(e.message || String(e))
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="card bg-base-100 shadow-md p-6 gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Home</h2>
          <button className="btn btn-secondary" onClick={() => signOut(auth)}>Logout</button>
        </div>
        <label className="label" htmlFor="tname">Tournament name</label>
        <input id="tname" className="input input-bordered w-full" placeholder="Summer Open 2025" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" onClick={createTournament}>Create a new tournament</button>
        {msg && <p className="text-sm opacity-80">{msg}</p>}
      </div>
    </div>
  )
}
