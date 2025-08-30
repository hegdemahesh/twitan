import { FieldValue, Firestore } from 'firebase-admin/firestore'
import { Handler } from '../types'
import { isTournamentCreateBracket, isTournamentUpdateMatchScore, EventNames } from '../../../../shared/events'

function nextPowerOfTwo(n: number) {
  let p = 1
  while (p < n) p <<= 1
  return p
}

export const createBracketFromCategory: Handler = async ({ db, snap, data }) => {
  if (!isTournamentCreateBracket(data)) return
  const { tournamentId, categoryId, bracketName } = data.eventPayload
  const bracketRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc()
  const catRef = db.collection('tournaments').doc(tournamentId).collection('categories').doc(categoryId)
  const catSnap = await catRef.get()
  const cat = catSnap.data() as any | undefined
  const format: 'Singles'|'Doubles' = (cat?.format ?? 'Singles')

  const entriesSnap = await catRef.collection('entries').get()
  const entries = entriesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
  const n = entries.length
  await bracketRef.set({
    name: bracketName || cat?.name || 'Bracket',
    categoryId,
    format,
    createdAt: FieldValue.serverTimestamp(),
    status: n >= 2 ? 'active' : 'pending',
  finalized: false,
  })

  if (n < 2) {
    await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
    return
  }

  const { roundMatches } = await precreateAndWireMatches(bracketRef, n)
  await seedFirstRound(bracketRef, roundMatches[0], entries, db, tournamentId)

  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), bracketId: bracketRef.id })
}

async function precreateAndWireMatches(bracketRef: FirebaseFirestore.DocumentReference, n: number) {
  const size = nextPowerOfTwo(n)
  const rounds = Math.ceil(Math.log2(size))
  const roundMatches: string[][] = []
  for (let r = 1; r <= rounds; r++) {
    const matchesThisRound: string[] = []
    const count = size >> r
    for (let i = 0; i < count; i++) {
      const mRef = bracketRef.collection('matches').doc()
      await mRef.set({
        round: r,
        order: i + 1,
        participantA: null,
        participantB: null,
        scores: [],
        status: 'scheduled',
        winner: null,
        nextMatchId: null,
        nextSlot: null,
        createdAt: FieldValue.serverTimestamp(),
      })
      matchesThisRound.push(mRef.id)
    }
    roundMatches.push(matchesThisRound)
  }
  for (let r = 1; r <= rounds - 1; r++) {
    const current = roundMatches[r - 1]
    const next = roundMatches[r]
    for (let i = 0; i < current.length; i++) {
      const nextIndex = Math.floor(i / 2)
      const slot = (i % 2 === 0) ? 'A' : 'B'
      const mId = current[i]
      await bracketRef.collection('matches').doc(mId).update({ nextMatchId: next[nextIndex], nextSlot: slot })
    }
  }
  return { roundMatches }
}

async function seedFirstRound(bracketRef: FirebaseFirestore.DocumentReference, firstRound: string[], entries: Array<{ id: string }>, db: Firestore, tournamentId: string) {
  for (let i = 0; i < firstRound.length; i++) {
    const mId = firstRound[i]
    const a = entries[i * 2]
    const b = entries[i * 2 + 1]
    const update: any = {}
    if (a) update.participantA = { entryId: a.id }
    if (b) update.participantB = { entryId: b.id }
    await bracketRef.collection('matches').doc(mId).update(update)
    if (a && !b) await advanceWinner(db, tournamentId, bracketRef.id, mId, 'A')
    else if (!a && b) await advanceWinner(db, tournamentId, bracketRef.id, mId, 'B')
  }
}

async function advanceWinner(db: Firestore, tournamentId: string, bracketId: string, matchId: string, winner: 'A'|'B') {
  const mRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc(bracketId).collection('matches').doc(matchId)
  const mSnap = await mRef.get()
  const m = mSnap.data() as any
  if (!m) return
  const nextId: string | null = m.nextMatchId
  const slot: 'A'|'B' | null = m.nextSlot
  const participant = winner === 'A' ? m.participantA : m.participantB
  await mRef.update({ winner, status: 'completed' })
  if (nextId && slot && participant) {
    const nextRef = mRef.parent.doc(nextId)
    const patch: any = {}
    if (slot === 'A') patch.participantA = participant
    else patch.participantB = participant
    await nextRef.update(patch)
  }
}

export const updateMatchScore: Handler = async ({ db, snap, data }) => {
  if (!isTournamentUpdateMatchScore(data)) return
  const { tournamentId, bracketId, matchId, scores, status, winner: winnerOverride } = data.eventPayload
  const mRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc(bracketId).collection('matches').doc(matchId)
  const mSnap = await mRef.get()
  if (!mSnap.exists) throw new Error('Match not found')

  // Determine winner by sets
  let aSets = 0, bSets = 0
  for (const s of scores) {
    if (typeof s?.a === 'number' && typeof s?.b === 'number') {
      if (s.a > s.b) aSets++
      else if (s.b > s.a) bSets++
    }
  }
  let winner: 'A'|'B'|null = null
  if (winnerOverride === 'A' || winnerOverride === 'B') winner = winnerOverride
  else if (status === 'completed') {
    if (aSets > bSets) winner = 'A'
    else if (bSets > aSets) winner = 'B'
  }
  await mRef.update({ scores, status, winner })

  if (winner) {
    await advanceWinner(db, tournamentId, bracketId, matchId, winner)
  }

  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
}

