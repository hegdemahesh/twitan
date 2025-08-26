import * as functions from "firebase-functions/v1";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { EventDoc, EventNames, EventTypes } from "../../../shared/events";

export const onEventQueued = functions
  .region("us-central1")
  .firestore.document("eventQue/{eventId}")
  .onCreate(async (snap) => {
    const data = snap.data() as EventDoc | undefined;
    const db = getFirestore();

    if (!data) {
      await snap.ref.update({ status: "error", processedAt: FieldValue.serverTimestamp(), error: "No data in snapshot" });
      return;
    }

    try {
      if (data.eventType !== EventTypes.Tournament) {
        await snap.ref.update({ status: 'ignored', processedAt: FieldValue.serverTimestamp(), reason: 'Unsupported eventType' })
        return
      }

      switch (data.eventName) {
        case EventNames.Tournament.CreateBadmintonTournament: {
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
          return
        }
        case EventNames.Tournament.DeleteTournament: {
          const payload = data.eventPayload as { tournamentId: string }
          const tRef = db.collection('tournaments').doc(payload.tournamentId)
          await tRef.update({ status: 'deleted', deletedAt: FieldValue.serverTimestamp(), deletedBy: data.callerUid ?? null })
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, action: 'deleted' } })
          return
        }
        case EventNames.Tournament.AddTournamentEvent: {
          const payload = data.eventPayload as { tournamentId: string; title: string; notes?: string }
          const ev = { title: payload.title, notes: payload.notes ?? null, createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null }
          const evRef = await db.collection('tournaments').doc(payload.tournamentId).collection('events').add(ev)
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, eventId: evRef.id } })
          return
        }
        case EventNames.Tournament.AddTournamentCategories: {
          const payload = data.eventPayload as { tournamentId: string; categories: Array<{ name: string; minAge?: number; maxAge?: number; gender: 'Male' | 'Female' | 'Open'; format: 'Singles' | 'Doubles' }> }
          const batch = db.batch()
          const catsCol = db.collection('tournaments').doc(payload.tournamentId).collection('categories')
          for (const c of payload.categories) {
            const ref = catsCol.doc()
            batch.set(ref, { name: c.name, minAge: c.minAge ?? null, maxAge: c.maxAge ?? null, gender: c.gender, format: c.format, createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null })
          }
          await batch.commit()
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, count: payload.categories.length } })
          return
        }
        case EventNames.Tournament.DeleteTournamentCategory: {
          const payload = data.eventPayload as { tournamentId: string; categoryId: string }
          await db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId).delete()
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, categoryId: payload.categoryId, action: 'deleted' } })
          return
        }
        case EventNames.Tournament.UpdateTournamentCategory: {
          const payload = data.eventPayload as { tournamentId: string; categoryId: string; patch: { name?: string; minAge?: number | null; maxAge?: number | null; gender?: 'Male' | 'Female' | 'Open'; format?: 'Singles' | 'Doubles' } }
          const ref = db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId)
          await ref.set({ ...payload.patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: data.callerUid ?? null }, { merge: true })
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, categoryId: payload.categoryId, action: 'updated' } })
          return
        }
        case EventNames.Tournament.AddPlayer: {
          const payload = data.eventPayload as { tournamentId: string; player: { name: string; dob: string; gender: 'Male' | 'Female' | 'Other' } }
          const ref = await db.collection('tournaments').doc(payload.tournamentId).collection('players').add({ name: payload.player.name, dob: payload.player.dob, gender: payload.player.gender, createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null })
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, playerId: ref.id } })
          return
        }
        case EventNames.Tournament.AddTeam: {
          const payload = data.eventPayload as { tournamentId: string; player1Id: string; player2Id: string; name?: string | null }
          const ref = await db.collection('tournaments').doc(payload.tournamentId).collection('teams').add({ name: payload.name ?? null, player1Id: payload.player1Id, player2Id: payload.player2Id, createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null })
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, teamId: ref.id } })
          return
        }
        case EventNames.Tournament.AddEntry: {
          const payload = data.eventPayload as (
            { tournamentId: string; categoryId: string; format: 'Singles'; playerId: string } |
            { tournamentId: string; categoryId: string; format: 'Doubles'; teamId: string }
          )
          const entriesCol = db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId).collection('entries')
          let doc: any = { createdAt: FieldValue.serverTimestamp(), createdBy: data.callerUid ?? null }
          if (payload.format === 'Singles') doc = { ...doc, format: 'Singles', playerId: payload.playerId }
          else doc = { ...doc, format: 'Doubles', teamId: payload.teamId }
          const ref = await entriesCol.add(doc)
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, categoryId: payload.categoryId, entryId: ref.id } })
          return
        }
        case EventNames.Tournament.DeleteEntry: {
          const payload = data.eventPayload as { tournamentId: string; categoryId: string; entryId: string }
          await db.collection('tournaments').doc(payload.tournamentId).collection('categories').doc(payload.categoryId).collection('entries').doc(payload.entryId).delete()
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp(), result: { tournamentId: payload.tournamentId, categoryId: payload.categoryId, entryId: payload.entryId, action: 'deleted' } })
          return
        }
        default: {
          await snap.ref.update({ status: 'ignored', processedAt: FieldValue.serverTimestamp(), reason: 'Unknown event' })
          return
        }
      }
    } catch (err: any) {
      await snap.ref.update({
        status: "error",
        processedAt: FieldValue.serverTimestamp(),
        error: err?.message ?? String(err),
      });
      throw err;
    }
  });
