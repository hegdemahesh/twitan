export const EventTypes = {
  Tournament: 'tournament',
  User: 'user',
} as const

export const EventNames = {
  Tournament: {
    CreateBadmintonTournament: 'createBadmintonTournament',
  DeleteTournament: 'deleteTournament',
  AddTournamentEvent: 'addTournamentEvent',
  AddTournamentCategories: 'addTournamentCategories',
  DeleteTournamentCategory: 'deleteTournamentCategory',
  UpdateTournamentCategory: 'updateTournamentCategory',
  AddPlayer: 'addPlayer',
  AddEntry: 'addEntry',
  DeleteEntry: 'deleteEntry',
  AddTournamentRoleByPhone: 'addTournamentRoleByPhone',
  DeleteTournamentRole: 'deleteTournamentRole',
  AddPlayerByPhone: 'addPlayerByPhone',
  CreateBracketFromCategory: 'createBracketFromCategory',
  UpdateMatchScore: 'updateMatchScore',
  // Round robin (group stage)
  CreateRoundRobin: 'createRoundRobin',
  UpdateRoundRobinMatch: 'updateRoundRobinMatch',
  FinalizeRoundRobinToBracket: 'finalizeRoundRobinToBracket',
  DeleteBracket: 'deleteBracket',
  DeleteRoundRobinGroup: 'deleteRoundRobinGroup',
  // Bracket management
  ReseedBracket: 'reseedBracket',
  UpdateMatchParticipants: 'updateMatchParticipants',
  SetBracketFinalized: 'setBracketFinalized',
  },
  User: {
    UpdateProfile: 'updateProfile',
    UpdateProfilePhoto: 'updateProfilePhoto',
  },
} as const

export type EventType = typeof EventTypes[keyof typeof EventTypes]
export type TournamentEventName = typeof EventNames.Tournament[keyof typeof EventNames.Tournament]
export type UserEventName = typeof EventNames.User[keyof typeof EventNames.User]

export type EventPayloadMap = {
  [EventTypes.Tournament]: {
    [EventNames.Tournament.CreateBadmintonTournament]: {
      type: 'Badminton'
  name: string
  startDate?: string | null // yyyy-mm-dd
  endDate?: string | null   // yyyy-mm-dd
    }
    [EventNames.Tournament.DeleteTournament]: {
      tournamentId: string
    }
    [EventNames.Tournament.AddTournamentEvent]: {
      tournamentId: string
      title: string
      notes?: string
    }
    [EventNames.Tournament.AddTournamentCategories]: {
      tournamentId: string
      categories: Array<{
        name: string
        minAge?: number
        maxAge?: number
        gender: 'Male' | 'Female' | 'Open'
        format: 'Singles' | 'Doubles'
      }>
    }
    [EventNames.Tournament.DeleteTournamentCategory]: {
      tournamentId: string
      categoryId: string
    }
    [EventNames.Tournament.UpdateTournamentCategory]: {
      tournamentId: string
      categoryId: string
      patch: {
        name?: string
        minAge?: number | null
        maxAge?: number | null
        gender?: 'Male' | 'Female' | 'Open'
        format?: 'Singles' | 'Doubles'
      }
    }
  [EventNames.Tournament.AddPlayer]: {
      tournamentId: string
      player: {
        name: string
        dob: string // ISO date string
        gender: 'Male' | 'Female' | 'Other'
    phoneNumber?: string | null
  city?: string | null
      }
    }
    [EventNames.Tournament.AddEntry]: (
      | {
          tournamentId: string
          categoryId: string
          format: 'Singles'
          playerId: string
        }
      | {
          tournamentId: string
          categoryId: string
          format: 'Doubles'
          player1Id: string
          player2Id: string
        }
    )
    [EventNames.Tournament.DeleteEntry]: {
      tournamentId: string
      categoryId: string
      entryId: string
    }
    [EventNames.Tournament.AddTournamentRoleByPhone]: {
      tournamentId: string
      role: 'admin' | 'scorer'
      phoneNumber: string // E.164
    }
    [EventNames.Tournament.DeleteTournamentRole]: {
      tournamentId: string
      roleId: string
    }
    [EventNames.Tournament.AddPlayerByPhone]: {
      tournamentId: string
      phoneNumber: string
      name?: string
      dob?: string
      gender?: 'Male' | 'Female' | 'Other'
  city?: string
    }
    [EventNames.Tournament.CreateBracketFromCategory]: {
      tournamentId: string
      categoryId: string
      bracketName?: string
    }
    [EventNames.Tournament.ReseedBracket]: {
      tournamentId: string
      bracketId: string
      orderedEntryIds?: string[] // left-to-right A/B pairs by first round order
      strategy?: 'shuffle' | 'ordered'
      force?: boolean
    }
    [EventNames.Tournament.UpdateMatchScore]: {
      tournamentId: string
      bracketId: string
      matchId: string
      scores: Array<{ a: number; b: number }>
      status: 'in-progress' | 'completed'
  winner?: 'A' | 'B' | null
    }
    [EventNames.Tournament.UpdateMatchParticipants]: {
      tournamentId: string
      bracketId: string
      matchId: string
      participantAEntryId?: string | null
      participantBEntryId?: string | null
      clearScores?: boolean
      force?: boolean
    }
    [EventNames.Tournament.SetBracketFinalized]: {
      tournamentId: string
      bracketId: string
      finalized: boolean
    }
    // Round robin payloads
    [EventNames.Tournament.CreateRoundRobin]: {
      tournamentId: string
      categoryId: string
      groupName?: string
    }
    [EventNames.Tournament.UpdateRoundRobinMatch]: {
      tournamentId: string
      groupId: string
      matchId: string
      scoreA: number
      scoreB: number
      status: 'in-progress' | 'completed'
    }
    [EventNames.Tournament.FinalizeRoundRobinToBracket]: {
      tournamentId: string
      groupId: string
      topN: number // how many to advance to bracket
    }
    [EventNames.Tournament.DeleteBracket]: {
      tournamentId: string
      bracketId: string
    }
    [EventNames.Tournament.DeleteRoundRobinGroup]: {
      tournamentId: string
      groupId: string
    }
  }
  [EventTypes.User]: {
    [EventNames.User.UpdateProfile]: {
      name: string
      dob: string
      gender: 'Male' | 'Female' | 'Other'
      phoneNumber?: string | null
    }
    [EventNames.User.UpdateProfilePhoto]: {
      photoURL: string
    }
  }
}

