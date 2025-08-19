import * as functions from "firebase-functions/v1";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { isTournamentCreate, isTournamentDelete, isTournamentAddEvent, EventDoc } from "../../../shared/events";

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
      if (isTournamentCreate(data)) {
        const payload = data.eventPayload as { type: "Badminton"; name: string };
        const tournament = {
          name: payload.name ?? "Untitled",
          type: payload.type,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: data.callerUid ?? null,
          status: "active",
        };
        const tRef = await db.collection("tournaments").add(tournament);
        await snap.ref.update({
          status: "processed",
          processedAt: FieldValue.serverTimestamp(),
          result: { tournamentId: tRef.id },
        });
        return;
      }

      if (isTournamentDelete(data)) {
        const payload = data.eventPayload as { tournamentId: string }
        const tRef = db.collection('tournaments').doc(payload.tournamentId)
        await tRef.update({
          status: 'deleted',
          deletedAt: FieldValue.serverTimestamp(),
          deletedBy: data.callerUid ?? null,
        })
        await snap.ref.update({
          status: 'processed',
          processedAt: FieldValue.serverTimestamp(),
          result: { tournamentId: payload.tournamentId, action: 'deleted' },
        })
        return;
      }

      if (isTournamentAddEvent(data)) {
        const payload = data.eventPayload as { tournamentId: string; title: string; notes?: string }
        const ev = {
          title: payload.title,
          notes: payload.notes ?? null,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: data.callerUid ?? null,
        }
        const evRef = await db.collection('tournaments').doc(payload.tournamentId).collection('events').add(ev)
        await snap.ref.update({
          status: 'processed',
          processedAt: FieldValue.serverTimestamp(),
          result: { tournamentId: payload.tournamentId, eventId: evRef.id },
        })
        return;
      }

      await snap.ref.update({
        status: "ignored",
        processedAt: FieldValue.serverTimestamp(),
        reason: "Unknown event",
      });
    } catch (err: any) {
      await snap.ref.update({
        status: "error",
        processedAt: FieldValue.serverTimestamp(),
        error: err?.message ?? String(err),
      });
      throw err;
    }
  });
