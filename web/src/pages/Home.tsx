import React, { useEffect, useMemo, useState } from 'react'
import { auth, httpsCallable, functions, onAuthStateChanged, isEmulator, db } from '../lib/firebase'
import { EventTypes, EventNames } from '../../../shared/events'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

export default function Home() {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [tournaments, setTournaments] = useState<Array<{ id: string; name: string; type: string; status?: string }>>([])
  const visibleTournaments = useMemo(() => tournaments.filter(t => t.status !== 'deleted'), [tournaments])
  const activeCount = visibleTournaments.filter(t => t.status !== 'archived').length
  
  const nav = useNavigate()

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        nav('/')
        return
      }
      // Listen to tournaments created by this user
      const q = query(
        collection(db, 'tournaments'),
        where('createdBy', '==', u.uid),
        orderBy('createdAt', 'desc')
      )
  const mapDoc = (d: any) => ({ id: d.id, ...d.data() })
      const unsubT = onSnapshot(q, (snap) => {
        const list = snap.docs.map(mapDoc)
        setTournaments(list as any)
      })
      return () => unsubT()
    })
    return () => unsubAuth()
  }, [nav])

  async function createTournament() {
    try {
      setMsg('')
      // simple gating: allow >5 only for premium (placeholder)
  const isPremium = false // placeholder for premium checks
      if (!isPremium && activeCount >= 5) {
        setMsg('Limit reached: Free users can have at most 5 active tournaments. Delete one or upgrade to premium.')
        return
      }
      const call = httpsCallable(functions, 'addEvent')
      const res = await call({
        eventType: EventTypes.Tournament,
        eventName: EventNames.Tournament.CreateBadmintonTournament,
        eventPayload: { type: 'Badminton', name },
      })
      setMsg(`Tournament queued. Event ID: ${(res.data as any).id}`)
    } catch (e: any) {
      setMsg(e.message || String(e))
    }
  }

  async function deleteTournament(tournamentId: string) {
    try {
      setMsg('')
      const call = httpsCallable(functions, 'addEvent')
      const res = await call({
        eventType: EventTypes.Tournament,
        eventName: EventNames.Tournament.DeleteTournament,
        eventPayload: { tournamentId },
      })
      setMsg(`Delete queued. Event ID: ${(res.data as any).id}`)
    } catch (e: any) {
      setMsg(e.message || String(e))
    }
  }

  

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="max-w-3xl w-full mx-auto p-4 flex-1">
      <div className="card bg-base-100 shadow-md p-6 gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Home</h2>
        </div>
        {isEmulator && (
          <div className="alert alert-info">
            <span>Using Firebase Emulators</span>
          </div>
        )}
        <label className="label" htmlFor="tname">Tournament name</label>
        <input id="tname" className="input input-bordered w-full" placeholder="Summer Open 2025" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" onClick={createTournament}>Create a new tournament</button>
        {msg && <p className="text-sm opacity-80">{msg}</p>}
        <div className="divider">Your tournaments</div>
        {visibleTournaments.length === 0 ? (
          <p className="text-sm opacity-70">No tournaments yet.</p>
        ) : (
          <ul className="menu bg-base-200 rounded-box">
            {visibleTournaments.map(t => (
              <li key={t.id}>
                <div className="flex items-center justify-between gap-2">
                  <span>{t.name} <span className="badge badge-ghost ml-2">{t.type}</span></span>
                  <div className="flex items-center gap-2">
                    {t.status && t.status !== 'active' && <span className="badge">{t.status}</span>}
                    <button className="btn btn-xs btn-primary" onClick={() => nav(`/tournament?id=${t.id}`)}>Edit</button>
                    <button className="btn btn-xs btn-error" onClick={() => deleteTournament(t.id)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </main>
    </div>
  )
}
