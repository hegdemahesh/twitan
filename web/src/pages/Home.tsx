import React, { useEffect, useMemo, useState } from 'react'
import { auth, httpsCallable, functions, onAuthStateChanged, signOut, isEmulator, db } from '../lib/firebase'
import { EventTypes, EventNames } from '../../../shared/events'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [tournaments, setTournaments] = useState<Array<{ id: string; name: string; type: string; status?: string }>>([])
  const visibleTournaments = useMemo(() => tournaments.filter(t => t.status !== 'deleted'), [tournaments])
  const activeCount = visibleTournaments.filter(t => t.status !== 'archived').length
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  type CategoryDraft = { _id: string; name: string; minAge?: number; maxAge?: number; gender: 'Male' | 'Female' | 'Open'; format: 'Singles' | 'Doubles' }
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, Array<CategoryDraft>>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [focusDraftId, setFocusDraftId] = useState<string | null>(null)
  type CategoryForm = { name: string; minAge?: number | null; maxAge?: number | null; gender: 'Male' | 'Female' | 'Open'; format: 'Singles' | 'Doubles' }
  type EditingCategoryState = { tournamentId: string; categoryId: string; data: CategoryForm } | null
  const [editingCategory, setEditingCategory] = useState<EditingCategoryState>(null)
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

  function openEdit(tournamentId: string) {
    setEditingId(tournamentId)
    setCategoryDrafts((prev) => ({ ...prev, [tournamentId]: prev[tournamentId] ?? [] }))
  }

  function addCategoryDraft(tournamentId: string) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setCategoryDrafts((prev) => ({
      ...prev,
      [tournamentId]: [
        ...(prev[tournamentId] ?? []),
        { _id: id, name: '', gender: 'Open', format: 'Singles' },
      ],
    }))
    setFocusDraftId(id)
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
      const categories = (categoryDrafts[tournamentId] ?? []).map(({ _id, ...rest }) => rest).filter(c => c.name.trim().length > 0)
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
                    <button className="btn btn-xs" onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))}>{expanded[t.id] ? 'Collapse' : 'Expand'}</button>
                    <button className="btn btn-xs" onClick={() => openEdit(t.id)}>Edit tournament</button>
                    <button className="btn btn-xs btn-error" onClick={() => deleteTournament(t.id)}>Delete</button>
                  </div>
                </div>
                {expanded[t.id] && (
                  <div className="space-y-4">
                    <TournamentCategories tournamentId={t.id} onDeleteCategory={deleteCategory} onEditCategory={(cid, data) => setEditingCategory({ tournamentId: t.id, categoryId: cid, data })} />
                    <TournamentPlayers tournamentId={t.id} />
                    <TournamentTeams tournamentId={t.id} />
                  </div>
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
                <div key={c._id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                  <input className="input input-bordered" placeholder="Name" value={c.name} autoFocus={focusDraftId === c._id}
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
                  <button className="btn btn-ghost" onClick={() => {
                    if (!editingId) return
                    removeCategoryDraft(editingId, idx)
                  }}>Remove</button>
                </div>
              ))}
              <button className="btn" onClick={() => {
                if (!editingId) return
                addCategoryDraft(editingId)
              }}>Add category</button>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setEditingId(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                if (!editingId) return
                saveCategories(editingId)
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {editingCategory && (
        <EditCategoryModal
          data={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={(msg) => { setMsg(msg); setEditingCategory(null) }}
        />
      )}
    </div>
  )
}

