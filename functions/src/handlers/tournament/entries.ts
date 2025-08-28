import { FieldValue } from 'firebase-admin/firestore'
import { Handler } from '../types'

export const addEntry: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as (
    { tournamentId: string; categoryId: string; format: 'Singles'; playerId: string } |
    { tournamentId: string; categoryId: string; format: 'Doubles'; player1Id: string; player2Id: string }
  )
  const entriesCol = db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId).collection('entries')
  // Prevent duplicates: same player (singles) or same pair (doubles)
  if (payload.format === 'Singles') {
    const dup = await entriesCol.where('format', '==', 'Singles').where('playerId', '==', (payload as any).playerId).limit(1).get()
    if (!dup.empty) throw new Error('Player already entered in this category')
  } else {
    const { player1Id, player2Id } = payload as any
    const dup = await entriesCol
      .where('format','==','Doubles')
      .where('player1Id','in',[player1Id, player2Id])
      .get()
    const exists = dup.docs.some(d => {
      const e = d.data() as any
      const a = e.player1Id, b = e.player2Id
      return (a === player1Id && b === player2Id) || (a === player2Id && b === player1Id)
    })
    if (exists) throw new Error('Pair already entered in this category')
  }

  // Category requirements: age range and gender
  const catRef = db.collection('tournaments').doc((payload as any).tournamentId).collection('categories').doc((payload as any).categoryId)
  const catSnap = await catRef.get()
  const cat = catSnap.data() as Record<string, any> | undefined
  if (!cat) throw new Error('Category not found')

  async function assertPlayerMeets(playerId: string) {
    const pSnap = await db.collection('tournaments').doc((payload as any).tournamentId).collection('players').doc(playerId).get()
  const p = pSnap.data() as Record<string, any> | undefined
    if (!p) throw new Error('Player not found')
    // Gender check (if category not Open)
  if (cat?.gender && cat.gender !== 'Open' && p.gender && p.gender !== cat.gender) {
      throw new Error('Player gender does not match category')
    }
    // Age check if dob is present
  if (cat && (typeof cat.minAge === 'number' || typeof cat.maxAge === 'number') && p.dob) {
      const today = new Date()
      const dob = new Date(p.dob)
      let age = today.getFullYear() - dob.getFullYear()
      const m = today.getMonth() - dob.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
      if (typeof cat.minAge === 'number' && age < cat.minAge) throw new Error('Player is below minimum age')
      if (typeof cat.maxAge === 'number' && age > cat.maxAge) throw new Error('Player is above maximum age')
    }
  }

  if (payload.format === 'Singles') await assertPlayerMeets((payload as any).playerId)
  else { const { player1Id, player2Id } = (payload as any); await Promise.all([assertPlayerMeets(player1Id), assertPlayerMeets(player2Id)]) }
  let doc: any = { createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null }
  if (payload.format === 'Singles') doc = { ...doc, format: 'Singles', playerId: (payload as any).playerId }
  else doc = { ...doc, format: 'Doubles', player1Id: (payload as any).player1Id, player2Id: (payload as any).player2Id }
  const ref = await entriesCol.add(doc)
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: (payload as any).tournamentId, categoryId: (payload as any).categoryId, entryId: ref.id } })
}

export const deleteEntry: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; categoryId: string; entryId: string }
  await db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId).collection('entries').doc(payload.entryId).delete()
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, categoryId: payload.categoryId, entryId: payload.entryId, action: 'deleted' } })
}
