import { FieldValue } from 'firebase-admin/firestore'
import { Handler } from '../types'

export const addCategories: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; categories: Array<{ name: string; minAge?: number; maxAge?: number; gender: 'Male' | 'Female' | 'Open'; format: 'Singles' | 'Doubles' }> }
  const batch = db.batch()
  const catsCol = db.collection('tournaments').doc(payload.tournamentId).collection('categories')
  for (const c of payload.categories) {
    const ref = catsCol.doc()
    batch.set(ref, { name: c.name, minAge: c.minAge ?? null, maxAge: c.maxAge ?? null, gender: c.gender, format: c.format, createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null })
  }
  await batch.commit()
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, count: payload.categories.length } })
}

export const deleteCategory: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; categoryId: string }
  await db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId).delete()
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, categoryId: payload.categoryId, action: 'deleted' } })
}

export const updateCategory: Handler = async ({ db, snap, data }) => {
  const payload = data.eventPayload as { tournamentId: string; categoryId: string; patch: { name?: string; minAge?: number | null; maxAge?: number | null; gender?: 'Male' | 'Female' | 'Open'; format?: 'Singles' | 'Doubles' } }
  const ref = db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId)
  await ref.set({ ...payload.patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: data.callerUid ?? null }, { merge: true })
  await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, categoryId: payload.categoryId, action: 'updated' } })
}
