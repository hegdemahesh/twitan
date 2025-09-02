import React from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db, functions, httpsCallable } from '../lib/firebase'
import { FiCheck } from 'react-icons/fi'
import { labelForEntryWithLists } from '../utils/entries'
import { EventNames, EventTypes } from '../../../shared/events'

export function Group({
  tournamentId,
  group,
  players,
  onOpenScore,
  onFinalize
}: Readonly<{
  tournamentId: string
  group: { id: string; name: string; categoryId: string; status: string }
  players: Array<{ id: string; name?: string }>
  onOpenScore: (matchId: string, scoreA: number, scoreB: number, status: 'in-progress'|'completed') => void
  onFinalize: () => void
}>) {
  const [matches, setMatches] = React.useState<Array<{ id: string; a?: any; b?: any; scoreA: number; scoreB: number; status: string }>>([])
  const [entries, setEntries] = React.useState<Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>>([])

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments', tournamentId, 'groups', group.id, 'matches'), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    const unsubEntries = onSnapshot(collection(db, 'tournaments', tournamentId, 'categories', group.categoryId, 'entries'), (snap) => setEntries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => { unsub(); unsubEntries() }
  }, [tournamentId, group.id])

  const labelForEntry = React.useCallback((entryId?: string) => labelForEntryWithLists(entries, players, entryId), [entries, players])

  // Points table (3/1/0), goal diff, played
  const table = React.useMemo(() => {
    const pts: Record<string, { name: string; pts: number; gd: number; played: number }> = {}
    for (const m of matches) {
      const a = m.a?.entryId, b = m.b?.entryId
      if (!a || !b) continue
      const sa = Number(m.scoreA || 0), sb = Number(m.scoreB || 0)
      const aname = labelForEntry(a), bname = labelForEntry(b)
      pts[a] = pts[a] || { name: aname, pts: 0, gd: 0, played: 0 }
      pts[b] = pts[b] || { name: bname, pts: 0, gd: 0, played: 0 }
      pts[a].played++; pts[b].played++
      pts[a].gd += (sa - sb); pts[b].gd += (sb - sa)
      if (sa > sb) pts[a].pts += 3
      else if (sb > sa) pts[b].pts += 3
      else { pts[a].pts += 1; pts[b].pts += 1 }
    }
    return Object.entries(pts).map(([entryId, r]) => ({ entryId, ...r })).sort((A,B) => {
      if (B.pts !== A.pts) return B.pts - A.pts
      if (B.gd !== A.gd) return B.gd - A.gd
      return B.played - A.played
    })
  }, [matches, labelForEntry])

  return (
    <li className="p-3 rounded bg-base-200">
      <div className="flex items-center justify-between">
        <div className="font-medium">{group.name} <span className="badge ml-2">{group.status}</span></div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-xs" onClick={async () => {
            if (!confirm('Delete this round robin group and all its matches?')) return
            const call = httpsCallable(functions, 'addEvent')
            await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.DeleteRoundRobinGroup, eventPayload: { tournamentId: tournamentId, groupId: group.id } })
          }}>Delete</button>
          <button className="btn btn-xs" onClick={onFinalize}>Finalize to bracket</button>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {matches.map(m => {
          let winner: 'A'|'B'|null = null
          const sa = m.scoreA ?? 0
          const sb = m.scoreB ?? 0
          if (sa > sb) winner = 'A'
          else if (sb > sa) winner = 'B'
          let statusCls = 'bg-base-100 border-base-200'
          if (m.status === 'completed') statusCls = 'bg-success/10 border-success/30'
          else if (m.status === 'in-progress') statusCls = 'bg-warning/10 border-warning/30'
          return (
            <div key={m.id} className={`p-2 rounded text-sm flex justify-between items-center border ${statusCls}`}>
              <div>
                <div className={`flex items-center gap-1 ${winner === 'A' ? 'text-success font-medium' : ''}`}>
                  <span>A: {labelForEntry(m.a?.entryId)}</span>
                  {winner === 'A' && <FiCheck />}
                </div>
                <div className={`flex items-center gap-1 ${winner === 'B' ? 'text-success font-medium' : ''}`}>
                  <span>B: {labelForEntry(m.b?.entryId)}</span>
                  {winner === 'B' && <FiCheck />}
                </div>
                <div className="text-xs opacity-70">[{m.scoreA}-{m.scoreB}]</div>
              </div>
              <button className="btn btn-xs" onClick={() => onOpenScore(m.id, m.scoreA ?? 0, m.scoreB ?? 0, m.status === 'completed' ? 'completed' : 'in-progress')}>Score</button>
            </div>
          )
        })}
      </div>
      {table.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr><th>#</th><th>Player/Pair</th><th>P</th><th>GD</th><th>Pts</th></tr>
            </thead>
            <tbody>
              {table.map((r, idx) => (
                <tr key={r.entryId}>
                  <td>{idx+1}</td>
                  <td>{r.name}</td>
                  <td>{r.played}</td>
                  <td>{r.gd}</td>
                  <td>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  )
}
