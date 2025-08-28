import { FieldValue, Firestore } from 'firebase-admin/firestore'
import { Handler } from '../types'
import { isTournamentCreateBracket, isTournamentUpdateMatchScore } from '../../../../shared/events'

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
  const { tournamentId, bracketId, matchId, scores, status } = data.eventPayload
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
  if (status === 'completed') {
    if (aSets > bSets) winner = 'A'
    else if (bSets > aSets) winner = 'B'
  }
  await mRef.update({ scores, status, winner })

  if (winner) {
    await advanceWinner(db, tournamentId, bracketId, matchId, winner)
  }

  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
}