type CategoryData = Readonly<{ name: string; minAge?: number | null; maxAge?: number | null; gender: 'Male' | 'Female' | 'Open'; format: 'Singles' | 'Doubles' }>
function TournamentCategories({ tournamentId, onDeleteCategory, onEditCategory }: Readonly<{ tournamentId: string; onDeleteCategory: (tId: string, cId: string) => void; onEditCategory: (categoryId: string, data: CategoryData) => void }>) {
  const [items, setItems] = React.useState<Array<{ id: string; name: string; minAge?: number | null; maxAge?: number | null; gender: 'Male' | 'Female' | 'Open'; format: 'Singles' | 'Doubles' }>>([])
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
          <li key={c.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <button className="text-left hover:underline" onClick={() => onEditCategory(c.id, { name: c.name, minAge: c.minAge ?? null, maxAge: c.maxAge ?? null, gender: c.gender, format: c.format })}>
                {c.name}
                {typeof c.minAge === 'number' || typeof c.maxAge === 'number' ? (
                  <span className="badge badge-ghost ml-2">{c.minAge ?? '-'} - {c.maxAge ?? '-'} yrs</span>
                ) : null}
                <span className="badge badge-ghost ml-2">{c.gender}</span>
                <span className="badge badge-ghost ml-2">{c.format}</span>
              </button>
              <button className="btn btn-xs btn-error" onClick={() => onDeleteCategory(tournamentId, c.id)}>Delete</button>
            </div>
            <CategoryEntries tournamentId={tournamentId} category={{ id: c.id, name: c.name, format: c.format }} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function EditCategoryModal({ data, onClose, onSaved }: Readonly<{ data: { tournamentId: string; categoryId: string; data: CategoryData }; onClose: () => void; onSaved: (msg: string) => void }>) {
  const [form, setForm] = useState({ ...data.data })
  async function save() {
    const call = httpsCallable(functions, 'addEvent')
    const res = await call({
      eventType: EventTypes.Tournament,
      eventName: EventNames.Tournament.UpdateTournamentCategory,
      eventPayload: { tournamentId: data.tournamentId, categoryId: data.categoryId, patch: form },
    })
    onSaved(`Category updated. Event ID: ${(res.data as any).id}`)
  }
  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Edit category</h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <input className="input input-bordered" placeholder="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="number" className="input input-bordered" placeholder="Min age" value={form.minAge ?? ''}
            onChange={(e) => setForm({ ...form, minAge: e.target.value ? Number(e.target.value) : null })} />
          <input type="number" className="input input-bordered" placeholder="Max age" value={form.maxAge ?? ''}
            onChange={(e) => setForm({ ...form, maxAge: e.target.value ? Number(e.target.value) : null })} />
          <select className="select select-bordered" value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as any })}>
            <option>Open</option>
            <option>Male</option>
            <option>Female</option>
          </select>
          <select className="select select-bordered" value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value as any })}>
            <option>Singles</option>
            <option>Doubles</option>
          </select>
          <div />
        </div>
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}