export const deleteBracket: Handler = async ({ db, snap, data }) => {
  if (!(data.eventType === 'tournament' && data.eventName === 'deleteBracket')) return
  const { tournamentId, bracketId } = data.eventPayload as { tournamentId: string; bracketId: string }
  const bRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc(bracketId)
  const matchesSnap = await bRef.collection('matches').get()
  const batch = db.batch()
  matchesSnap.docs.forEach(d => batch.delete(d.ref))
  batch.delete(bRef)
  await batch.commit()
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
}

// Admin reseed: shuffle or ordered first-round seeding, optional force override even if finalized
function computeSeedIds(entries: Array<{ id: string }>, orderedEntryIds?: string[], strategy?: 'shuffle'|'ordered') {
  if (strategy === 'ordered' && orderedEntryIds) {
    return orderedEntryIds.filter(id => entries.some(e => e.id === id))
  }
  const ids = entries.map(e => e.id)
  if (strategy === 'shuffle' || !strategy) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
  }
  return ids
}

export const reseedBracket: Handler = async ({ db, snap, data }) => {
  if (!(data.eventType === 'tournament' && data.eventName === EventNames.Tournament.ReseedBracket)) return
  const { tournamentId, bracketId, orderedEntryIds, strategy, force } = data.eventPayload as { tournamentId: string; bracketId: string; orderedEntryIds?: string[]; strategy?: 'shuffle'|'ordered'; force?: boolean }
  const bRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc(bracketId)
  const bSnap = await bRef.get()
  const bracket = bSnap.data() as any
  if (!bracket) throw new Error('Bracket not found')
  if (bracket.finalized && !force) throw new Error('Bracket is finalized')

  // Fetch category entries to build entry list if needed
  const catId = bracket.categoryId
  const entSnap = await db.collection('tournaments').doc(tournamentId).collection('categories').doc(catId).collection('entries').get()
  const entries = entSnap.docs.map(d => ({ id: d.id }))

  const seedIds = computeSeedIds(entries, orderedEntryIds, strategy)

  // Reset all matches: clear scores, winner; clear participants for rounds > 1
  const allMatchesSnap = await bRef.collection('matches').get()
  const all = allMatchesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
  const firstRound = all.filter(m => m.round === 1).sort((a,b) => (a.order||0)-(b.order||0))
  const batch = db.batch()
  for (const m of all) {
    const patch: any = { scores: [], winner: null, status: 'scheduled' }
    if (m.round > 1) { patch.participantA = null; patch.participantB = null }
    batch.update(bRef.collection('matches').doc(m.id), patch)
  }
  // Apply new seeds to first round
  for (let i = 0; i < firstRound.length; i++) {
    const m = firstRound[i]
    const aId = seedIds[i*2]
    const bId = seedIds[i*2+1]
    const patch: any = { }
    patch.participantA = aId ? { entryId: aId } : null
    patch.participantB = bId ? { entryId: bId } : null
    batch.update(bRef.collection('matches').doc(m.id), patch)
  }
  await batch.commit()
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
}

// Admin can change participants for any match (pre/post finalize), optionally clear scores
export const updateMatchParticipants: Handler = async ({ db, snap, data }) => {
  if (!(data.eventType === 'tournament' && data.eventName === EventNames.Tournament.UpdateMatchParticipants)) return
  const { tournamentId, bracketId, matchId, participantAEntryId, participantBEntryId, clearScores, force } = data.eventPayload
  const mRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc(bracketId).collection('matches').doc(matchId)
  const bRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc(bracketId)
  const bSnap = await bRef.get()
  const bracket = bSnap.data() as any
  if (bracket?.finalized && !force) throw new Error('Bracket is finalized')
  const patch: any = {}
  if (participantAEntryId !== undefined) patch.participantA = participantAEntryId ? { entryId: participantAEntryId } : null
  if (participantBEntryId !== undefined) patch.participantB = participantBEntryId ? { entryId: participantBEntryId } : null
  if (clearScores) { patch.scores = []; patch.winner = null; patch.status = 'scheduled' }
  await mRef.update(patch)
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
}

// Admin can lock/unlock a bracket
export const setBracketFinalized: Handler = async ({ db, snap, data }) => {
  if (!(data.eventType === 'tournament' && data.eventName === EventNames.Tournament.SetBracketFinalized)) return
  const { tournamentId, bracketId, finalized } = data.eventPayload as { tournamentId: string; bracketId: string; finalized: boolean }
  const bRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc(bracketId)
  await bRef.update({ finalized: !!finalized })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
}