export interface EventDoc<T extends EventType = EventType, N extends string = TournamentEventName | UserEventName> {
  eventType: T
  eventName: N
  eventPayload: any
  status?: 'queued' | 'processed' | 'ignored' | 'error'
  createdAt?: unknown
  callerUid?: string | null
}

export function isTournamentCreate(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.CreateBadmintonTournament> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.CreateBadmintonTournament
  )
}

export function isTournamentDelete(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.DeleteTournament> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.DeleteTournament
  )
}

export function isTournamentAddEvent(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.AddTournamentEvent> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.AddTournamentEvent
  )
}

export function isTournamentAddCategories(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.AddTournamentCategories> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.AddTournamentCategories
  )
}

export function isTournamentDeleteCategory(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.DeleteTournamentCategory> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.DeleteTournamentCategory
  )
}

export function isTournamentUpdateCategory(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.UpdateTournamentCategory> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.UpdateTournamentCategory
  )
}

export function isTournamentAddPlayer(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.AddPlayer> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.AddPlayer
  )
}

// Removed: AddTeam event and its type guard

export function isTournamentAddEntry(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.AddEntry> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.AddEntry
  )
}

export function isTournamentDeleteEntry(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.DeleteEntry> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.DeleteEntry
  )
}

export function isTournamentAddRoleByPhone(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.AddTournamentRoleByPhone> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.AddTournamentRoleByPhone
  )
}

export function isTournamentDeleteRole(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.DeleteTournamentRole> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.DeleteTournamentRole
  )
}

export function isTournamentAddPlayerByPhone(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.AddPlayerByPhone> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.AddPlayerByPhone
  )
}

export function isTournamentCreateBracket(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.CreateBracketFromCategory> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.CreateBracketFromCategory
  )
}

export function isTournamentUpdateMatchScore(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.UpdateMatchScore> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.UpdateMatchScore
  )
}

// User event type guards
export function isUserUpdateProfile(e: EventDoc): e is EventDoc<typeof EventTypes.User, typeof EventNames.User.UpdateProfile> {
  return e.eventType === EventTypes.User && e.eventName === EventNames.User.UpdateProfile
}
export function isUserUpdateProfilePhoto(e: EventDoc): e is EventDoc<typeof EventTypes.User, typeof EventNames.User.UpdateProfilePhoto> {
  return e.eventType === EventTypes.User && e.eventName === EventNames.User.UpdateProfilePhoto
}
