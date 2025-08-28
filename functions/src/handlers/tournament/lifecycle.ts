import { FieldValue } from 'firebase-admin/firestore'
import { Handler } from '../types'

export const createTournament: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { type: 'Badminton'; name: string; startDate?: string | null; endDate?: string | null }
  // Default dates: today and tomorrow (in ISO yyyy-mm-dd)
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const startDate = (payload.startDate?.trim() || today.toISOString().slice(0, 10))
  const endDate = (payload.endDate?.trim() || tomorrow.toISOString().slice(0, 10))
  const tournament = {
    name: payload.name ?? 'Untitled',
    type: payload.type,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: data.callerUid ?? null,
    status: 'active',
    startDate,
    endDate,
  }
  const tRef = await db.collection('tournaments').add(tournament)
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: tRef.id } })
}

export const deleteTournament: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string }
  await db.collection('tournaments').doc(payload.tournamentId).update({ status: 'deleted', deletedAt: FieldValue.serverTimestamp(), deletedBy: data.callerUid ?? null })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, action: 'deleted' } })
}
