import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { auth, db, functions, httpsCallable, onAuthStateChanged, isEmulator } from '../lib/firebase'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { EventNames, EventTypes } from '../../../shared/events'
import Header from '../components/Header'
import { Bracket } from '../components/Bracket'
import { resolveName } from '../utils/entries'
// icons removed (no back button now)
import CountryPhoneInput from '../components/CountryPhoneInput'
import { Group } from '../components/Group'

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
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingCategory, setEditingCategory] = useState<null | { categoryId: string; data: { name: string; minAge?: number | null; maxAge?: number | null; gender: CategoryGender; format: CategoryFormat } }>(null)
  const [entryModal, setEntryModal] = useState<null | { categoryId: string; categoryName: string; format: CategoryFormat; gender: CategoryGender; minAge?: number | null; maxAge?: number | null }>(null)
  const [entrySelected, setEntrySelected] = useState<string>('')
  const [entrySelectedP2, setEntrySelectedP2] = useState<string>('')
  // Single-page manage view (no tabs)
  const [brackets, setBrackets] = useState<Array<{ id: string; name: string; categoryId: string; format: CategoryFormat; status: string }>>([])
  const [scoreModal, setScoreModal] = useState<null | { bracketId: string; matchId: string; scores: Array<{ a: number; b: number }>; status: 'in-progress'|'completed' }>(null)
  const [newBracketCategoryId, setNewBracketCategoryId] = useState<string>('')
  // Round robin (group stage)
  const [groups, setGroups] = useState<Array<{ id: string; name: string; categoryId: string; status: string }>>([])
  const [newGroupCategoryId, setNewGroupCategoryId] = useState<string>('')
  const [groupScoreModal, setGroupScoreModal] = useState<null | { groupId: string; matchId: string; scoreA: number; scoreB: number; status: 'in-progress'|'completed' }>(null)
  const [catExpand, setCatExpand] = useState<Record<string, { entries: boolean; fixtures: boolean }>>({})
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showPlayersPanel, setShowPlayersPanel] = useState(false)
  const [showRolesPanel, setShowRolesPanel] = useState(false)
  const [seedingModal, setSeedingModal] = useState<null | { categoryId: string; categoryName: string; format: CategoryFormat }>(null)
  const [pendingSeed, setPendingSeed] = useState<null | { categoryId: string; orderedEntryIds: string[]; lock: boolean }>(null)

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

  // Apply reseed once a bracket for the category exists
  useEffect(() => {
    if (!pendingSeed) return
    const b = brackets.find(b => b.categoryId === pendingSeed.categoryId)
    if (!b) return
    const run = async () => {
      const call = httpsCallable(functions, 'addEvent')
      await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.ReseedBracket, eventPayload: { tournamentId: id!, bracketId: b.id, strategy: 'ordered', orderedEntryIds: pendingSeed.orderedEntryIds } })
      if (pendingSeed.lock) {
        await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.SetBracketFinalized, eventPayload: { tournamentId: id!, bracketId: b.id, finalized: true } })
      }
      setPendingSeed(null)
    }
    run()
  }, [pendingSeed, brackets])

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

  {/* Admins & Scorers moved to bottom of page as requested */}
  {/* Only Categories remain visible permanently; Players shown via modal */}
  <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-medium">{tournament?.name ?? 'Tournament'}</div>
            {tournament && <div className="text-xs opacity-70">{tournament.type} • {tournament.status}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddCategory(true)}>Add category</button>
            <button className="btn btn-sm" onClick={() => setShowPlayersPanel(true)}>Players</button>
            <button className="btn btn-sm" onClick={() => setShowRolesPanel(true)}>Admins & scorers</button>
          </div>
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
                    {catExpand[c.id]?.fixtures ? 'Hide brackets' : 'View brackets'}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setSeedingModal({ categoryId: c.id, categoryName: c.name, format: c.format })}>Create bracket</button>
                  <button className="btn btn-secondary btn-sm" onClick={async () => {
                    const call = httpsCallable(functions, 'addEvent')
                    await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.CreateRoundRobin, eventPayload: { tournamentId: id, categoryId: c.id } })
                  }}>Create round robin</button>
                </div>
                {catExpand[c.id]?.entries && (
                  <CategoryEntries
                    tournamentId={id}
                    category={{ id: c.id, name: c.name, format: c.format, minAge: c.minAge ?? null, maxAge: c.maxAge ?? null, gender: c.gender }}
                    players={players}
                    onAddRequest={() => { setEntryModal({ categoryId: c.id, categoryName: c.name, format: c.format, gender: c.gender, minAge: c.minAge ?? null, maxAge: c.maxAge ?? null }); setEntrySelected('') }}
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
                          <Bracket
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
                          <Group key={g.id} tournamentId={id} group={g} players={players} onOpenScore={(matchId: string, scoreA: number, scoreB: number, status: 'in-progress'|'completed') => setGroupScoreModal({ groupId: g.id, matchId, scoreA, scoreB, status })} onFinalize={() => finalizeGroupToBracket(g.id)} />
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


      {msg && <p className="text-sm opacity-80">{msg}</p>}

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Add player</h3>
            <p className="text-xs opacity-70 mt-1">Enter phone and basic details. You can edit more fields later.</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
              <div className="md:col-span-3">
                <CountryPhoneInput value={playerPhone} onChange={setPlayerPhone} label="Phone" stacked placeholder="9876543210" />
              </div>
              <div className="md:col-span-3">
                <label className="label" htmlFor="ap-name"><span className="label-text">Name</span></label>
                <input id="ap-name" className="input input-bordered w-full" placeholder="Full name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="ap-dob"><span className="label-text">Date of birth</span></label>
                <input id="ap-dob" type="date" className="input input-bordered w-full" value={playerDob} onChange={(e) => setPlayerDob(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="ap-gender"><span className="label-text">Gender</span></label>
                <select id="ap-gender" className="select select-bordered w-full" value={playerGender} onChange={(e) => setPlayerGender(e.target.value as any)}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="ap-city"><span className="label-text">Town/City</span></label>
                <input id="ap-city" className="input input-bordered w-full" placeholder="Optional" value={playerCity} onChange={(e) => setPlayerCity(e.target.value)} />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowAddPlayer(false)}>Close</button>
              <button className="btn btn-primary" onClick={async () => { await addPlayerByPhone(); setShowAddPlayer(false) }} disabled={!playerName.trim() || !playerDob}>Add</button>
            </div>
            {isEmulator && (
              <div className="pt-2">
                <button className="btn btn-sm" onClick={() => addRandomPlayers(10)}>Dev: Add 10 random players</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Add category</h3>
            <p className="text-xs opacity-70 mt-1">Create an event like Men Singles, Women Singles, U15 Singles, or Doubles. Age bounds are optional.</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
              <div className="md:col-span-3">
                <label className="label" htmlFor="ac-name"><span className="label-text">Name</span></label>
                <input id="ac-name" className="input input-bordered w-full" placeholder="e.g., Men Singles" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="ac-minAge"><span className="label-text">Min age</span></label>
                <input id="ac-minAge" type="number" className="input input-bordered w-full" placeholder="Optional" value={catForm.minAge ?? ''} onChange={(e) => setCatForm({ ...catForm, minAge: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="label" htmlFor="ac-maxAge"><span className="label-text">Max age</span></label>
                <input id="ac-maxAge" type="number" className="input input-bordered w-full" placeholder="Optional" value={catForm.maxAge ?? ''} onChange={(e) => setCatForm({ ...catForm, maxAge: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="label" htmlFor="ac-gender"><span className="label-text">Gender</span></label>
                <select id="ac-gender" className="select select-bordered w-full" value={catForm.gender} onChange={(e) => setCatForm({ ...catForm, gender: e.target.value as any })}>
                  <option>Open</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ac-format"><span className="label-text">Format</span></label>
                <select id="ac-format" className="select select-bordered w-full" value={catForm.format} onChange={(e) => setCatForm({ ...catForm, format: e.target.value as any })}>
                  <option>Singles</option>
                  <option>Doubles</option>
                </select>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowAddCategory(false)}>Close</button>
              <button className="btn btn-primary" onClick={async () => { await addCategory(); setShowAddCategory(false) }} disabled={!catForm.name.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Edit category</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
              <div className="md:col-span-3">
                <label className="label" htmlFor="ec-name"><span className="label-text">Name</span></label>
                <input id="ec-name" className="input input-bordered w-full" placeholder="Name" value={editingCategory.data.name} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, name: e.target.value } })} />
              </div>
              <div>
                <label className="label" htmlFor="ec-minAge"><span className="label-text">Min age</span></label>
                <input id="ec-minAge" type="number" className="input input-bordered w-full" placeholder="Optional" value={editingCategory.data.minAge ?? ''} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, minAge: e.target.value ? Number(e.target.value) : null } })} />
              </div>
              <div>
                <label className="label" htmlFor="ec-maxAge"><span className="label-text">Max age</span></label>
                <input id="ec-maxAge" type="number" className="input input-bordered w-full" placeholder="Optional" value={editingCategory.data.maxAge ?? ''} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, maxAge: e.target.value ? Number(e.target.value) : null } })} />
              </div>
              <div>
                <label className="label" htmlFor="ec-gender"><span className="label-text">Gender</span></label>
                <select id="ec-gender" className="select select-bordered w-full" value={editingCategory.data.gender} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, gender: e.target.value as any } })}>
                  <option>Open</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ec-format"><span className="label-text">Format</span></label>
                <select id="ec-format" className="select select-bordered w-full" value={editingCategory.data.format} onChange={(e) => setEditingCategory({ ...editingCategory, data: { ...editingCategory.data, format: e.target.value as any } })}>
                  <option>Singles</option>
                  <option>Doubles</option>
                </select>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setEditingCategory(null)}>Close</button>
              <button className="btn btn-primary" onClick={saveCategoryEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

  {/* Players Panel Modal */}
      {showPlayersPanel && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg">Players</h3>
            <div className="mt-2 flex justify-between items-center">
              <p className="text-sm opacity-70">Add or review players participating in this tournament.</p>
              <button className="btn btn-sm" onClick={() => { setShowPlayersPanel(false); setShowAddPlayer(true); }}>Add player</button>
            </div>
            <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {players.map(p => (
                <li key={p.id} className="bg-base-200 rounded p-2 text-sm flex justify-between">
                  <span>{p.name ?? '(no name)'} • {p.phoneNumber ?? ''}</span>
                  <span className="opacity-60">{p.gender ?? ''} {p.dob ? `• ${p.dob}` : ''} {p?.city ? `• ${p.city}` : ''}</span>
                </li>
              ))}
            </ul>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowPlayersPanel(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Admins & Scorers Modal */}
      {showRolesPanel && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg">Admins & scorers</h3>
            <div className="mt-4 flex flex-col md:flex-row gap-2">
              <select className="select select-bordered" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="admin">Admin</option>
                <option value="scorer">Scorer</option>
              </select>
              <CountryPhoneInput value={phone} onChange={setPhone} />
              <button className="btn" onClick={addRole}>Add</button>
            </div>
            <ul className="mt-3 space-y-2">
              {roles.map(r => (
                <li key={r.id} className="flex justify-between bg-base-200 p-2 rounded">
                  <span className="text-sm">{r.role} • {r.phoneNumber}</span>
                  <button className="btn btn-xs" onClick={() => delRole(r.id)}>Remove</button>
                </li>
              ))}
            </ul>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowRolesPanel(false)}>Close</button>
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
                <PlayerPicker players={players} value={entrySelected} onChange={setEntrySelected} label="Select player" filter={(p) => isEligibleForCategory(p, entryModal, tournament?.startDate)} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <PlayerPicker players={players} value={entrySelected} onChange={setEntrySelected} label="Select player 1" filter={(p) => isEligibleForCategory(p, entryModal, tournament?.startDate)} />
                  <PlayerPicker players={players} value={entrySelectedP2} onChange={setEntrySelectedP2} label="Select player 2" excludeId={entrySelected} filter={(p) => isEligibleForCategory(p, entryModal, tournament?.startDate)} />
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

      {seedingModal && (
        <SeedBracketDialog
          tournamentId={id}
          categoryId={seedingModal.categoryId}
          categoryName={seedingModal.categoryName}
          onClose={() => setSeedingModal(null)}
          onConfirm={async (orderedIds, lock) => {
            // Create bracket first, then reseed when it appears
            const call = httpsCallable(functions, 'addEvent')
            await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.CreateBracketFromCategory, eventPayload: { tournamentId: id, categoryId: seedingModal.categoryId } })
            // Store only real entry IDs; BYEs are implicit
            setPendingSeed({ categoryId: seedingModal.categoryId, orderedEntryIds: orderedIds.filter(x => !x.startsWith('BYE-')), lock })
            setSeedingModal(null)
          }}
        />
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

function CategoryEntries({ tournamentId, category, players, onAddRequest, onDeleteEntry }: Readonly<{ tournamentId: string; category: { id: string; name: string; format: 'Singles' | 'Doubles'; minAge?: number | null; maxAge?: number | null; gender: CategoryGender }; players: Array<{ id: string; name?: string }>; onAddRequest: () => void; onDeleteEntry: (entryId: string) => void }>) {
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

// team names removed (no teams)

function updateSet(arr: Array<{ a: number; b: number }>, i: number, v: { a: number; b: number }) {
  const copy = [...arr]
  copy[i] = v
  return copy
}
// Bracket rendering moved into reusable <Bracket />

// Inject edit modal within BracketCard rendering (after main return)

function PlayerPicker({ players, value, onChange, label, excludeId, filter }: Readonly<{ players: Array<{ id: string; name?: string; dob?: string; gender?: PlayerGender }>; value: string; onChange: (v: string) => void; label?: string; excludeId?: string; filter?: (p: any) => boolean }>) {
  const [q, setQ] = useState('')
  const filtered = players
    .filter(p => (p.name || p.id).toLowerCase().includes(q.toLowerCase()))
    .filter(p => (!excludeId || p.id !== excludeId))
    .filter(p => (filter ? filter(p) : true))
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

function isEligibleForCategory(p: { dob?: string; gender?: PlayerGender }, cat: { gender: CategoryGender; minAge?: number | null; maxAge?: number | null }, asOf?: string) {
  const genderOk = cat.gender === 'Open' || !p.gender || p.gender === cat.gender
  if (!genderOk) return false
  const needsAgeCheck = typeof cat.minAge === 'number' || typeof cat.maxAge === 'number'
  if (!needsAgeCheck) return true
  const ref = asOf ? new Date(asOf) : new Date()
  const dob = p.dob ? new Date(p.dob) : null
  if (!dob) return false
  const beforeBirthday = ref.getMonth() < dob.getMonth() || (ref.getMonth() === dob.getMonth() && ref.getDate() < dob.getDate())
  const age = ref.getFullYear() - dob.getFullYear() - (beforeBirthday ? 1 : 0)
  if (typeof cat.minAge === 'number' && age < cat.minAge) return false
  if (typeof cat.maxAge === 'number' && age > cat.maxAge) return false
  return true
}

function SeedBracketDialog({ tournamentId, categoryId, categoryName, onClose, onConfirm }: Readonly<{ tournamentId: string; categoryId: string; categoryName: string; onClose: () => void; onConfirm: (orderedIds: string[], lock: boolean) => void }>) {
  const [entries, setEntries] = useState<Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>>([])
  const [ordered, setOrdered] = useState<string[]>([])
  const [lock, setLock] = useState(false)
  const [byes, setByes] = useState<number>(0)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'entries'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      setEntries(list)
      if (ordered.length === 0) setOrdered(list.map(e => e.id))
    })
    return () => unsub()
  }, [tournamentId, categoryId])
  function move(i: number, dir: -1 | 1) {
    const a = [...ordered]
    const j = i + dir
    if (j < 0 || j >= a.length) return
  [a[i], a[j]] = [a[j], a[i]]
    setOrdered(a)
  }
  function remove(id: string) { setOrdered(ordered.filter(x => x !== id)) }
  function add(id: string) { if (!ordered.includes(id)) setOrdered([...ordered, id]) }
  const orderedWithByes = (() => {
    const a = [...ordered]
    // insert BYEs evenly: after each pair boundary until count exhausted
    let count = byes
    let idx = 1
    while (count > 0 && idx <= a.length) {
      a.splice(idx, 0, `BYE-${byes - count + 1}`)
      count--; idx += 2
    }
    if (count > 0) {
      // append remaining
      for (let k = 0; k < count; k++) a.push(`BYE-${byes - count + 1 + k}`)
    }
    return a
  })()
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl">
        <h3 className="font-bold text-lg">Seed bracket for {categoryName}</h3>
        <div className="text-xs opacity-70 mt-1">Arrange players on the right; add BYEs to balance the draw. Left = available entries.</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-2 rounded bg-base-100 border border-base-200">
            <div className="font-medium mb-2 text-sm">Available</div>
            <ul className="space-y-1 max-h-80 overflow-auto">
              {entries.filter(e => !ordered.includes(e.id)).map(e => (
                <li key={e.id} className="flex justify-between items-center bg-base-200 rounded px-2 py-1 text-sm">
                  <span>{e.playerId ? e.playerId : `${e.player1Id} & ${e.player2Id}`}</span>
                  <button className="btn btn-ghost btn-xs" onClick={() => add(e.id)}>Add →</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-2 rounded bg-base-100 border border-base-200">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-sm">Bracket order</div>
              <div className="flex items-center gap-2">
                <label className="label" htmlFor="seed-byes"><span className="label-text">BYEs</span></label>
                <input id="seed-byes" type="number" min={0} className="input input-bordered input-sm w-24" value={byes} onChange={(e)=> setByes(Math.max(0, Number(e.target.value||0)))} />
              </div>
            </div>
            <ul className="space-y-1 max-h-80 overflow-auto">
              {orderedWithByes.map((id, i) => (
                <li key={`${id}-${i}`} className="flex items-center gap-2 bg-base-200 rounded px-2 py-1 text-sm">
                  <span className="w-6 text-xs opacity-60">{i+1}</span>
                  <span className="flex-1">{id.startsWith('BYE-') ? id : (entries.find(e => e.id === id)?.playerId || `${entries.find(e => e.id === id)?.player1Id} & ${entries.find(e => e.id === id)?.player2Id}`)}</span>
                  {!id.startsWith('BYE-') && (
                    <>
                      <button className="btn btn-ghost btn-xs" onClick={() => move(i, -1)}>↑</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => move(i, +1)}>↓</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => remove(id)}>Remove</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="modal-action">
          <label className="label" htmlFor="seed-lock"><span className="label-text">Lock bracket after create</span></label>
          <input id="seed-lock" type="checkbox" className="toggle" checked={lock} onChange={(e)=> setLock(e.target.checked)} />
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => onConfirm(orderedWithByes, lock)} disabled={ordered.length === 0}>Create</button>
        </div>
      </div>
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
 
