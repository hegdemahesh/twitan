import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { auth, db, functions, httpsCallable, onAuthStateChanged } from '../lib/firebase'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { EventNames, EventTypes } from '../../../shared/events'
import Header from '../components/Header'

type PlayerGender = 'Male' | 'Female' | 'Other'
type CategoryGender = 'Male' | 'Female' | 'Open'
type CategoryFormat = 'Singles' | 'Doubles'
type Team = { id: string; name?: string | null; player1Id: string; player2Id: string }
type Player = { id: string; name?: string; phoneNumber?: string; gender?: PlayerGender; dob?: string }
type Category = { id: string; name: string; minAge?: number | null; maxAge?: number | null; gender: CategoryGender; format: CategoryFormat }
type Entry = { id: string; playerId?: string; teamId?: string }

export default function TournamentEdit() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const nav = useNavigate()
  const [msg, setMsg] = useState('')
  const [tournament, setTournament] = useState<any>(null)
  const [roles, setRoles] = useState<Array<{ id: string; role: 'admin' | 'scorer'; phoneNumber: string }>>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'admin' | 'scorer'>('admin')
  const [playerPhone, setPlayerPhone] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerDob, setPlayerDob] = useState('')
  const [playerGender, setPlayerGender] = useState<PlayerGender>('Male')
  const [manualPlayer, setManualPlayer] = useState<{ name: string; dob: string; gender: PlayerGender }>({ name: '', dob: '', gender: 'Male' })
  const [teamForm, setTeamForm] = useState<{ name?: string; p1?: string; p2?: string }>({})
  const [catForm, setCatForm] = useState<{ name: string; minAge?: number | null; maxAge?: number | null; gender: CategoryGender; format: CategoryFormat }>({ name: '', gender: 'Open', format: 'Singles' })
  const [editingCategory, setEditingCategory] = useState<null | { categoryId: string; data: { name: string; minAge?: number | null; maxAge?: number | null; gender: CategoryGender; format: CategoryFormat } }>(null)
  const [entryModal, setEntryModal] = useState<null | { categoryId: string; categoryName: string; format: CategoryFormat }>(null)
  const [entrySelected, setEntrySelected] = useState<string>('')
  const [tab, setTab] = useState<'dashboard'|'players'|'fixtures'>('dashboard')
  const [brackets, setBrackets] = useState<Array<{ id: string; name: string; categoryId: string; format: CategoryFormat; status: string }>>([])
  const [scoreModal, setScoreModal] = useState<null | { bracketId: string; matchId: string; scores: Array<{ a: number; b: number }>; status: 'in-progress'|'completed' }>(null)
  const [newBracketCategoryId, setNewBracketCategoryId] = useState<string>('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (!u) nav('/') })
    return () => unsub()
  }, [nav])

  useEffect(() => {
    if (!id) return
    const unsubT = onSnapshot(doc(db, 'tournaments', id), (d) => setTournament({ id: d.id, ...d.data() }))
    const unsubR = onSnapshot(collection(db, 'tournaments', id, 'roles'), (snap) => setRoles(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    const unsubP = onSnapshot(collection(db, 'tournaments', id, 'players'), (snap) => setPlayers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
  const unsubC = onSnapshot(collection(db, 'tournaments', id, 'categories'), (snap) => setCategories(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    const unsubTm = onSnapshot(collection(db, 'tournaments', id, 'teams'), (snap) => setTeams(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
  const unsubB = onSnapshot(collection(db, 'tournaments', id, 'brackets'), (snap) => setBrackets(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
  return () => { unsubT(); unsubR(); unsubP(); unsubC(); unsubTm(); unsubB() }
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

  async function addManualPlayer() {
    try {
      const call = httpsCallable(functions, 'addEvent')
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddPlayer, eventPayload: { tournamentId: id, player: manualPlayer } })
      setManualPlayer({ name: '', dob: '', gender: 'Male' })
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  async function addTeam() {
    try {
      if (!teamForm.p1 || !teamForm.p2 || teamForm.p1 === teamForm.p2) return
      const call = httpsCallable(functions, 'addEvent')
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddTeam, eventPayload: { tournamentId: id, player1Id: teamForm.p1, player2Id: teamForm.p2, name: teamForm.name ?? null } })
      setTeamForm({})
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  async function addCategory() {
    try {
      if (!catForm.name.trim()) return
      const call = httpsCallable(functions, 'addEvent')
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddTournamentCategories, eventPayload: { tournamentId: id, categories: [catForm] } })
      setCatForm({ name: '', gender: 'Open', format: 'Singles' })
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  async function deleteCategory(categoryId: string) {
    try {
      const call = httpsCallable(functions, 'addEvent')
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.DeleteTournamentCategory, eventPayload: { tournamentId: id, categoryId } })
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  async function saveCategoryEdit() {
    if (!editingCategory) return
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.UpdateTournamentCategory, eventPayload: { tournamentId: id, categoryId: editingCategory.categoryId, patch: editingCategory.data } })
    setEditingCategory(null)
  }

  async function addEntry() {
    if (!entryModal || !entrySelected) return
    const call = httpsCallable(functions, 'addEvent')
    if (entryModal.format === 'Singles') {
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddEntry, eventPayload: { tournamentId: id, categoryId: entryModal.categoryId, format: 'Singles', playerId: entrySelected } })
    } else {
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddEntry, eventPayload: { tournamentId: id, categoryId: entryModal.categoryId, format: 'Doubles', teamId: entrySelected } })
    }
    setEntrySelected('')
    setEntryModal(null)
  }

  async function deleteEntry(categoryId: string, entryId: string) {
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.DeleteEntry, eventPayload: { tournamentId: id, categoryId, entryId } })
  }

  async function createBracket() {
    if (!newBracketCategoryId) return
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.CreateBracketFromCategory, eventPayload: { tournamentId: id, categoryId: newBracketCategoryId } })
    setNewBracketCategoryId('')
  }

  async function saveScore() {
    if (!scoreModal) return
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.UpdateMatchScore, eventPayload: { tournamentId: id, bracketId: scoreModal.bracketId, matchId: scoreModal.matchId, scores: scoreModal.scores, status: scoreModal.status } })
    setScoreModal(null)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="max-w-5xl w-full mx-auto p-4 flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tournament dashboard</h2>
        <button className="btn" onClick={() => nav('/home')}>Back</button>
      </div>
      {tournament && (
        <div className="card bg-base-100 shadow p-4">
          <div className="font-medium">{tournament.name}</div>
          <div className="text-sm opacity-70">{tournament.type} • {tournament.status}</div>
        </div>
      )}

      <div role="tablist" className="tabs tabs-boxed">
        <button role="tab" className={`tab ${tab === 'dashboard' ? 'tab-active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button role="tab" className={`tab ${tab === 'players' ? 'tab-active' : ''}`} onClick={() => setTab('players')}>Players</button>
        <button role="tab" className={`tab ${tab === 'fixtures' ? 'tab-active' : ''}`} onClick={() => setTab('fixtures')}>Fixtures</button>
      </div>

      {tab === 'dashboard' && (
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
      )}
      {tab === 'players' && (
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="input input-bordered" placeholder="Name" value={manualPlayer.name} onChange={(e) => setManualPlayer({ ...manualPlayer, name: e.target.value })} />
          <input type="date" className="input input-bordered" value={manualPlayer.dob} onChange={(e) => setManualPlayer({ ...manualPlayer, dob: e.target.value })} />
          <select className="select select-bordered" value={manualPlayer.gender} onChange={(e) => setManualPlayer({ ...manualPlayer, gender: e.target.value as any })}>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
          <div className="md:col-span-2 flex items-center">
            <button className="btn" onClick={addManualPlayer}>Add manual player</button>
          </div>
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
      )}
      {tab === 'players' && (
      <div className="card bg-base-100 shadow p-4 space-y-3">
        <div className="font-medium">Teams</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="input input-bordered" placeholder="Team name (optional)" value={teamForm.name ?? ''} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
          <select className="select select-bordered" value={teamForm.p1 ?? ''} onChange={(e) => setTeamForm({ ...teamForm, p1: e.target.value })}>
            <option value="" disabled>Select player 1</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name ?? p.id}</option>)}
          </select>
          <select className="select select-bordered" value={teamForm.p2 ?? ''} onChange={(e) => setTeamForm({ ...teamForm, p2: e.target.value })}>
            <option value="" disabled>Select player 2</option>
            {players.map(p => <option key={p.id} value={p.id} disabled={p.id === teamForm.p1}>{p.name ?? p.id}</option>)}
          </select>
          <button className="btn" onClick={addTeam} disabled={!teamForm.p1 || !teamForm.p2 || teamForm.p1 === teamForm.p2}>Add team</button>
        </div>
        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {teams.map(t => (
            <li key={t.id} className="p-2 rounded bg-base-200 text-sm">
              <span>{t.name ?? 'Team'} <span className="opacity-60">({t.player1Id} & {t.player2Id})</span></span>
            </li>
          ))}
        </ul>
      </div>
      )}
      {tab === 'players' && (
      <div className="card bg-base-100 shadow p-4 space-y-3">
        <div className="font-medium">Categories</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input className="input input-bordered" placeholder="Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
          <input type="number" className="input input-bordered" placeholder="Min age" value={catForm.minAge ?? ''} onChange={(e) => setCatForm({ ...catForm, minAge: e.target.value ? Number(e.target.value) : null })} />
          <input type="number" className="input input-bordered" placeholder="Max age" value={catForm.maxAge ?? ''} onChange={(e) => setCatForm({ ...catForm, maxAge: e.target.value ? Number(e.target.value) : null })} />
          <select className="select select-bordered" value={catForm.gender} onChange={(e) => setCatForm({ ...catForm, gender: e.target.value as any })}>
            <option>Open</option>
            <option>Male</option>
            <option>Female</option>
          </select>
          <select className="select select-bordered" value={catForm.format} onChange={(e) => setCatForm({ ...catForm, format: e.target.value as any })}>
            <option>Singles</option>
            <option>Doubles</option>
          </select>
          <button className="btn" onClick={addCategory}>Add category</button>
        </div>
        {categories.length === 0 ? (
          <div className="text-sm opacity-60">No categories yet.</div>
        ) : (
          <ul className="space-y-3">
            {categories.map(c => (
              <li key={c.id} className="p-3 rounded bg-base-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs opacity-70 flex gap-2">
                      {(typeof c.minAge === 'number' || typeof c.maxAge === 'number') && <span>{c.minAge ?? '-'} - {c.maxAge ?? '-'} yrs</span>}
                      <span>{c.gender}</span>
                      <span>{c.format}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-xs" onClick={() => setEditingCategory({ categoryId: c.id, data: { name: c.name, minAge: c.minAge ?? null, maxAge: c.maxAge ?? null, gender: c.gender, format: c.format } })}>Edit</button>
                    <button className="btn btn-xs btn-error" onClick={() => deleteCategory(c.id)}>Delete</button>
                  </div>
                </div>
                <CategoryEntries
                  tournamentId={id}
                  category={{ id: c.id, name: c.name, format: c.format }}
                  players={players}
                  teams={teams}
                  onAddRequest={() => { setEntryModal({ categoryId: c.id, categoryName: c.name, format: c.format }); setEntrySelected('') }}
                  onDeleteEntry={(entryId) => deleteEntry(c.id, entryId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {tab === 'fixtures' && (
      <div className="card bg-base-100 shadow p-4 space-y-3">
        <div className="font-medium">Fixtures & brackets</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select className="select select-bordered" value={newBracketCategoryId} onChange={(e) => setNewBracketCategoryId(e.target.value)}>
            <option value="">Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name} • {c.format}</option>)}
          </select>
          <button className="btn" onClick={createBracket} disabled={!newBracketCategoryId}>Create bracket</button>
        </div>
        {brackets.length === 0 ? (
          <div className="text-sm opacity-60">No brackets yet.</div>
        ) : (
          <ul className="space-y-3">
            {brackets.map(b => (
              <BracketCard key={b.id} tournamentId={id} bracket={b} onOpenScore={(matchId, scores, status) => setScoreModal({ bracketId: b.id, matchId, scores, status })} />
            ))}
          </ul>
        )}
      </div>
      )}

      {msg && <p className="text-sm opacity-80">{msg}</p>}

      {editingCategory && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Edit category</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
              <input className="input input-bordered" placeholder="Name" value={editingCategory.data.name} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, name: e.target.value } })} />
              <input type="number" className="input input-bordered" placeholder="Min age" value={editingCategory.data.minAge ?? ''} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, minAge: e.target.value ? Number(e.target.value) : null } })} />
              <input type="number" className="input input-bordered" placeholder="Max age" value={editingCategory.data.maxAge ?? ''} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, maxAge: e.target.value ? Number(e.target.value) : null } })} />
              <select className="select select-bordered" value={editingCategory.data.gender} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, gender: e.target.value as any } })}>
                <option>Open</option>
                <option>Male</option>
                <option>Female</option>
              </select>
              <select className="select select-bordered" value={editingCategory.data.format} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, format: e.target.value as any } })}>
                <option>Singles</option>
                <option>Doubles</option>
              </select>
              <div />
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setEditingCategory(null)}>Close</button>
              <button className="btn btn-primary" onClick={saveCategoryEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {entryModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add entry to {entryModal.categoryName}</h3>
            <div className="mt-4">
              {entryModal.format === 'Singles' ? (
                <select className="select select-bordered w-full" value={entrySelected} onChange={(e) => setEntrySelected(e.target.value)}>
                  <option value="" disabled>Select player</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name ?? p.id}</option>)}
                </select>
              ) : (
                <select className="select select-bordered w-full" value={entrySelected} onChange={(e) => setEntrySelected(e.target.value)}>
                  <option value="" disabled>Select team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name ?? t.id}</option>)}
                </select>
              )}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setEntryModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={addEntry} disabled={!entrySelected}>Add</button>
            </div>
          </div>
        </div>
      )}

  {scoreModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Score match</h3>
            <div className="mt-4 grid grid-cols-3 gap-2 items-end">
              {[0,1,2].map(i => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input type="number" className="input input-bordered" placeholder={`Set ${i+1} A`} value={scoreModal.scores[i]?.a ?? ''} onChange={(e) => setScoreModal({ ...scoreModal, scores: updateSet(scoreModal.scores, i, { a: Number(e.target.value || 0), b: scoreModal.scores[i]?.b ?? 0 }) })} />
                  <input type="number" className="input input-bordered" placeholder={`Set ${i+1} B`} value={scoreModal.scores[i]?.b ?? ''} onChange={(e) => setScoreModal({ ...scoreModal, scores: updateSet(scoreModal.scores, i, { a: scoreModal.scores[i]?.a ?? 0, b: Number(e.target.value || 0) }) })} />
                </div>
              ))}
              <select className="select select-bordered" value={scoreModal.status} onChange={(e) => setScoreModal({ ...scoreModal, status: e.target.value as any })}>
                <option value="in-progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setScoreModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={saveScore}>Save</button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  )
}

function CategoryEntries({ tournamentId, category, players, teams, onAddRequest, onDeleteEntry }: Readonly<{ tournamentId: string; category: { id: string; name: string; format: 'Singles' | 'Doubles' }; players: Array<{ id: string; name?: string }>; teams: Array<{ id: string; name?: string | null }>; onAddRequest: () => void; onDeleteEntry: (entryId: string) => void }>) {
  const [entries, setEntries] = useState<Array<{ id: string; playerId?: string; teamId?: string }>>([])
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments', tournamentId, 'categories', category.id, 'entries'), (snap) => setEntries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => unsub()
  }, [tournamentId, category.id])
  return (
    <div className="mt-3 p-2 rounded bg-base-100">
      <div className="flex justify-between items-center">
        <h5 className="font-medium text-sm">Entries</h5>
        <button className="btn btn-xs" onClick={onAddRequest}>Add entry</button>
      </div>
      {entries.length === 0 ? <div className="text-xs opacity-60">No entries yet.</div> : (
        <ul className="mt-2 space-y-1">
          {entries.map(e => (
            <li key={e.id} className="flex justify-between items-center text-sm">
              <span>{category.format === 'Singles' ? `Player: ${resolveName(players, e.playerId)}` : `Team: ${resolveTeamName(teams, e.teamId)}`}</span>
              <button className="btn btn-ghost btn-xs" onClick={() => onDeleteEntry(e.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function resolveName(players: Array<{ id: string; name?: string }>, id?: string) {
  if (!id) return ''
  const p = players.find(p => p.id === id)
  return p?.name || id
}

function resolveTeamName(teams: Array<{ id: string; name?: string | null }>, id?: string) {
  if (!id) return ''
  const t = teams.find(t => t.id === id)
  return t?.name || id
}

function updateSet(arr: Array<{ a: number; b: number }>, i: number, v: { a: number; b: number }) {
  const copy = [...arr]
  copy[i] = v
  return copy
}

function BracketCard({ tournamentId, bracket, onOpenScore }: Readonly<{ tournamentId: string; bracket: { id: string; name: string; categoryId: string; format: CategoryFormat; status: string }; onOpenScore: (matchId: string, scores: Array<{ a: number; b: number }>, status: 'in-progress'|'completed') => void }>) {
  const [matches, setMatches] = useState<Array<{ id: string; round: number; order: number; participantA?: any; participantB?: any; scores: Array<{ a: number; b: number }>; status: string }>>([])
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments', tournamentId, 'brackets', bracket.id, 'matches'), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => unsub()
  }, [tournamentId, bracket.id])
  const grouped = matches.reduce((acc: Record<number, Array<any>>, m) => {
    const arr = acc[m.round] || []
    arr.push(m)
    acc[m.round] = arr
    return acc
  }, {})
  const rounds = Object.keys(grouped).map(n => Number(n)).sort((a,b) => a-b)
  return (
    <li className="p-3 rounded bg-base-200">
  <div className="font-medium mb-2">{bracket.name} <span className="badge ml-2">{bracket.status}</span></div>
      <div className="overflow-x-auto">
        <div className="flex gap-4">
          {rounds.map(r => (
            <div key={r} className="space-y-2 min-w-[220px]">
              <div className="text-xs opacity-60">Round {r}</div>
              {(() => { const arr = [...grouped[r]]; arr.sort((a:any,b:any)=>a.order-b.order); return arr })().map((m:any) => (
                <div key={m.id} className="p-2 bg-base-100 rounded text-sm flex justify-between items-center">
                  <div>
                    <div>A: {m.participantA?.entryId ?? '-'}</div>
                    <div>B: {m.participantB?.entryId ?? '-'}</div>
                    <div className="text-xs opacity-70">{m.scores.map((s:any,i:number)=>`[${s.a}-${s.b}]`).join(' ')}</div>
                  </div>
                  <button className="btn btn-xs" onClick={() => onOpenScore(m.id, m.scores ?? [], m.status === 'completed' ? 'completed' : 'in-progress')}>Score</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </li>
  )
}
