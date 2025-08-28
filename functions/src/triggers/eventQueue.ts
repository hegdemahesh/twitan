import * as functions from "firebase-functions/v1";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { EventDoc, EventNames, EventTypes } from "../../../shared/events";
import { Handler } from '../handlers/types'
import { createTournament, deleteTournament } from '../handlers/tournament/lifecycle'
import { addEventNote } from '../handlers/tournament/notes'
import { addCategories, deleteCategory, updateCategory } from '../handlers/tournament/categories'
import { addPlayer, addPlayerByPhone, addRoleByPhone, deleteRole } from '../handlers/tournament/people'
import { addEntry, deleteEntry } from '../handlers/tournament/entries'
import { createBracketFromCategory, updateMatchScore } from '../handlers/tournament/brackets'

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
      if (data.eventType !== EventTypes.Tournament) {
        await snap.ref.update({ status: 'ignored', processedAt: FieldValue.serverTimestamp(), reason: 'Unsupported eventType' })
        return
      }

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
      }

      const handler = registry[data.eventName]
      if (handler) {
        await handler({ db, snap, data })
        return
      }
      await snap.ref.update({ status: 'ignored', processedAt: FieldValue.serverTimestamp(), reason: 'Unknown event' })
      return
    } catch (err: any) {
      await snap.ref.update({ status: 'error', processedAt: FieldValue.serverTimestamp(), error: err?.message ?? String(err) })
      throw err
    }
  })
