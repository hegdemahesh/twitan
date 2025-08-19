import * as functions from "firebase-functions/v1";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { isTournamentCreate, EventDoc } from "../../../shared/events";

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
