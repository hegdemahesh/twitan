export const EventTypes = {
  Tournament: 'tournament',
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
  AddTeam: 'addTeam',
  AddEntry: 'addEntry',
  DeleteEntry: 'deleteEntry',
  AddTournamentRoleByPhone: 'addTournamentRoleByPhone',
  DeleteTournamentRole: 'deleteTournamentRole',
  AddPlayerByPhone: 'addPlayerByPhone',
  CreateBracketFromCategory: 'createBracketFromCategory',
  UpdateMatchScore: 'updateMatchScore',
  },
} as const

export type EventType = typeof EventTypes[keyof typeof EventTypes]
export type TournamentEventName = typeof EventNames.Tournament[keyof typeof EventNames.Tournament]

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
      }
    }
    [EventNames.Tournament.AddTeam]: {
      tournamentId: string
      player1Id: string
      player2Id: string
      name?: string | null
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
          teamId: string
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
    }
    [EventNames.Tournament.CreateBracketFromCategory]: {
      tournamentId: string
      categoryId: string
      bracketName?: string
    }
    [EventNames.Tournament.UpdateMatchScore]: {
      tournamentId: string
      bracketId: string
      matchId: string
      scores: Array<{ a: number; b: number }>
      status: 'in-progress' | 'completed'
    }
  }
}

export interface EventDoc<T extends EventType = EventType, N extends string = TournamentEventName> {
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

export function isTournamentAddTeam(e: EventDoc): e is EventDoc<typeof EventTypes.Tournament, typeof EventNames.Tournament.AddTeam> {
  return (
    e.eventType === EventTypes.Tournament &&
    e.eventName === EventNames.Tournament.AddTeam
  )
}

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
