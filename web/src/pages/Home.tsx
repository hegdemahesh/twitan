import React, { useEffect, useMemo, useState } from 'react'
import { auth, httpsCallable, functions, onAuthStateChanged, isEmulator, db } from '../lib/firebase'
import { EventTypes, EventNames } from '../../../shared/events'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { FiHome, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'

export default function Home() {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [tournaments, setTournaments] = useState<Array<{ id: string; name: string; type: string; status?: string }>>([])
  const visibleTournaments = useMemo(() => tournaments.filter(t => t.status !== 'deleted'), [tournaments])
  const activeCount = visibleTournaments.filter(t => t.status !== 'archived').length
  
  const nav = useNavigate()
  // Prefill with +2 days from today for a friendly default
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const defaultStart = (() => { const d = new Date(); d.setDate(d.getDate()+2); return fmt(d) })()
  const defaultEnd = (() => { const d = new Date(); d.setDate(d.getDate()+4); return fmt(d) })()
  const [startDate, setStartDate] = useState<string>(defaultStart)
  const [endDate, setEndDate] = useState<string>(defaultEnd)
  const [showCreateModal, setShowCreateModal] = useState(false)

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
  eventPayload: { type: 'Badminton', name, startDate: startDate || null, endDate: endDate || null },
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
          <h2 className="text-xl font-semibold flex items-center gap-2"><FiHome /> Home</h2>
        </div>
        {isEmulator && (
          <div className="alert alert-info">
            <span>Using Firebase Emulators</span>
          </div>
        )}
  <button className="btn btn-primary gap-2" onClick={() => setShowCreateModal(true)}><FiPlus /> Create tournament</button>
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
                    <button className="btn btn-xs btn-primary gap-1" onClick={() => nav(`/tournament?id=${t.id}`)}><FiEdit2 /> Edit</button>
                    <button className="btn btn-xs btn-error gap-1" onClick={() => deleteTournament(t.id)}><FiTrash2 /> Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </main>
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Create a new tournament</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="tname">Tournament name</label>
                <input id="tname" className="input input-bordered w-full" placeholder="Summer Open 2025" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="sdate">Start date</label>
                  <input id="sdate" type="date" className="input input-bordered w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="edate">End date</label>
                  <input id="edate" type="date" className="input input-bordered w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="alert alert-info">
                <span>Next you can add categories (events) and players. You can skip for now and add them later from the tournament page.</span>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-sm">Categories (optional)</div>
                <p className="text-xs opacity-70">Create Men’s Singles, Women’s Singles, Doubles, age groups, etc. You’ll set these up right after creating the tournament.</p>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-sm">Players (optional)</div>
                <p className="text-xs opacity-70">Invite players by phone and add details. You can also add players later from the tournament management page.</p>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowCreateModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={async () => { await createTournament(); setShowCreateModal(false) }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
