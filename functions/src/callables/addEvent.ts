import * as functions from "firebase-functions/v1";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type AddEventRequest = {
  eventType: string;
  eventName: string;
  eventPayload: unknown;
};

export const addEvent = functions
  .region("us-central1")
  .https.onCall(async (data: Partial<AddEventRequest>, context) => {
    const { eventType, eventName, eventPayload } = data ?? {};

    if (!eventType || !eventName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: eventType and eventName"
      );
    }

    const db = getFirestore();
    const doc = {
      eventType,
      eventName,
      eventPayload: eventPayload ?? null,
      status: "queued",
      createdAt: FieldValue.serverTimestamp(),
      callerUid: context.auth?.uid ?? null,
    };

    const ref = await db.collection("eventQue").add(doc);
    return { id: ref.id, ok: true };
  });
