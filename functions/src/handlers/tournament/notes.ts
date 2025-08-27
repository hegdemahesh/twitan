import { FieldValue } from 'firebase-admin/firestore'
import { Handler } from '../types'

export const addEventNote: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; title: string; notes?: string }
  const ev = { title: payload.title, notes: payload.notes ?? null, createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null }
  const evRef = await db.collection('tournaments').doc(payload.tournamentId).collection('events').add(ev)
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, eventId: evRef.id } })
}
