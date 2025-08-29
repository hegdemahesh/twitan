import * as functions from "firebase-functions/v1";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { EventDoc, EventNames, EventTypes, isUserUpdateProfile, isUserUpdateProfilePhoto } from "../../../shared/events";
import { Handler } from '../handlers/types'
import { createTournament, deleteTournament } from '../handlers/tournament/lifecycle'
import { addEventNote } from '../handlers/tournament/notes'
import { addCategories, deleteCategory, updateCategory } from '../handlers/tournament/categories'
import { addPlayer, addPlayerByPhone, addRoleByPhone, deleteRole } from '../handlers/tournament/people'
import { addEntry, deleteEntry } from '../handlers/tournament/entries'
import { createBracketFromCategory, updateMatchScore } from '../handlers/tournament/brackets'
import { createRoundRobin, updateRoundRobinMatch, finalizeRoundRobinToBracket } from '../handlers/tournament/roundrobin'

export const onEventQueued = functions
  .region("us-central1")
  .firestore.document("eventQue/{eventId}")
  .onCreate(async (snap) => {
    const data = snap.data() as EventDoc | undefined
    const db = getFirestore()

    if (!data) {
      await snap.ref.update({ status: 'error', processedAt: FieldValue.serverTimestamp(), error: 'No data in snapshot' })
      return
    }

    try {
      if (data.eventType === EventTypes.Tournament) {
        const registry: Record<string, Handler | undefined> = {
        // Tournament lifecycle
        [EventNames.Tournament.CreateBadmintonTournament]: createTournament,
        [EventNames.Tournament.DeleteTournament]: deleteTournament,
        // Notes
        [EventNames.Tournament.AddTournamentEvent]: addEventNote,
        // Categories
        [EventNames.Tournament.AddTournamentCategories]: addCategories,
        [EventNames.Tournament.DeleteTournamentCategory]: deleteCategory,
        [EventNames.Tournament.UpdateTournamentCategory]: updateCategory,
        // People
        [EventNames.Tournament.AddPlayer]: addPlayer,
        [EventNames.Tournament.AddPlayerByPhone]: addPlayerByPhone,
        [EventNames.Tournament.AddTournamentRoleByPhone]: addRoleByPhone,
        [EventNames.Tournament.DeleteTournamentRole]: deleteRole,
        // Entries
        [EventNames.Tournament.AddEntry]: addEntry,
        [EventNames.Tournament.DeleteEntry]: deleteEntry,
  // Brackets & scoring
  [EventNames.Tournament.CreateBracketFromCategory]: createBracketFromCategory,
  [EventNames.Tournament.UpdateMatchScore]: updateMatchScore,
  // Round robin
  [EventNames.Tournament.CreateRoundRobin]: createRoundRobin,
  [EventNames.Tournament.UpdateRoundRobinMatch]: updateRoundRobinMatch,
  [EventNames.Tournament.FinalizeRoundRobinToBracket]: finalizeRoundRobinToBracket,
        }
        const handler = registry[data.eventName]
        if (handler) { await handler({ db, snap, data }); return }
        await snap.ref.update({ status: 'ignored', processedAt: FieldValue.serverTimestamp(), reason: 'Unknown event' })
        return
      }

      // Basic user profile events: write to users/{uid}
      if (data.eventType === EventTypes.User && data.callerUid) {
        const usersCol = db.collection('users')
        if (isUserUpdateProfile(data)) {
          const { name, dob, gender, phoneNumber } = data.eventPayload
          await usersCol.doc(data.callerUid).set({ name, dob, gender, phoneNumber: phoneNumber ?? null, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
          return
        }
        if (isUserUpdateProfilePhoto(data)) {
          const { photoURL } = data.eventPayload
          await usersCol.doc(data.callerUid).set({ photoURL, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
          await snap.ref.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
          return
        }
      }

      await snap.ref.update({ status: 'ignored', processedAt: FieldValue.serverTimestamp(), reason: 'Unsupported eventType' })
      return
    } catch (err: any) {
      await snap.ref.update({ status: 'error', processedAt: FieldValue.serverTimestamp(), error: err?.message ?? String(err) })
      throw err
    }
  })
