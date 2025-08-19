export const EventTypes = {
  Tournament: 'tournament',
} as const

export const EventNames = {
  Tournament: {
    CreateBadmintonTournament: 'createBadmintonTournament',
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
