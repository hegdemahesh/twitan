import { FieldValue } from 'firebase-admin/firestore'
import { Handler } from '../types'

export const createTournament: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { type: 'Badminton'; name: string }
  const tournament = {
    name: payload.name ?? 'Untitled',
    type: payload.type,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: data.callerUid ?? null,
    status: 'active',
  }
  const tRef = await db.collection('tournaments').add(tournament)
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: tRef.id } })
}

export const deleteTournament: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string }
  await db.collection('tournaments').doc(payload.tournamentId).update({ status: 'deleted', deletedAt: FieldValue.serverTimestamp(), deletedBy: data.callerUid ?? null })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, action: 'deleted' } })
}
