import { FieldValue } from 'firebase-admin/firestore'
import { Handler } from '../types'
import { EventNames, EventTypes } from '../../../../shared/events'

export const createRoundRobin: Handler = async ({ db, snap, data }) => {
  if (!(data.eventType === EventTypes.Tournament && data.eventName === EventNames.Tournament.CreateRoundRobin)) return
  const { tournamentId, categoryId, groupName } = data.eventPayload
  const groupRef = db.collection('tournaments').doc(tournamentId).collection('groups').doc()
  // Load entries from category
  const catRef = db.collection('tournaments').doc(tournamentId).collection('categories').doc(categoryId)
  const entriesSnap = await catRef.collection('entries').get()
  const entries = entriesSnap.docs.map(d => ({ id: d.id }))
  await groupRef.set({
    categoryId,
    name: groupName || 'Group Stage',
    createdAt: FieldValue.serverTimestamp(),
    status: entries.length >= 2 ? 'active' : 'pending',
  })
  // Create all-vs-all matches
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const mRef = groupRef.collection('matches').doc()
      await mRef.set({
        a: { entryId: entries[i].id },
        b: { entryId: entries[j].id },
        scoreA: 0,
        scoreB: 0,
        status: 'scheduled',
        createdAt: FieldValue.serverTimestamp(),
      })
    }
  }
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), groupId: groupRef.id })
}

export const updateRoundRobinMatch: Handler = async ({ db, snap, data }) => {
  if (!(data.eventType === EventTypes.Tournament && data.eventName === EventNames.Tournament.UpdateRoundRobinMatch)) return
  const { tournamentId, groupId, matchId, scoreA, scoreB, status } = data.eventPayload
  const mRef = db.collection('tournaments').doc(tournamentId).collection('groups').doc(groupId).collection('matches').doc(matchId)
  await mRef.update({ scoreA, scoreB, status })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
}

export const finalizeRoundRobinToBracket: Handler = async ({ db, snap, data }) => {
  if (!(data.eventType === EventTypes.Tournament && data.eventName === EventNames.Tournament.FinalizeRoundRobinToBracket)) return
  const { tournamentId, groupId, topN } = data.eventPayload as { tournamentId: string; groupId: string; topN: number }
  const groupRef = db.collection('tournaments').doc(tournamentId).collection('groups').doc(groupId)
  const groupSnap = await groupRef.get()
  const group = groupSnap.data() as any
  if (!group) throw new Error('Group not found')
  const catId: string = group.categoryId
  // Load category to copy format
  const catSnap = await db.collection('tournaments').doc(tournamentId).collection('categories').doc(catId).get()
  const cat = catSnap.data() as any | undefined
  const format = (cat?.format === 'Doubles') ? 'Doubles' : 'Singles'

  const matchesSnap = await groupRef.collection('matches').get()
  // Compute standings: 3 pts win, 1 draw, 0 loss
  const points: Record<string, { pts: number; gd: number; played: number }> = {}
  matchesSnap.forEach((d) => {
    const m = d.data() as any
    const a = m.a?.entryId
    const b = m.b?.entryId
    if (!a || !b) return
    const sa = Number(m.scoreA || 0)
    const sb = Number(m.scoreB || 0)
    points[a] = points[a] || { pts: 0, gd: 0, played: 0 }
    points[b] = points[b] || { pts: 0, gd: 0, played: 0 }
    points[a].played++
    points[b].played++
    points[a].gd += (sa - sb)
    points[b].gd += (sb - sa)
    if (sa > sb) points[a].pts += 3
    else if (sb > sa) points[b].pts += 3
    else { points[a].pts += 1; points[b].pts += 1 }
  })
  const ranked = Object.entries(points).sort(([, A], [, B]) => {
    if (B.pts !== A.pts) return B.pts - A.pts
    if (B.gd !== A.gd) return B.gd - A.gd
    return B.played - A.played
  }).map(([entryId]) => entryId)
  const qualifiers = ranked.slice(0, Math.max(2, topN || 2))

  // Create a bracket from qualifiers under the same category
  const bracketRef = db.collection('tournaments').doc(tournamentId).collection('brackets').doc()
  await bracketRef.set({
    name: `${group.name || 'Group'} Finals`,
    categoryId: catId,
    format,
    createdAt: FieldValue.serverTimestamp(),
    status: qualifiers.length >= 2 ? 'active' : 'pending',
  })
  // Seed first round with qualifiers
  // Pair 1v2, 3v4, etc.
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, qualifiers.length))))
  const rounds = Math.ceil(Math.log2(size))
  const roundMatches: string[][] = []
  for (let r = 1; r <= rounds; r++) {
    const matchesThisRound: string[] = []
    const count = size >> r
    for (let i = 0; i < count; i++) {
      const mRef = bracketRef.collection('matches').doc()
      await mRef.set({ round: r, order: i + 1, participantA: null, participantB: null, scores: [], status: 'scheduled', winner: null, nextMatchId: null, nextSlot: null, createdAt: FieldValue.serverTimestamp() })
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
  const firstRound = roundMatches[0]
  for (let i = 0; i < firstRound.length; i++) {
    const mId = firstRound[i]
    const a = qualifiers[i * 2]
    const b = qualifiers[i * 2 + 1]
    const patch: any = {}
    if (a) patch.participantA = { entryId: a }
    if (b) patch.participantB = { entryId: b }
    await bracketRef.collection('matches').doc(mId).update(patch)
  }

  await groupRef.update({ status: 'completed', finalizedAt: FieldValue.serverTimestamp(), bracketId: bracketRef.id })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), bracketId: bracketRef.id })
}

export const deleteRoundRobinGroup: Handler = async ({ db, snap, data }) => {
  if (!(data.eventType === EventTypes.Tournament && data.eventName === EventNames.Tournament.DeleteRoundRobinGroup)) return
  const { tournamentId, groupId } = data.eventPayload as { tournamentId: string; groupId: string }
  const gRef = db.collection('tournaments').doc(tournamentId).collection('groups').doc(groupId)
  const matchesSnap = await gRef.collection('matches').get()
  const batch = db.batch()
  matchesSnap.docs.forEach(d => batch.delete(d.ref))
  batch.delete(gRef)
  await batch.commit()
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
}
