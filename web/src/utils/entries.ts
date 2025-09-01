export type PlayerLite = { id: string; name?: string }

export function resolveName(players: Array<PlayerLite>, id?: string) {
  if (!id) return ''
  const p = players.find(p => p.id === id)
  return p?.name || id
}

export function labelForEntryWithLists(
  entries: Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>,
  players: Array<PlayerLite>,
  entryId?: string
) {
  if (!entryId) return '-'
  const e = entries.find(x => x.id === entryId)
  if (!e) return entryId
  if (e.playerId) return resolveName(players, e.playerId)
  if (e.player1Id || e.player2Id) return `${resolveName(players, e.player1Id)} & ${resolveName(players, e.player2Id)}`
  return entryId
}
