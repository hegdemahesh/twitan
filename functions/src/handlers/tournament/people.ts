import { FieldValue } from 'firebase-admin/firestore'
import { Handler } from '../types'

export const addPlayer: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; player: { name: string; dob: string; gender: 'Male' | 'Female' | 'Other'; phoneNumber?: string | null } }
  if (!payload.player?.name || !payload.player?.dob || !payload.player?.gender) {
    throw new Error('Missing required player fields')
  }
  const ref = await db.collection('tournaments').doc(payload.tournamentId).collection('players').add({
    name: payload.player.name,
    dob: payload.player.dob,
    gender: payload.player.gender,
    phoneNumber: payload.player.phoneNumber ?? null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: data.callerUid ?? null,
  })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, playerId: ref.id } })
}

export const addPlayerByPhone: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; phoneNumber: string; name?: string; dob?: string; gender?: 'Male' | 'Female' | 'Other' }
  const ref = await db.collection('tournaments').doc(payload.tournamentId).collection('players').add({
    name: payload.name ?? null,
    dob: payload.dob ?? null,
    gender: payload.gender ?? null,
    phoneNumber: payload.phoneNumber,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: data.callerUid ?? null,
  })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, playerId: ref.id } })
}

export const addRoleByPhone: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; role: 'admin' | 'scorer'; phoneNumber: string }
  const ref = await db.collection('tournaments').doc(payload.tournamentId).collection('roles').add({
    role: payload.role,
    phoneNumber: payload.phoneNumber,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: data.callerUid ?? null,
  })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, roleId: ref.id } })
}

export const deleteRole: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; roleId: string }
  await db.collection('tournaments').doc(payload.tournamentId).collection('roles').doc(payload.roleId).delete()
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, roleId: payload.roleId, action: 'deleted' } })
}
