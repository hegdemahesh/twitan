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
  },
} as const

export type EventType = typeof EventTypes[keyof typeof EventTypes]
export type TournamentEventName = typeof EventNames.Tournament[keyof typeof EventNames.Tournament]

export type EventPayloadMap = {
  [EventTypes.Tournament]: {
    [EventNames.Tournament.CreateBadmintonTournament]: {
      type: 'Badminton'
      name: string
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