function TournamentPlayers({ tournamentId }: Readonly<{ tournamentId: string }>) {
  const [items, setItems] = useState<Array<{ id: string; name: string; dob: string; gender: string }>>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', dob: '', gender: 'Male' as 'Male' | 'Female' | 'Other' })
  useEffect(() => {
    const q = collection(db, 'tournaments', tournamentId, 'players')
    const unsub = onSnapshot(q, (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => unsub()
  }, [tournamentId])
  async function add() {
    const call = httpsCallable(functions, 'addEvent')
  await call({
      eventType: EventTypes.Tournament,
      eventName: EventNames.Tournament.AddPlayer,
      eventPayload: { tournamentId, player: form },
    })
    setOpen(false); setForm({ name: '', dob: '', gender: 'Male' })
  }
  return (
    <div className="p-3 rounded bg-base-200">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Players</h4>
        <button className="btn btn-xs" onClick={() => setOpen(true)}>Add player</button>
      </div>
      {items.length === 0 ? <div className="text-sm opacity-60">No players yet.</div> : (
        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map(p => (
            <li key={p.id} className="p-2 rounded bg-base-100 flex justify-between">
              <span>{p.name} <span className="badge badge-ghost ml-2">{p.gender}</span></span>
              <span className="text-xs opacity-70">{p.dob}</span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add player</h3>
            <div className="mt-4 space-y-2">
              <input className="input input-bordered w-full" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input type="date" className="input input-bordered w-full" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              <select className="select select-bordered w-full" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as any })}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={add}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TournamentTeams({ tournamentId }: Readonly<{ tournamentId: string }>) {
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([])
  const [teams, setTeams] = useState<Array<{ id: string; name?: string | null; player1Id: string; player2Id: string }>>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ name?: string; p1?: string; p2?: string }>({})
  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'tournaments', tournamentId, 'players'), (snap) => setPlayers(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name }))))
    const unsubT = onSnapshot(collection(db, 'tournaments', tournamentId, 'teams'), (snap) => setTeams(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => { unsubP(); unsubT() }
  }, [tournamentId])
  async function addTeam() {
    if (!form.p1 || !form.p2 || form.p1 === form.p2) return
    const call = httpsCallable(functions, 'addEvent')
    await call({
      eventType: EventTypes.Tournament,
      eventName: EventNames.Tournament.AddTeam,
      eventPayload: { tournamentId, player1Id: form.p1, player2Id: form.p2, name: form.name ?? null },
    })
    setOpen(false); setForm({})
  }
  return (
    <div className="p-3 rounded bg-base-200">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Teams</h4>
        <button className="btn btn-xs" onClick={() => setOpen(true)} disabled={players.length < 2}>Add team</button>
      </div>
      {teams.length === 0 ? <div className="text-sm opacity-60">No teams yet.</div> : (
        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {teams.map(t => (
            <li key={t.id} className="p-2 rounded bg-base-100">
              <span>{t.name ?? 'Team'} <span className="text-xs opacity-70">({t.player1Id} & {t.player2Id})</span></span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add team</h3>
            <div className="mt-4 space-y-2">
              <input className="input input-bordered w-full" placeholder="Team name (optional)" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className="select select-bordered w-full" value={form.p1 ?? ''} onChange={(e) => setForm({ ...form, p1: e.target.value })}>
                <option value="" disabled>Select player 1</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className="select select-bordered w-full" value={form.p2 ?? ''} onChange={(e) => setForm({ ...form, p2: e.target.value })}>
                <option value="" disabled>Select player 2</option>
                {players.map(p => <option key={p.id} value={p.id} disabled={p.id === form.p1}>{p.name}</option>)}
              </select>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={addTeam} disabled={!form.p1 || !form.p2 || form.p1 === form.p2}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryEntries({ tournamentId, category }: Readonly<{ tournamentId: string; category: { id: string; name: string; format: 'Singles' | 'Doubles' } }>) {
  const [entries, setEntries] = useState<Array<{ id: string; playerId?: string; teamId?: string }>>([])
  const [open, setOpen] = useState(false)
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([])
  const [teams, setTeams] = useState<Array<{ id: string; name?: string | null }>>([])
  const [selected, setSelected] = useState<string>('')
  useEffect(() => {
    const unsubE = onSnapshot(collection(db, 'tournaments', tournamentId, 'categories', category.id, 'entries'), (snap) => setEntries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    const unsubP = onSnapshot(collection(db, 'tournaments', tournamentId, 'players'), (snap) => setPlayers(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name }))))
    const unsubT = onSnapshot(collection(db, 'tournaments', tournamentId, 'teams'), (snap) => setTeams(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name })) ))
    return () => { unsubE(); unsubP(); unsubT() }
  }, [tournamentId, category.id])
  async function addEntry() {
    const call = httpsCallable(functions, 'addEvent')
    if (category.format === 'Singles') {
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddEntry, eventPayload: { tournamentId, categoryId: category.id, format: 'Singles', playerId: selected } })
    } else {
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddEntry, eventPayload: { tournamentId, categoryId: category.id, format: 'Doubles', teamId: selected } })
    }
    setOpen(false); setSelected('')
  }
  async function delEntry(entryId: string) {
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.DeleteEntry, eventPayload: { tournamentId, categoryId: category.id, entryId } })
  }
  return (
    <div className="ml-4 p-2 rounded bg-base-100">
      <div className="flex justify-between items-center">
        <h5 className="font-medium text-sm">Entries</h5>
        <button className="btn btn-xs" onClick={() => setOpen(true)}>Add entry</button>
      </div>
      {entries.length === 0 ? <div className="text-xs opacity-60">No entries yet.</div> : (
        <ul className="mt-2 space-y-1">
          {entries.map(e => (
            <li key={e.id} className="flex justify-between items-center text-sm">
              <span>{category.format === 'Singles' ? `Player: ${e.playerId}` : `Team: ${e.teamId}`}</span>
              <button className="btn btn-ghost btn-xs" onClick={() => delEntry(e.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add entry to {category.name}</h3>
            <div className="mt-4">
              {category.format === 'Singles' ? (
                <select className="select select-bordered w-full" value={selected} onChange={(e) => setSelected(e.target.value)}>
                  <option value="" disabled>Select player</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <select className="select select-bordered w-full" value={selected} onChange={(e) => setSelected(e.target.value)}>
                  <option value="" disabled>Select team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name ?? t.id}</option>)}
                </select>
              )}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={addEntry} disabled={!selected}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
