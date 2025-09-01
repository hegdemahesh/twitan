import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { auth, db, functions, httpsCallable, onAuthStateChanged, isEmulator } from '../lib/firebase'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { EventNames, EventTypes } from '../../../shared/events'
import Header from '../components/Header'
import { FiUsers, FiSliders, FiChevronLeft, FiCheck } from 'react-icons/fi'
import CountryPhoneInput from '../components/CountryPhoneInput'

type PlayerGender = 'Male' | 'Female' | 'Other'
type CategoryGender = 'Male' | 'Female' | 'Open'
type CategoryFormat = 'Singles' | 'Doubles'
type Player = { id: string; name?: string; phoneNumber?: string; gender?: PlayerGender; dob?: string; city?: string }
type Category = { id: string; name: string; minAge?: number | null; maxAge?: number | null; gender: CategoryGender; format: CategoryFormat }
type Entry = { id: string; playerId?: string; player1Id?: string; player2Id?: string; teamId?: string }

export default function TournamentEdit() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const nav = useNavigate()
  const [msg, setMsg] = useState('')
  const [tournament, setTournament] = useState<any>(null)
  const [roles, setRoles] = useState<Array<{ id: string; role: 'admin' | 'scorer'; phoneNumber: string }>>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'admin' | 'scorer'>('admin')
  const [playerPhone, setPlayerPhone] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerDob, setPlayerDob] = useState('')
  const [playerGender, setPlayerGender] = useState<PlayerGender>('Male')
  const [playerCity, setPlayerCity] = useState('')
  const [catForm, setCatForm] = useState<{ name: string; minAge?: number | null; maxAge?: number | null; gender: CategoryGender; format: CategoryFormat }>({ name: '', gender: 'Open', format: 'Singles' })
  const [editingCategory, setEditingCategory] = useState<null | { categoryId: string; data: { name: string; minAge?: number | null; maxAge?: number | null; gender: CategoryGender; format: CategoryFormat } }>(null)
  const [entryModal, setEntryModal] = useState<null | { categoryId: string; categoryName: string; format: CategoryFormat }>(null)
  const [entrySelected, setEntrySelected] = useState<string>('')
  const [entrySelectedP2, setEntrySelectedP2] = useState<string>('')
  const [tab, setTab] = useState<'manage'|'players'>('manage')
  const [brackets, setBrackets] = useState<Array<{ id: string; name: string; categoryId: string; format: CategoryFormat; status: string }>>([])
  const [scoreModal, setScoreModal] = useState<null | { bracketId: string; matchId: string; scores: Array<{ a: number; b: number }>; status: 'in-progress'|'completed' }>(null)
  const [newBracketCategoryId, setNewBracketCategoryId] = useState<string>('')
  // Round robin (group stage)
  const [groups, setGroups] = useState<Array<{ id: string; name: string; categoryId: string; status: string }>>([])
  const [newGroupCategoryId, setNewGroupCategoryId] = useState<string>('')
  const [groupScoreModal, setGroupScoreModal] = useState<null | { groupId: string; matchId: string; scoreA: number; scoreB: number; status: 'in-progress'|'completed' }>(null)
  const [catExpand, setCatExpand] = useState<Record<string, { entries: boolean; fixtures: boolean }>>({})

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
  const unsubB = onSnapshot(collection(db, 'tournaments', id, 'brackets'), (snap) => setBrackets(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  const unsubG = onSnapshot(collection(db, 'tournaments', id, 'groups'), (snap) => setGroups(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  return () => { unsubT(); unsubR(); unsubP(); unsubC(); unsubB(); unsubG() }
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
  await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddPlayerByPhone, eventPayload: { tournamentId: id, phoneNumber: playerPhone, name: playerName || undefined, dob: playerDob || undefined, gender: playerGender, city: playerCity || undefined } })
  setPlayerPhone(''); setPlayerName(''); setPlayerDob(''); setPlayerCity('')
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  // manual player and teams removed by requirement

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
    if (!entryModal) return
    const call = httpsCallable(functions, 'addEvent')
    if (entryModal.format === 'Singles') {
      if (!entrySelected) return
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddEntry, eventPayload: { tournamentId: id, categoryId: entryModal.categoryId, format: 'Singles', playerId: entrySelected } })
    } else {
      if (!entrySelected || !entrySelectedP2 || entrySelected === entrySelectedP2) return
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddEntry, eventPayload: { tournamentId: id, categoryId: entryModal.categoryId, format: 'Doubles', player1Id: entrySelected, player2Id: entrySelectedP2 } as any })
    }
    setEntrySelected('')
    setEntrySelectedP2('')
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

  // Round robin actions
  async function createGroup() {
    if (!newGroupCategoryId) return
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.CreateRoundRobin, eventPayload: { tournamentId: id, categoryId: newGroupCategoryId } })
    setNewGroupCategoryId('')
  }
  async function saveGroupScore() {
    if (!groupScoreModal) return
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.UpdateRoundRobinMatch, eventPayload: { tournamentId: id, groupId: groupScoreModal.groupId, matchId: groupScoreModal.matchId, scoreA: groupScoreModal.scoreA, scoreB: groupScoreModal.scoreB, status: groupScoreModal.status } })
    setGroupScoreModal(null)
  }
  async function finalizeGroupToBracket(groupId: string, topN = 4) {
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.FinalizeRoundRobinToBracket, eventPayload: { tournamentId: id, groupId, topN } })
  }

  async function saveScore() {
    if (!scoreModal) return
    const call = httpsCallable(functions, 'addEvent')
  // @ts-ignore winner may be present in modal state
  await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.UpdateMatchScore, eventPayload: { tournamentId: id, bracketId: scoreModal.bracketId, matchId: scoreModal.matchId, scores: scoreModal.scores, status: scoreModal.status, winner: (scoreModal as any).winner ?? undefined } })
    setScoreModal(null)
  }

  // Dev helpers: random data generators (emulator only)
  function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
  function randomDateOfBirth(minYear = 1980, maxYear = 2015) {
    const y = randInt(minYear, maxYear); const m = randInt(1, 12); const d = randInt(1, 28)
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }
  const FIRST_NAMES = ['Aarav','Vihaan','Aditya','Rohan','Kabir','Arjun','Ishaan','Rahul','Ananya','Diya','Aisha','Saanvi','Anika','Riya','Kavya','Maya']
  const LAST_NAMES = ['Sharma','Verma','Reddy','Iyer','Patel','Khan','Singh','Gupta','Bose','Shetty','Joshi','Nair','Kulkarni','Shah']
  function randomName() { return `${FIRST_NAMES[randInt(0,FIRST_NAMES.length-1)]} ${LAST_NAMES[randInt(0,LAST_NAMES.length-1)]}` }
  function randomGender(): PlayerGender { return (['Male','Female','Other'] as PlayerGender[])[randInt(0,2)] }

  async function addRandomPlayers(n = 10) {
    if (!id) return
    const call = httpsCallable(functions, 'addEvent')
    const tasks = Array.from({ length: n }).map(async () => {
      const player = { name: randomName(), dob: randomDateOfBirth(), gender: randomGender() }
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddPlayer, eventPayload: { tournamentId: id, player } })
    })
    await Promise.all(tasks)
    setMsg(`Added ${n} random players`)
  }

  async function addRandomCategories() {
    if (!id) return
    const presets: Array<{ name: string; minAge?: number; maxAge?: number; gender: CategoryGender; format: CategoryFormat }> = [
      { name: 'U13 Singles', minAge: 9, maxAge: 13, gender: 'Open', format: 'Singles' },
      { name: 'U15 Singles', minAge: 11, maxAge: 15, gender: 'Open', format: 'Singles' },
      { name: 'Men Singles', gender: 'Male', format: 'Singles' },
      { name: 'Women Singles', gender: 'Female', format: 'Singles' },
      { name: 'Open Doubles', gender: 'Open', format: 'Doubles' },
    ]
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.AddTournamentCategories, eventPayload: { tournamentId: id, categories: presets } })
    setMsg('Added random categories')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="max-w-5xl w-full mx-auto p-4 flex-1 space-y-6">
    <div className="flex items-center justify-between">
  <h2 className="section-title"><FiSliders /> Tournament dashboard</h2>
  <button className="btn btn-ghost gap-2" onClick={() => nav('/home')}><FiChevronLeft /> Back</button>
      </div>
      {tournament && (
        <div className="card bg-base-100 shadow p-4">
          <div className="font-medium">{tournament.name}</div>
          <div className="text-sm opacity-70">{tournament.type} • {tournament.status}</div>
        </div>
      )}

  <div role="tablist" className="tabs tabs-boxed">
        <button role="tab" className={`tab gap-2 ${tab === 'manage' ? 'tab-active' : ''}`} onClick={() => setTab('manage')}><FiSliders /> <span className="hidden sm:inline">Manage</span></button>
        <button role="tab" className={`tab gap-2 ${tab === 'players' ? 'tab-active' : ''}`} onClick={() => setTab('players')}><FiUsers /> <span className="hidden sm:inline">Players</span></button>
      </div>

  {tab === 'manage' && (
      <div className="card bg-base-100 card-glow p-4 space-y-3">
        <div className="font-medium flex items-center gap-2">Admins & scorers <span className="gradient-label">access</span></div>
        <div className="flex flex-col md:flex-row gap-2">
          <select className="select select-bordered" value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="admin">Admin</option>
            <option value="scorer">Scorer</option>
          </select>
          <CountryPhoneInput value={phone} onChange={setPhone} />
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
      <div className="card bg-base-100 card-glow p-4 space-y-3">
        <div className="font-medium flex items-center gap-2">Players <span className="gradient-label">manage</span></div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <div className="md:col-span-2">
            <CountryPhoneInput value={playerPhone} onChange={setPlayerPhone} />
          </div>
          <div className="md:col-span-2">
            <input className="input input-bordered w-full" placeholder="Name (required)" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          </div>
          <input type="date" className="input input-bordered" value={playerDob} onChange={(e) => setPlayerDob(e.target.value)} />
          <select className="select select-bordered" value={playerGender} onChange={(e) => setPlayerGender(e.target.value as any)}>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
          <input className="input input-bordered" placeholder="Town/City (optional)" value={playerCity} onChange={(e) => setPlayerCity(e.target.value)} />
          <button className="btn" onClick={addPlayerByPhone} disabled={!playerName.trim() || !playerDob}>Add player</button>
        </div>
        {isEmulator && (
          <div className="pt-2">
            <button className="btn btn-sm" onClick={() => addRandomPlayers(10)}>Dev: Add 10 random players</button>
          </div>
        )}
        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {players.map(p => (
            <li key={p.id} className="bg-base-200 rounded p-2 text-sm flex justify-between">
              <span>{p.name ?? '(no name)'} • {p.phoneNumber ?? ''}</span>
              <span className="opacity-60">{p.gender ?? ''} {p.dob ? `• ${p.dob}` : ''} {p?.city ? `• ${p.city}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
      )}
  {tab === 'manage' && (
      <div className="card bg-base-100 card-glow p-4 space-y-3">
        <div className="font-medium flex items-center gap-2">Categories <span className="gradient-label">fixtures</span></div>
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
        {isEmulator && (
          <div className="pt-2">
            <button className="btn btn-sm" onClick={addRandomCategories}>Dev: Add random categories</button>
          </div>
        )}
        {categories.length === 0 ? (
          <div className="text-sm opacity-60">No categories yet.</div>
        ) : (
          <ul className="space-y-3">
            {categories.map(c => (
              <li key={c.id} className="p-3 rounded bg-base-200 soft-ring">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-sm" onClick={() => setCatExpand(prev => ({ ...prev, [c.id]: { entries: !prev[c.id]?.entries, fixtures: prev[c.id]?.fixtures ?? false } }))}>
                    {catExpand[c.id]?.entries ? 'Hide entries' : 'View entries'}
                  </button>
                  <button className="btn btn-sm" onClick={() => setCatExpand(prev => ({ ...prev, [c.id]: { entries: prev[c.id]?.entries ?? false, fixtures: !prev[c.id]?.fixtures } }))}>
                    {catExpand[c.id]?.fixtures ? 'Hide fixtures' : 'View fixtures'}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={async () => {
                    const call = httpsCallable(functions, 'addEvent')
                    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.CreateBracketFromCategory, eventPayload: { tournamentId: id, categoryId: c.id } })
                  }}>Create bracket</button>
                  <button className="btn btn-secondary btn-sm" onClick={async () => {
                    const call = httpsCallable(functions, 'addEvent')
                    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.CreateRoundRobin, eventPayload: { tournamentId: id, categoryId: c.id } })
                  }}>Create round robin</button>
                </div>
                {catExpand[c.id]?.entries && (
                  <CategoryEntries
                    tournamentId={id}
                    category={{ id: c.id, name: c.name, format: c.format }}
                    players={players}
                    onAddRequest={() => { setEntryModal({ categoryId: c.id, categoryName: c.name, format: c.format }); setEntrySelected('') }}
                    onDeleteEntry={(entryId) => deleteEntry(c.id, entryId)}
                  />
                )}
                {catExpand[c.id]?.fixtures && (
                  <div className="mt-3 space-y-3">
                    {brackets.filter(b => b.categoryId === c.id).length === 0 ? (
                      <div className="text-sm opacity-60">No brackets yet.</div>
                    ) : (
                      <ul className="space-y-3">
                        {brackets.filter(b => b.categoryId === c.id).map(b => (
                          <BracketCard
                            key={b.id}
                            tournamentId={id}
                            bracket={b}
                            players={players}
                            onOpenScore={(matchId, scores, status) => setScoreModal({ bracketId: b.id, matchId, scores, status })}
                            onShuffle={async () => {
                              const call = httpsCallable(functions, 'addEvent')
                              await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.ReseedBracket, eventPayload: { tournamentId: id, bracketId: b.id, strategy: 'shuffle' } })
                            }}
                            onFinalizeToggle={async (finalized: boolean) => {
                              const call = httpsCallable(functions, 'addEvent')
                              await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.SetBracketFinalized, eventPayload: { tournamentId: id, bracketId: b.id, finalized } })
                            }}
                            onDelete={async () => {
                              if (!confirm('Delete this bracket and all its matches?')) return
                              const call = httpsCallable(functions, 'addEvent')
                              await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.DeleteBracket, eventPayload: { tournamentId: id, bracketId: b.id } })
                            }}
                          />
                        ))}
                      </ul>
                    )}
                    {groups.filter(g => g.categoryId === c.id).length === 0 ? (
                      <div className="text-sm opacity-60">No groups yet.</div>
                    ) : (
                      <ul className="space-y-3">
                        {groups.filter(g => g.categoryId === c.id).map(g => (
                          <GroupCard key={g.id} tournamentId={id} group={g} players={players} onOpenScore={(matchId: string, scoreA: number, scoreB: number, status: 'in-progress'|'completed') => setGroupScoreModal({ groupId: g.id, matchId, scoreA, scoreB, status })} onFinalize={() => finalizeGroupToBracket(g.id)} />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
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
                <PlayerPicker players={players} value={entrySelected} onChange={setEntrySelected} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <PlayerPicker players={players} value={entrySelected} onChange={setEntrySelected} label="Select player 1" />
                  <PlayerPicker players={players} value={entrySelectedP2} onChange={setEntrySelectedP2} label="Select player 2" excludeId={entrySelected} />
                </div>
              )}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setEntryModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={addEntry} disabled={entryModal.format === 'Singles' ? !entrySelected : (!entrySelected || !entrySelectedP2 || entrySelected === entrySelectedP2)}>Add</button>
            </div>
          </div>
        </div>
      )}

  {scoreModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Score match</h3>
            <ScoringGrid scoreModal={scoreModal} setScoreModal={setScoreModal} />
            <div className="modal-action">
              <button className="btn" onClick={() => setScoreModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={saveScore}>Save</button>
            </div>
          </div>
        </div>
      )}
      {groupScoreModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Score group match</h3>
            <GroupScoringGrid groupScoreModal={groupScoreModal} setGroupScoreModal={setGroupScoreModal} />
            <div className="modal-action">
              <button className="btn" onClick={() => setGroupScoreModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={saveGroupScore}>Save</button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  )
}

function CategoryEntries({ tournamentId, category, players, onAddRequest, onDeleteEntry }: Readonly<{ tournamentId: string; category: { id: string; name: string; format: 'Singles' | 'Doubles' }; players: Array<{ id: string; name?: string }>; onAddRequest: () => void; onDeleteEntry: (entryId: string) => void }>) {
  const [entries, setEntries] = useState<Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string; teamId?: string }>>([])
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
              <span>
                {category.format === 'Singles'
                  ? `Player: ${resolveName(players, e.playerId)}`
                  : `Doubles: ${resolveName(players, e.player1Id)} & ${resolveName(players, e.player2Id)}`}
              </span>
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

// team names removed (no teams)

function updateSet(arr: Array<{ a: number; b: number }>, i: number, v: { a: number; b: number }) {
  const copy = [...arr]
  copy[i] = v
  return copy
}

// Shared helper to produce a display label for an entry using available lists
function labelForEntryWithLists(
  entries: Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>,
  players: Array<{ id: string; name?: string }>,
  entryId?: string
) {
  if (!entryId) return '-'
  const e = entries.find(x => x.id === entryId)
  if (!e) return entryId
  if (e.playerId) return resolveName(players, e.playerId)
  if (e.player1Id || e.player2Id) return `${resolveName(players, e.player1Id)} & ${resolveName(players, e.player2Id)}`
  return entryId
}

function BracketCard({ tournamentId, bracket, players, onOpenScore, onShuffle, onFinalizeToggle, onDelete }: Readonly<{ tournamentId: string; bracket: { id: string; name: string; categoryId: string; format: CategoryFormat; status: string; finalized?: boolean }; players: Array<{ id: string; name?: string }>; onOpenScore: (matchId: string, scores: Array<{ a: number; b: number }>, status: 'in-progress'|'completed') => void; onShuffle: () => void; onFinalizeToggle: (finalized: boolean) => void; onDelete: () => void }>) {
  const [matches, setMatches] = useState<Array<{ id: string; round: number; order: number; participantA?: any; participantB?: any; scores: Array<{ a: number; b: number }>; status: string; nextMatchId?: string | null }>>([])
  const [entries, setEntries] = useState<Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>>([])
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const matchRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const [lines, setLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([])
  const [matchOffsets, setMatchOffsets] = useState<Record<string, number>>({})
  const measureRaf = React.useRef<number | null>(null)
  const drawRaf = React.useRef<number | null>(null)
  const roRef = React.useRef<ResizeObserver | null>(null)
  const debounceTimer = React.useRef<number | null>(null)
  const [editModal, setEditModal] = useState<null | { matchId: string; a?: string; b?: string; clearScores: boolean }>(null)
  const [manageSeeds, setManageSeeds] = useState<null | { slots: string[] }>(null)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments', tournamentId, 'brackets', bracket.id, 'matches'), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    const unsubEntries = onSnapshot(collection(db, 'tournaments', tournamentId, 'categories', bracket.categoryId, 'entries'), (snap) => setEntries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => { unsub(); unsubEntries() }
  }, [tournamentId, bracket.id])
  // Unified scheduled layout measure + draw to avoid races (shuffle, font load, resize)
  useEffect(() => {
    const schedule = () => {
      if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
      debounceTimer.current = window.setTimeout(() => {
        if (measureRaf.current) cancelAnimationFrame(measureRaf.current)
        if (drawRaf.current) cancelAnimationFrame(drawRaf.current)
        measureRaf.current = requestAnimationFrame(() => {
          measureRaf.current = requestAnimationFrame(() => {
            const c = containerRef.current
            if (!c || matches.length === 0) return
            const cRect = c.getBoundingClientRect()
            const offsets: Record<string, number> = {}
            for (const m of matches) {
              if (!(m as any).round || (m as any).round <= 1) continue
              const children = matches.filter(x => x.nextMatchId === m.id)
              if (children.length < 2) continue
              const childEls = children.map(ch => matchRefs.current[ch.id]).filter(Boolean) as HTMLDivElement[]
              const parentEl = matchRefs.current[m.id]
              if (childEls.length < 2 || !parentEl) continue
              const a = childEls[0].getBoundingClientRect(); const b = childEls[1].getBoundingClientRect()
              const p = parentEl.getBoundingClientRect()
              const childCenterY = ((a.top + a.height / 2) + (b.top + b.height / 2)) / 2 - cRect.top
              const parentCenterY = (p.top + p.height / 2) - cRect.top
              const delta = childCenterY - parentCenterY
              if (Math.abs(delta) > 0.5) offsets[m.id] = delta
            }
            setMatchOffsets(prev => {
              const changed = Object.keys(offsets).length !== Object.keys(prev).length || Object.entries(offsets).some(([k,v]) => prev[k] !== v)
              return changed ? offsets : prev
            })
            drawRaf.current = requestAnimationFrame(() => {
              const c2 = containerRef.current
              if (!c2) return
              const cRect2 = c2.getBoundingClientRect()
              const ln: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
              for (const m of matches) {
                const fromEl = matchRefs.current[m.id]
                const nextId = (m as any).nextMatchId as string | undefined
                if (!fromEl || !nextId) continue
                const toEl = matchRefs.current[nextId]
                if (!toEl) continue
                const a = fromEl.getBoundingClientRect()
                const b = toEl.getBoundingClientRect()
                const x1 = a.right - cRect2.left
                const y1 = (a.top + a.height / 2 - cRect2.top)
                const x2 = b.left - cRect2.left
                const y2 = (b.top + b.height / 2 - cRect2.top)
                ln.push({ x1, y1, x2, y2 })
              }
              setLines(ln)
            })
          })
        })
      }, 30)
    }
    schedule()
    if (containerRef.current && 'ResizeObserver' in window) {
      roRef.current = new ResizeObserver(() => schedule())
      roRef.current.observe(containerRef.current)
    }
    return () => {
      if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
      if (measureRaf.current) cancelAnimationFrame(measureRaf.current)
      if (drawRaf.current) cancelAnimationFrame(drawRaf.current)
      if (roRef.current) roRef.current.disconnect()
    }
  }, [matches])

  // Reset offsets/lines when the set of matches changes (e.g., after shuffle) so first draw is correct
  useEffect(() => {
    setMatchOffsets({})
    setLines([])
  }, [matches.map(m => m.id).join(',')])

  // Group matches into rounds and helpers for labels
  const grouped = matches.reduce((acc: Record<number, Array<any>>, m) => {
    const arr = acc[m.round] || []
    arr.push(m)
    acc[m.round] = arr
    return acc
  }, {})
  const rounds = Object.keys(grouped).map(n => Number(n)).sort((a,b) => a-b)
  function roundLabel(r: number) {
    const last = rounds[rounds.length - 1]
    const lastButOne = rounds[rounds.length - 2]
    const lastButTwo = rounds[rounds.length - 3]
    if (r === last) return 'Finals'
    if (r === lastButOne) return 'Semi Finals'
    if (r === lastButTwo) return 'Quarter Finals'
    return `Round ${r}`
  }
  function matchStatusClass(status: string) {
    if (status === 'completed') return 'bg-success/15 border-success/40'
    if (status === 'in-progress') return 'bg-warning/15 border-warning/40'
    return 'bg-base-100 border-base-300/60'
  }

  return (
    <li className="p-3 rounded bg-base-200">
      <div className="font-medium mb-2 flex items-center justify-between">
        <span>{bracket.name} <span className="badge ml-2">{bracket.status}</span>{bracket.finalized ? <span className="badge badge-outline ml-2">Finalized</span> : null}</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-xs" onClick={onShuffle} disabled={!!bracket.finalized}>Shuffle</button>
          <button className="btn btn-ghost btn-xs" disabled={!!bracket.finalized} onClick={() => {
            const fr = [...matches].filter((m:any)=>m.round===1).sort((a:any,b:any)=> (a.order||0)-(b.order||0))
            const init: string[] = []
            for (const m of fr) { init.push(m.participantA?.entryId || ''); init.push(m.participantB?.entryId || '') }
            setManageSeeds({ slots: init })
          }}>Manage seeding</button>
          {bracket.finalized ? (
            <button className="btn btn-xs" onClick={() => onFinalizeToggle(false)}>Unlock</button>
          ) : (
            <button className="btn btn-xs" onClick={() => onFinalizeToggle(true)}>Lock</button>
          )}
          <button className="btn btn-ghost btn-xs" onClick={onDelete}>Delete</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div ref={containerRef} className="relative w-max">
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
            {lines.map((l) => {
              const midX = (l.x1 + l.x2) / 2
              const d = `M ${l.x1} ${l.y1} H ${midX} V ${l.y2} H ${l.x2}`
              const key = `${l.x1},${l.y1}->${l.x2},${l.y2}`
              return <path key={key} d={d} stroke="currentColor" className="text-secondary/60" strokeWidth={3} fill="none" />
            })}
          </svg>
          <div className="flex gap-6">
            {rounds.map(r => (
              <div key={r} className="min-w-[240px] flex flex-col justify-center gap-4 relative z-10">
                <div className="gradient-label relative z-10">{roundLabel(r)}</div>
                {(() => { const arr = [...grouped[r]]; arr.sort((a:any,b:any)=>a.order-b.order); return arr })().map((m:any) => (
                  <div key={m.id} ref={(el) => { matchRefs.current[m.id] = el }} style={{ transform: `translateY(${(matchOffsets[m.id]||0)}px)`, willChange: 'transform' }} className={`relative z-10 p-2 rounded text-sm flex justify-between items-center border soft-ring ${matchStatusClass(m.status)}`}>
                    <div>
                      <div className={`flex items-center gap-1 ${m.winner === 'A' ? 'text-success font-medium' : ''}`}>
                        <span>A: {labelForEntryWithLists(entries, players, m.participantA?.entryId)}</span>
                        {m.winner === 'A' && <FiCheck />}
                      </div>
                      <div className={`flex items-center gap-1 ${m.winner === 'B' ? 'text-success font-medium' : ''}`}>
                        <span>B: {labelForEntryWithLists(entries, players, m.participantB?.entryId)}</span>
                        {m.winner === 'B' && <FiCheck />}
                      </div>
                      {((!m.participantA && m.participantB) || (m.participantA && !m.participantB)) && (
                        <div className="badge badge-ghost badge-sm mt-1">BYE</div>
                      )}
                      <div className="text-xs opacity-70">{(m.scores || []).map((s:any)=>`[${s.a}-${s.b}]`).join(' ')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-xs" onClick={() => onOpenScore(m.id, m.scores ?? [], m.status === 'completed' ? 'completed' : 'in-progress')}>Score</button>
                      {m.round === 1 && (
                        <button className="btn btn-ghost btn-xs" disabled={!!bracket.finalized} onClick={() => setEditModal({ matchId: m.id, a: m.participantA?.entryId, b: m.participantB?.entryId, clearScores: true })}>Edit</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {editModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Edit participants</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <EntrySelect entries={entries} players={players} value={editModal.a} onChange={(v)=> setEditModal(m => m ? ({ ...m, a: v || undefined }) : m)} label="Participant A" />
              <EntrySelect entries={entries} players={players} value={editModal.b} onChange={(v)=> setEditModal(m => m ? ({ ...m, b: v || undefined }) : m)} label="Participant B" />
            </div>
            <div className="mt-3">
              <label className="label cursor-pointer gap-2">
                <span className="label-text">Clear existing scores</span>
                <input type="checkbox" className="toggle" checked={editModal.clearScores} onChange={(e)=> setEditModal(m => m ? ({ ...m, clearScores: e.target.checked }) : m)} />
              </label>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setEditModal(null)}>Close</button>
              <button className="btn btn-primary" disabled={!!bracket.finalized} onClick={async () => {
                if (!editModal) return
                if (editModal.a && editModal.b && editModal.a === editModal.b) { alert('A and B cannot be the same entry.'); return }
                const call = httpsCallable(functions, 'addEvent')
                const fr = [...matches].filter((m:any)=>m.round===1)
                const tasks: Promise<any>[] = []
                for (const m of fr) {
                  if (m.id === editModal.matchId) continue
                  const patch: any = { tournamentId, bracketId: bracket.id, matchId: m.id }
                  let needs = false
                  if (editModal.a && m.participantA?.entryId === editModal.a) { patch.participantAEntryId = null; needs = true }
                  if (editModal.a && m.participantB?.entryId === editModal.a) { patch.participantBEntryId = null; needs = true }
                  if (editModal.b && m.participantA?.entryId === editModal.b) { patch.participantAEntryId = null; needs = true }
                  if (editModal.b && m.participantB?.entryId === editModal.b) { patch.participantBEntryId = null; needs = true }
                  if (needs) tasks.push(call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.UpdateMatchParticipants, eventPayload: patch }))
                }
                if (tasks.length) await Promise.all(tasks)
                await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.UpdateMatchParticipants, eventPayload: { tournamentId, bracketId: bracket.id, matchId: editModal.matchId, participantAEntryId: editModal.a || null, participantBEntryId: editModal.b || null, clearScores: !!editModal.clearScores } })
                setEditModal(null)
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {manageSeeds && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Manage seeding (first round)</h3>
            <div className="mt-3 space-y-3">
              {(() => {
                const fr = [...matches].filter((m:any)=>m.round===1).sort((a:any,b:any)=> (a.order||0)-(b.order||0))
                const allIds = entries.map(e=>e.id)
                function setSlot(idx: number, val: string) {
                  setManageSeeds(state => {
                    if (!state) return state
                    const slots = [...state.slots]
                    if (val) { for (let i=0;i<slots.length;i++) { if (i!==idx && slots[i]===val) slots[i]='' } }
                    slots[idx] = val
                    return { slots }
                  })
                }
                function optionsFor(idx: number) {
                  const current = manageSeeds?.slots || []
                  const chosen = new Set(current.filter((v, i) => v && i!==idx))
                  return allIds.filter(id => !chosen.has(id))
                }
                function autoFill() {
                  setManageSeeds(state => {
                    if (!state) return state
                    const used = new Set(state.slots.filter(Boolean))
                    const remaining = allIds.filter(id => !used.has(id))
                    const slots = [...state.slots]
                    for (let i=0;i<slots.length;i++) { if (!slots[i] && remaining.length) slots[i] = remaining.shift() as string }
                    return { slots }
                  })
                }
                return (
                  <>
                    <div className="text-xs opacity-70">Select entries for each slot. Duplicate selections are automatically removed from other slots. Use Auto-fill to fill the rest.</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fr.map((m:any, mi:number) => (
                        <div key={m.id} className="p-2 rounded bg-base-100 border border-base-200">
                          <div className="font-medium mb-2">Match {m.order}</div>
                          <div className="space-y-2">
                            <div>
                              <label className="label text-xs" htmlFor={`seed-a-${mi}`}>Participant A</label>
                              <select id={`seed-a-${mi}`} className="select select-bordered w-full" value={manageSeeds.slots[mi*2]}
                                onChange={(e)=> setSlot(mi*2, e.target.value)}>
                                <option value="">— Clear —</option>
                                {optionsFor(mi*2).map(id => (
                                  <option key={id} value={id}>{labelForEntryWithLists(entries, players, id)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs" htmlFor={`seed-b-${mi}`}>Participant B</label>
                              <select id={`seed-b-${mi}`} className="select select-bordered w-full" value={manageSeeds.slots[mi*2+1]}
                                onChange={(e)=> setSlot(mi*2+1, e.target.value)}>
                                <option value="">— Clear —</option>
                                {optionsFor(mi*2+1).map(id => (
                                  <option key={id} value={id}>{labelForEntryWithLists(entries, players, id)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-sm" type="button" onClick={autoFill}>Auto-fill remaining</button>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setManageSeeds(null)}>Close</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!manageSeeds) return
                const orderedEntryIds = manageSeeds.slots.filter(Boolean)
                const call = httpsCallable(functions, 'addEvent')
                await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.ReseedBracket, eventPayload: { tournamentId, bracketId: bracket.id, strategy: 'ordered', orderedEntryIds } })
                setManageSeeds(null)
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function EntrySelect({ entries, players, value, onChange, label }: Readonly<{ entries: Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>; players: Array<{ id: string; name?: string }>; value?: string; onChange: (v: string) => void; label: string }>) {
  const opts = entries
  return (
    <div className="space-y-1">
      <label className="label text-xs">{label}</label>
      <select className="select select-bordered w-full" value={value ?? ''} onChange={(e)=> onChange(e.target.value)}>
        <option value="">— Clear —</option>
        {opts.map(e => (
          <option key={e.id} value={e.id}>{labelForEntryWithLists(entries, players, e.id)}</option>
        ))}
      </select>
    </div>
  )
}

// Inject edit modal within BracketCard rendering (after main return)

function PlayerPicker({ players, value, onChange, label, excludeId }: Readonly<{ players: Array<{ id: string; name?: string }>; value: string; onChange: (v: string) => void; label?: string; excludeId?: string }>) {
  const [q, setQ] = useState('')
  const filtered = players.filter(p => (p.name || p.id).toLowerCase().includes(q.toLowerCase()) && (!excludeId || p.id !== excludeId))
  return (
    <div className="space-y-2">
      <input className="input input-bordered w-full" placeholder={label ? `${label} — search by name` : 'Search by name'} value={q} onChange={(e)=>setQ(e.target.value)} />
      <select className="select select-bordered w-full" value={value} onChange={(e)=>onChange(e.target.value)}>
        <option value="" disabled>{label || 'Select player'}</option>
        {filtered.map(p => <option key={p.id} value={p.id}>{p.name ?? p.id}</option>)}
      </select>
    </div>
  )
}

function ScoringGrid({ scoreModal, setScoreModal }: Readonly<{ scoreModal: { bracketId: string; matchId: string; scores: Array<{ a: number; b: number }>; status: 'in-progress'|'completed' }; setScoreModal: React.Dispatch<React.SetStateAction<{ bracketId: string; matchId: string; scores: Array<{ a: number; b: number }>; status: 'in-progress'|'completed' } | null>> }>) {
  const [local, setLocal] = useState<{ scores: Array<{ a: number; b: number }>; status: 'in-progress'|'completed'; winner?: 'A'|'B'|null }>({ scores: scoreModal.scores ?? [], status: scoreModal.status })
  const [timer, setTimer] = useState<any>(null)
  useEffect(() => { setLocal({ scores: scoreModal.scores ?? [], status: scoreModal.status }) }, [scoreModal.matchId])
  function bump(i: number, side: 'a'|'b', delta: number) {
    const s = [...(local.scores || [])]
    s[i] = { a: s[i]?.a ?? 0, b: s[i]?.b ?? 0 }
    s[i][side] = Math.max(0, (s[i][side] ?? 0) + delta)
    setLocal({ ...local, scores: s })
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(() => setScoreModal(m => m ? ({ ...m, scores: s }) : m), 250))
  }
  function setVal(i: number, side: 'a'|'b', val: number) {
    const s = [...(local.scores || [])]
    s[i] = { a: s[i]?.a ?? 0, b: s[i]?.b ?? 0 }
    s[i][side] = Math.max(0, val)
    setLocal({ ...local, scores: s })
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(() => setScoreModal(m => m ? ({ ...m, scores: s }) : m), 300))
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {(['A','B'] as const).map((label, colIdx) => (
          <div key={label} className="p-2 rounded bg-base-100 border border-base-200">
            <div className="font-medium mb-2">Player {label}</div>
            <div className="space-y-2">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-10 text-xs opacity-60">Set {i+1}</span>
                  <button className="btn btn-xs" onClick={() => bump(i, colIdx===0?'a':'b', -1)}>-</button>
                  <input type="number" className="input input-bordered input-sm w-20" value={local.scores[i]?.[colIdx===0?'a':'b'] ?? 0} onChange={(e)=> setVal(i, colIdx===0?'a':'b', Number(e.target.value||0))} />
                  <button className="btn btn-xs" onClick={() => bump(i, colIdx===0?'a':'b', +1)}>+</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" className="select select-bordered w-full" value={scoreModal.status} onChange={(e)=> setScoreModal(m => m ? ({ ...m, status: e.target.value as any }) : m)}>
            <option value="in-progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="winner">Winner (optional)</label>
          <select id="winner" className="select select-bordered w-full" value={local.winner ?? ''} onChange={(e)=> setLocal({ ...local, winner: (e.target.value === 'A' || e.target.value === 'B') ? e.target.value : null })}>
            <option value="">Auto</option>
            <option value="A">Player A</option>
            <option value="B">Player B</option>
          </select>
        </div>
      </div>
      <div className="text-xs opacity-70">Scores auto-apply; click Save to persist.</div>
      {/* push local winner into modal state when saving */}
      <EffectOnChange value={local.winner} onChange={(w)=> setScoreModal(m => m ? ({ ...m, // @ts-ignore attach winner for payload
        winner: (w ?? undefined) as any
      }) : m)} />
    </div>
  )
}

function GroupScoringGrid({ groupScoreModal, setGroupScoreModal }: Readonly<{ groupScoreModal: { groupId: string; matchId: string; scoreA: number; scoreB: number; status: 'in-progress'|'completed' }; setGroupScoreModal: React.Dispatch<React.SetStateAction<{ groupId: string; matchId: string; scoreA: number; scoreB: number; status: 'in-progress'|'completed' } | null>> }>) {
  const [local, setLocal] = useState<{ scoreA: number; scoreB: number; status: 'in-progress'|'completed' }>({ scoreA: groupScoreModal.scoreA ?? 0, scoreB: groupScoreModal.scoreB ?? 0, status: groupScoreModal.status })
  const [timer, setTimer] = useState<any>(null)
  useEffect(() => { setLocal({ scoreA: groupScoreModal.scoreA ?? 0, scoreB: groupScoreModal.scoreB ?? 0, status: groupScoreModal.status }) }, [groupScoreModal.matchId])
  function bump(side: 'A'|'B', delta: number) {
    const nxt = { ...local, [side === 'A' ? 'scoreA' : 'scoreB']: Math.max(0, (side === 'A' ? local.scoreA : local.scoreB) + delta) }
    setLocal(nxt)
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(() => setGroupScoreModal(m => m ? ({ ...m, scoreA: nxt.scoreA, scoreB: nxt.scoreB }) : m), 250))
  }
  function setVal(side: 'A'|'B', val: number) {
    const nxt = { ...local, [side === 'A' ? 'scoreA' : 'scoreB']: Math.max(0, val) }
    setLocal(nxt)
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(() => setGroupScoreModal(m => m ? ({ ...m, scoreA: nxt.scoreA, scoreB: nxt.scoreB }) : m), 300))
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {(['A','B'] as const).map(label => (
          <div key={label} className="p-2 rounded bg-base-100 border border-base-200">
            <div className="font-medium mb-2">Player {label}</div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs opacity-60">Score</span>
              <button className="btn btn-xs" onClick={() => bump(label, -1)}>-</button>
              <input type="number" className="input input-bordered input-sm w-20" value={label==='A'?local.scoreA:local.scoreB} onChange={(e)=> setVal(label, Number(e.target.value||0))} />
              <button className="btn btn-xs" onClick={() => bump(label, +1)}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="gs-status">Status</label>
        <select id="gs-status" className="select select-bordered w-full" value={groupScoreModal.status} onChange={(e)=> setGroupScoreModal(m => m ? ({ ...m, status: e.target.value as any }) : m)}>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="text-xs opacity-70">Scores auto-apply; click Save to persist.</div>
    </div>
  )
}

function EffectOnChange<T>({ value, onChange }: Readonly<{ value: T; onChange: (v: T) => void }>) {
  useEffect(() => { onChange(value) }, [value])
  return null
}

function GroupCard({ tournamentId, group, players, onOpenScore, onFinalize }: Readonly<{ tournamentId: string; group: { id: string; name: string; categoryId: string; status: string }; players: Array<{ id: string; name?: string }>; onOpenScore: (matchId: string, scoreA: number, scoreB: number, status: 'in-progress'|'completed') => void; onFinalize: () => void }>) {
  const [matches, setMatches] = useState<Array<{ id: string; a?: any; b?: any; scoreA: number; scoreB: number; status: string }>>([])
  const [entries, setEntries] = useState<Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>>([])
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments', tournamentId, 'groups', group.id, 'matches'), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    const unsubEntries = onSnapshot(collection(db, 'tournaments', tournamentId, 'categories', group.categoryId, 'entries'), (snap) => setEntries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => { unsub(); unsubEntries() }
  }, [tournamentId, group.id])
  function labelForEntry(entryId?: string) { return labelForEntryWithLists(entries, players, entryId) }
  // Compute points table: 3/1/0 with goal diff, played
  const table = (() => {
    const pts: Record<string, { name: string; pts: number; gd: number; played: number }> = {}
    for (const m of matches) {
      const a = m.a?.entryId, b = m.b?.entryId
      if (!a || !b) continue
      const sa = Number(m.scoreA || 0), sb = Number(m.scoreB || 0)
      const aname = labelForEntry(a), bname = labelForEntry(b)
      pts[a] = pts[a] || { name: aname, pts: 0, gd: 0, played: 0 }
      pts[b] = pts[b] || { name: bname, pts: 0, gd: 0, played: 0 }
      pts[a].played++; pts[b].played++;
      pts[a].gd += (sa - sb); pts[b].gd += (sb - sa)
      if (sa > sb) pts[a].pts += 3
      else if (sb > sa) pts[b].pts += 3
      else { pts[a].pts += 1; pts[b].pts += 1 }
    }
    return Object.entries(pts).map(([entryId, r]) => ({ entryId, ...r })).sort((A,B) => {
      if (B.pts !== A.pts) return B.pts - A.pts
      if (B.gd !== A.gd) return B.gd - A.gd
      return B.played - A.played
    })
  })()

  return (
    <li className="p-3 rounded bg-base-200">
      <div className="flex items-center justify-between">
        <div className="font-medium">{group.name} <span className="badge ml-2">{group.status}</span></div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-xs" onClick={async () => {
            if (!confirm('Delete this round robin group and all its matches?')) return
            const call = httpsCallable(functions, 'addEvent')
            await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.DeleteRoundRobinGroup, eventPayload: { tournamentId: tournamentId, groupId: group.id } })
          }}>Delete</button>
          <button className="btn btn-xs" onClick={onFinalize}>Finalize to bracket</button>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {matches.map(m => {
          let winner: 'A'|'B'|null = null
          const sa = m.scoreA ?? 0
          const sb = m.scoreB ?? 0
          if (sa > sb) winner = 'A'
          else if (sb > sa) winner = 'B'
          return (
            <div key={m.id} className={`p-2 rounded text-sm flex justify-between items-center border ${m.status==='completed' ? 'bg-success/10 border-success/30' : m.status==='in-progress' ? 'bg-warning/10 border-warning/30' : 'bg-base-100 border-base-200'}`}>
              <div>
                <div className={`flex items-center gap-1 ${winner === 'A' ? 'text-success font-medium' : ''}`}>
                  <span>A: {labelForEntry(m.a?.entryId)}</span>
                  {winner === 'A' && <FiCheck />}
                </div>
                <div className={`flex items-center gap-1 ${winner === 'B' ? 'text-success font-medium' : ''}`}>
                  <span>B: {labelForEntry(m.b?.entryId)}</span>
                  {winner === 'B' && <FiCheck />}
                </div>
                <div className="text-xs opacity-70">[{m.scoreA}-{m.scoreB}]</div>
              </div>
              <button className="btn btn-xs" onClick={() => onOpenScore(m.id, m.scoreA ?? 0, m.scoreB ?? 0, m.status === 'completed' ? 'completed' : 'in-progress')}>Score</button>
            </div>
          )
        })}
      </div>
      {table.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr><th>#</th><th>Player/Pair</th><th>P</th><th>GD</th><th>Pts</th></tr>
            </thead>
            <tbody>
              {table.map((r, idx) => (
                <tr key={r.entryId}>
                  <td>{idx+1}</td>
                  <td>{r.name}</td>
                  <td>{r.played}</td>
                  <td>{r.gd}</td>
                  <td>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  )
}
