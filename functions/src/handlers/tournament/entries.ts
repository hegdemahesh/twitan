import { FieldValue } from 'firebase-admin/firestore'
import { Handler } from '../types'

export const addEntry: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as (
    { tournamentId: string; categoryId: string; format: 'Singles'; playerId: string } |
    { tournamentId: string; categoryId: string; format: 'Doubles'; teamId: string }
  )
  const entriesCol = db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId).collection('entries')
  let doc: any = { createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null }
  if (payload.format === 'Singles') doc = { ...doc, format: 'Singles', playerId: (payload as any).playerId }
  else doc = { ...doc, format: 'Doubles', teamId: (payload as any).teamId }
  const ref = await entriesCol.add(doc)
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: (payload as any).tournamentId, categoryId: (payload as any).categoryId, entryId: ref.id } })
}

export const deleteEntry: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; categoryId: string; entryId: string }
  await db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId).collection('entries').doc(payload.entryId).delete()
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, categoryId: payload.categoryId, entryId: payload.entryId, action: 'deleted' } })
}
