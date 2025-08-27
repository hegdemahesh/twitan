import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { auth, db, functions, httpsCallable, onAuthStateChanged } from '../lib/firebase'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { EventNames, EventTypes } from '../../../shared/events'

export default function TournamentEdit() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const nav = useNavigate()
  const [msg, setMsg] = useState('')
  const [tournament, setTournament] = useState<any>(null)
  const [roles, setRoles] = useState<Array<{ id: string; role: 'admin' | 'scorer'; phoneNumber: string }>>([])
  const [players, setPlayers] = useState<Array<any>>([])
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'admin' | 'scorer'>('admin')
  const [playerPhone, setPlayerPhone] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerDob, setPlayerDob] = useState('')
  const [playerGender, setPlayerGender] = useState<'Male'|'Female'|'Other'>('Male')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (!u) nav('/') })
    return () => unsub()
  }, [nav])

  useEffect(() => {
    if (!id) return
    const unsubT = onSnapshot(doc(db, 'tournaments', id), (d) => setTournament({ id: d.id, ...d.data() }))
    const unsubR = onSnapshot(collection(db, 'tournaments', id, 'roles'), (snap) => setRoles(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    const unsubP = onSnapshot(collection(db, 'tournaments', id, 'players'), (snap) => setPlayers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => { unsubT(); unsubR(); unsubP() }
  }, [id])

  if (!id) return <div className="p-4">Missing tournament id</div>

  async function addRole() {
    try {
      setMsg('')
      const call = httpsCallable(functions, 'addEvent')
  await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddTournamentRoleByPhone, eventPayload: { tournamentId: id, role, phoneNumber: phone } })
      setPhone('')
      setMsg('Role added')
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  async function delRole(rid: string) {
    try {
      const call = httpsCallable(functions, 'addEvent')
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.DeleteTournamentRole, eventPayload: { tournamentId: id, roleId: rid } })
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  async function addPlayerByPhone() {
    try {
      setMsg('')
      const call = httpsCallable(functions, 'addEvent')
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddPlayerByPhone, eventPayload: { tournamentId: id, phoneNumber: playerPhone, name: playerName || undefined, dob: playerDob || undefined, gender: playerGender } })
      setPlayerPhone(''); setPlayerName(''); setPlayerDob('')
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Edit tournament</h2>
        <button className="btn" onClick={() => nav('/home')}>Back</button>
      </div>
      {tournament && (
        <div className="card bg-base-100 shadow p-4">
          <div className="font-medium">{tournament.name}</div>
          <div className="text-sm opacity-70">{tournament.type} • {tournament.status}</div>
        </div>
      )}

      <div className="card bg-base-100 shadow p-4 space-y-3">
        <div className="font-medium">Admins & scorers</div>
        <div className="flex gap-2">
          <select className="select select-bordered" value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="admin">Admin</option>
            <option value="scorer">Scorer</option>
          </select>
          <input className="input input-bordered flex-1" placeholder="Phone (E.164)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn" onClick={addRole}>Add</button>
        </div>
        <ul className="space-y-2">
          {roles.map(r => (
            <li key={r.id} className="flex justify-between bg-base-200 p-2 rounded">
              <span className="text-sm">{r.role} • {r.phoneNumber}</span>
              <button className="btn btn-xs" onClick={() => delRole(r.id)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card bg-base-100 shadow p-4 space-y-3">
        <div className="font-medium">Players</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="input input-bordered" placeholder="Phone (E.164)" value={playerPhone} onChange={(e) => setPlayerPhone(e.target.value)} />
          <input className="input input-bordered" placeholder="Name (optional)" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          <input type="date" className="input input-bordered" value={playerDob} onChange={(e) => setPlayerDob(e.target.value)} />
          <select className="select select-bordered" value={playerGender} onChange={(e) => setPlayerGender(e.target.value as any)}>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
          <button className="btn" onClick={addPlayerByPhone}>Add player</button>
        </div>
        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {players.map(p => (
            <li key={p.id} className="bg-base-200 rounded p-2 text-sm flex justify-between">
              <span>{p.name ?? '(no name)'} • {p.phoneNumber ?? ''}</span>
              <span className="opacity-60">{p.gender ?? ''} {p.dob ? `• ${p.dob}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>

      {msg && <p className="text-sm opacity-80">{msg}</p>}
    </div>
  )
}
