import React, { useEffect, useState } from 'react'
import { auth, httpsCallable, functions, onAuthStateChanged, signOut, isEmulator, db } from '../lib/firebase'
import { EventTypes, EventNames } from '../../../shared/events'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [tournaments, setTournaments] = useState<Array<{ id: string; name: string; type: string; status?: string }>>([])
  const activeCount = tournaments.filter(t => t.status !== 'deleted' && t.status !== 'archived').length
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, Array<{ name: string; minAge?: number; maxAge?: number; gender: 'Male' | 'Female' | 'Open'; format: 'Singles' | 'Doubles' }>>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
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
      const unsubT = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
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
      const isPremium = false // TODO: wire real premium status later
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

  function openEdit(tournamentId: string) {
    setEditingId(tournamentId)
    setCategoryDrafts((prev) => ({ ...prev, [tournamentId]: prev[tournamentId] ?? [] }))
  }

  function addCategoryDraft(tournamentId: string) {
    setCategoryDrafts((prev) => ({
      ...prev,
      [tournamentId]: [
        ...(prev[tournamentId] ?? []),
        { name: '', gender: 'Open', format: 'Singles' },
      ],
    }))
  }

  function updateCategoryDraft(tournamentId: string, idx: number, patch: Partial<{ name: string; minAge?: number; maxAge?: number; gender: 'Male' | 'Female' | 'Open'; format: 'Singles' | 'Doubles' }>) {
    setCategoryDrafts((prev) => {
      const list = [...(prev[tournamentId] ?? [])]
      list[idx] = { ...list[idx], ...patch }
      return { ...prev, [tournamentId]: list }
    })
  }

  function removeCategoryDraft(tournamentId: string, idx: number) {
    setCategoryDrafts((prev) => {
      const list = [...(prev[tournamentId] ?? [])]
      list.splice(idx, 1)
      return { ...prev, [tournamentId]: list }
    })
  }

  async function saveCategories(tournamentId: string) {
    try {
      const categories = (categoryDrafts[tournamentId] ?? []).filter(c => c.name.trim().length > 0)
      if (categories.length === 0) {
        setMsg('Add at least one category')
        return
      }
      const call = httpsCallable(functions, 'addEvent')
      const res = await call({
        eventType: EventTypes.Tournament,
        eventName: EventNames.Tournament.AddTournamentCategories,
        eventPayload: { tournamentId, categories },
      })
      setMsg(`Categories queued. Event ID: ${(res.data as any).id}`)
      setEditingId(null)
    } catch (e: any) {
      setMsg(e.message || String(e))
    }
  }

  async function deleteCategory(tournamentId: string, categoryId: string) {
    try {
      const call = httpsCallable(functions, 'addEvent')
      const res = await call({
        eventType: EventTypes.Tournament,
        eventName: EventNames.Tournament.DeleteTournamentCategory,
        eventPayload: { tournamentId, categoryId },
      })
      setMsg(`Category delete queued. Event ID: ${(res.data as any).id}`)
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
        {tournaments.length === 0 ? (
          <p className="text-sm opacity-70">No tournaments yet.</p>
        ) : (
          <ul className="menu bg-base-200 rounded-box">
            {tournaments.map(t => (
              <li key={t.id}>
                <div className="flex items-center justify-between gap-2">
                  <span>{t.name} <span className="badge badge-ghost ml-2">{t.type}</span></span>
                  <div className="flex items-center gap-2">
                    {t.status && <span className="badge">{t.status}</span>}
                    <button className="btn btn-xs" onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))}>{expanded[t.id] ? 'Collapse' : 'Expand'}</button>
                    <button className="btn btn-xs" onClick={() => openEdit(t.id)}>Edit tournament</button>
                    <button className="btn btn-xs btn-error" onClick={() => deleteTournament(t.id)}>Delete</button>
                  </div>
                </div>
                {expanded[t.id] && (
                  <TournamentCategories tournamentId={t.id} onDeleteCategory={deleteCategory} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingId && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Edit tournament categories</h3>
            <div className="mt-4 space-y-4">
              {(categoryDrafts[editingId] ?? []).map((c, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                  <input className="input input-bordered" placeholder="Name" value={c.name}
                    onChange={(e) => updateCategoryDraft(editingId, idx, { name: e.target.value })} />
                  <input type="number" className="input input-bordered" placeholder="Min age" value={c.minAge ?? ''}
                    onChange={(e) => updateCategoryDraft(editingId, idx, { minAge: e.target.value ? Number(e.target.value) : undefined })} />
                  <input type="number" className="input input-bordered" placeholder="Max age" value={c.maxAge ?? ''}
                    onChange={(e) => updateCategoryDraft(editingId, idx, { maxAge: e.target.value ? Number(e.target.value) : undefined })} />
                  <select className="select select-bordered" value={c.gender}
                    onChange={(e) => updateCategoryDraft(editingId, idx, { gender: e.target.value as any })}>
                    <option>Open</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                  <select className="select select-bordered" value={c.format}
                    onChange={(e) => updateCategoryDraft(editingId, idx, { format: e.target.value as any })}>
                    <option>Singles</option>
                    <option>Doubles</option>
                  </select>
                  <button className="btn btn-ghost" onClick={() => removeCategoryDraft(editingId!, idx)}>Remove</button>
                </div>
              ))}
              <button className="btn" onClick={() => addCategoryDraft(editingId!)}>Add category</button>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setEditingId(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => saveCategories(editingId!)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TournamentCategories({ tournamentId, onDeleteCategory }: { tournamentId: string; onDeleteCategory: (tId: string, cId: string) => void }) {
  const [items, setItems] = React.useState<Array<{ id: string; name: string; minAge?: number; maxAge?: number; gender: string; format: string }>>([])
  React.useEffect(() => {
    const q = collection(db, 'tournaments', tournamentId, 'categories')
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    })
    return () => unsub()
  }, [tournamentId])
  if (items.length === 0) return <div className="text-sm opacity-60">No categories yet.</div>
  return (
    <div className="mt-2 p-3 rounded bg-base-200">
      <ul className="space-y-2">
        {items.map(c => (
          <li key={c.id} className="flex items-center justify-between">
            <span>
              {c.name}
              {typeof c.minAge === 'number' || typeof c.maxAge === 'number' ? (
                <span className="badge badge-ghost ml-2">{c.minAge ?? '-'} - {c.maxAge ?? '-'} yrs</span>
              ) : null}
              <span className="badge badge-ghost ml-2">{c.gender}</span>
              <span className="badge badge-ghost ml-2">{c.format}</span>
            </span>
            <button className="btn btn-xs btn-error" onClick={() => onDeleteCategory(tournamentId, c.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
