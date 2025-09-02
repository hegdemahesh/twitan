import React from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db, httpsCallable, functions } from '../lib/firebase'
import { FiCheck } from 'react-icons/fi'
import { labelForEntryWithLists } from '../utils/entries'
import { EventNames, EventTypes } from '../../../shared/events'

export type CategoryFormat = 'Singles' | 'Doubles'

export function Bracket({
  tournamentId,
  bracket,
  players,
  onOpenScore,
  onShuffle,
  onFinalizeToggle,
  onDelete
}: Readonly<{
  tournamentId: string
  bracket: { id: string; name: string; categoryId: string; format: CategoryFormat; status: string; finalized?: boolean }
  players: Array<{ id: string; name?: string }>
  onOpenScore: (matchId: string, scores: Array<{ a: number; b: number }>, status: 'in-progress' | 'completed') => void
  onShuffle?: () => void
  onFinalizeToggle?: (finalized: boolean) => void
  onDelete?: () => void
}>) {
  const [matches, setMatches] = React.useState<Array<{ id: string; round: number; order: number; participantA?: any; participantB?: any; scores: Array<{ a: number; b: number }>; status: string; nextMatchId?: string | null }>>([])
  const [entries, setEntries] = React.useState<Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>>([])

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const matchRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const [lines, setLines] = React.useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([])
  const [matchOffsets, setMatchOffsets] = React.useState<Record<string, number>>({})
  const measureRaf = React.useRef<number | null>(null)
  const drawRaf = React.useRef<number | null>(null)
  const roRef = React.useRef<ResizeObserver | null>(null)
  const debounceTimer = React.useRef<number | null>(null)
  const measurePassRef = React.useRef<number>(0)
  const labelRefs = React.useRef<Record<number, HTMLDivElement | null>>({})
  const [labelHeights, setLabelHeights] = React.useState<Record<number, number>>({})
  const visRaf = React.useRef<number | null>(null)
  const ioMeasureRef = React.useRef<IntersectionObserver | null>(null)
  const ioDrawRef = React.useRef<IntersectionObserver | null>(null)

  function isVisible() {
    const el = containerRef.current
    if (!el) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }
  function whenVisible(fn: () => void) {
    let tries = 0
    const loop = () => {
      if (isVisible()) { fn(); return }
      if (tries++ < 20) { visRaf.current = requestAnimationFrame(loop) }
    }
    loop()
  }
  const [editModal, setEditModal] = React.useState<null | { matchId: string; a?: string; b?: string; clearScores: boolean }>(null)
  const [manageSeeds, setManageSeeds] = React.useState<null | { slots: string[] }>(null)

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments', tournamentId, 'brackets', bracket.id, 'matches'), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    const unsubEntries = onSnapshot(collection(db, 'tournaments', tournamentId, 'categories', bracket.categoryId, 'entries'), (snap) => setEntries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
    return () => { unsub(); unsubEntries() }
  }, [tournamentId, bracket.id])

  // Phase 1: measure vertical offsets
  React.useEffect(() => {
    const measureOffsets = () => {
      const c = containerRef.current
      if (!c || matches.length === 0) return
  const cRect = c.getBoundingClientRect()
  
      const offsets: Record<string, number> = {}
      for (const m of matches) {
        if (!(m as any).round || (m as any).round <= 1) continue
        const children = matches.filter(x => x.nextMatchId === m.id)
        if (children.length < 2) continue
        const childEls = children.map(ch => matchRefs.current[ch.id]).filter(Boolean) as HTMLDivElement[]
        const parentEl = matchRefs.current[m.id]
        if (childEls.length < 2 || !parentEl) continue
        const a = childEls[0].getBoundingClientRect(); const b = childEls[1].getBoundingClientRect()
        const p = parentEl.getBoundingClientRect()
        const childCenterY = ((a.top + a.height / 2) + (b.top + b.height / 2)) / 2 - cRect.top
        const parentCenterY = (p.top + p.height / 2) - cRect.top
        const delta = childCenterY - parentCenterY
        if (Math.abs(delta) > 0.5) offsets[m.id] = delta
      }
      const prev = matchOffsets
      const changed = Object.keys(offsets).length !== Object.keys(prev).length || Object.entries(offsets).some(([k,v]) => prev[k] !== v)
      if (changed) {
        const distinctRounds = new Set(matches.map(m => m.round)).size
        const maxPasses = Math.max(3, distinctRounds)
        if (measurePassRef.current < maxPasses) {
          measurePassRef.current += 1
          setMatchOffsets(offsets)
        }
      } else {
        measurePassRef.current = 0
      }
    }
    if (measureRaf.current) cancelAnimationFrame(measureRaf.current)
    whenVisible(() => {
      measureRaf.current = requestAnimationFrame(() => {
        measureRaf.current = requestAnimationFrame(() => measureOffsets())
      })
    })
    // Also observe visibility; when it becomes visible, re-measure
    const c = containerRef.current
    if (c && 'IntersectionObserver' in window) {
      ioMeasureRef.current = new IntersectionObserver((entries) => {
        const e = entries[0]
        if (e?.isIntersecting) {
          if (measureRaf.current) cancelAnimationFrame(measureRaf.current)
          measureRaf.current = requestAnimationFrame(() => {
            measureRaf.current = requestAnimationFrame(() => measureOffsets())
          })
        }
      }, { threshold: 0 })
      ioMeasureRef.current.observe(c)
    }
    return () => {
      if (measureRaf.current) cancelAnimationFrame(measureRaf.current)
      if (ioMeasureRef.current) { ioMeasureRef.current.disconnect(); ioMeasureRef.current = null }
    }
  }, [matches, matchOffsets, labelHeights])

  // Phase 2: draw connectors after transforms
  React.useEffect(() => {
    const drawLines = () => {
      const c = containerRef.current
      if (!c) return
      const cRect = c.getBoundingClientRect()
      const ln: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
      for (const m of matches) {
        const fromEl = matchRefs.current[m.id]
        const nextId = (m as any).nextMatchId as string | undefined
        if (!fromEl || !nextId) continue
        const toEl = matchRefs.current[nextId]
        if (!toEl) continue
        const a = fromEl.getBoundingClientRect()
        const b = toEl.getBoundingClientRect()
  const x1 = a.right - cRect.left
  const y1 = (a.top + a.height / 2 - cRect.top)
  const x2 = b.left - cRect.left
  const y2 = (b.top + b.height / 2 - cRect.top)
        ln.push({ x1, y1, x2, y2 })
      }
      setLines(ln)
    }
    const scheduleDraw = () => {
      if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
      debounceTimer.current = window.setTimeout(() => {
        if (drawRaf.current) cancelAnimationFrame(drawRaf.current)
        whenVisible(() => {
          drawRaf.current = requestAnimationFrame(() => { drawRaf.current = requestAnimationFrame(() => drawLines()) })
        })
      }, 30)
    }
    scheduleDraw()
    if (containerRef.current && 'ResizeObserver' in window) {
      roRef.current = new ResizeObserver(() => scheduleDraw())
      roRef.current.observe(containerRef.current)
    }
    // Observe visibility to redraw after panel is shown
    if (containerRef.current && 'IntersectionObserver' in window) {
      ioDrawRef.current = new IntersectionObserver((entries) => {
        const e = entries[0]
        if (e && e.isIntersecting) scheduleDraw()
      }, { threshold: 0 })
      ioDrawRef.current.observe(containerRef.current)
    }
    const localScrollEl = containerRef.current?.parentElement
    let ticking = false
    const onAnyScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { drawLines(); ticking = false })
    }
    localScrollEl?.addEventListener('scroll', onAnyScroll, { passive: true })
    window.addEventListener('scroll', onAnyScroll, { passive: true })
    return () => {
      if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
      if (drawRaf.current) cancelAnimationFrame(drawRaf.current)
      if (roRef.current) roRef.current.disconnect()
  if (ioDrawRef.current) { ioDrawRef.current.disconnect(); ioDrawRef.current = null }
      localScrollEl?.removeEventListener('scroll', onAnyScroll)
      window.removeEventListener('scroll', onAnyScroll)
    }
  }, [matches, matchOffsets, labelHeights])

  // Reset when layout-affecting data changes
  const layoutKey = React.useMemo(() => {
    return matches
      .map(m => `${m.id}:${m.participantA?.entryId || ''}|${m.participantB?.entryId || ''}|${(m.scores||[]).map(s=>`${s.a}-${s.b}`).join('_')}`)
      .join(';')
  }, [matches])
  React.useEffect(() => { setMatchOffsets({}); setLines([]); measurePassRef.current = 0 }, [layoutKey])

  // Measure round label heights and add matching padding so matches never overlap labels
  

  // helpers
  const grouped = matches.reduce((acc: Record<number, Array<any>>, m) => { const arr = acc[m.round] || []; arr.push(m); acc[m.round] = arr; return acc }, {})
  const rounds = Object.keys(grouped).map(n => Number(n)).sort((a,b) => a-b)
  function roundLabel(r: number) {
    const last = rounds[rounds.length - 1]
    const lastButOne = rounds[rounds.length - 2]
    const lastButTwo = rounds[rounds.length - 3]
    if (r === last) return 'Finals'
    if (r === lastButOne) return 'Semi Finals'
    if (r === lastButTwo) return 'Quarter Finals'
    return `Round ${r}`
  }
  function matchStatusClass(status: string) {
    if (status === 'completed') return 'bg-success/15 border-success/40'
    if (status === 'in-progress') return 'bg-warning/15 border-warning/40'
    return 'bg-base-100 border-base-300/60'
  }

  // Measure round label heights and add matching padding so matches never overlap labels
  React.useEffect(() => {
    const update = () => {
      const next: Record<number, number> = {}
      for (const r of rounds) {
        const el = labelRefs.current[r]
        if (el) {
          const h = el.getBoundingClientRect().height
          // add small breathing room below the label
          next[r] = Math.ceil(h + 8)
        }
      }
      const changed = Object.keys(next).length !== Object.keys(labelHeights).length || Object.entries(next).some(([k,v]) => labelHeights[Number(k)] !== v)
      if (changed) setLabelHeights(next)
    }
    update()
    const onResize = () => update()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [rounds, labelHeights])

  return (
    <li className="p-3 rounded bg-base-200">
      <div className="font-medium mb-2 flex items-center justify-between">
        <span>{bracket.name} <span className="badge ml-2">{bracket.status}</span>{bracket.finalized ? <span className="badge badge-outline ml-2">Finalized</span> : null}</span>
        <div className="flex items-center gap-2">
          {onShuffle && <button className="btn btn-ghost btn-xs" onClick={onShuffle} disabled={!!bracket.finalized}>Shuffle</button>}
          <button className="btn btn-ghost btn-xs" disabled={!!bracket.finalized} onClick={() => {
            const fr = [...matches].filter((m:any)=>m.round===1).sort((a:any,b:any)=> (a.order||0)-(b.order||0))
            const init: string[] = []
            for (const m of fr) { init.push(m.participantA?.entryId || ''); init.push(m.participantB?.entryId || '') }
            setManageSeeds({ slots: init })
          }}>Manage seeding</button>
          {onFinalizeToggle && (bracket.finalized ? (
            <button className="btn btn-xs" onClick={() => onFinalizeToggle(false)}>Unlock</button>
          ) : (
            <button className="btn btn-xs" onClick={() => onFinalizeToggle(true)}>Lock</button>
          ))}
          {onDelete && <button className="btn btn-ghost btn-xs" onClick={onDelete}>Delete</button>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div ref={containerRef} className="relative w-max">
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
            {lines.map((l) => {
              const midX = (l.x1 + l.x2) / 2
              const d = `M ${l.x1} ${l.y1} H ${midX} V ${l.y2} H ${l.x2}`
              const key = `${l.x1},${l.y1}->${l.x2},${l.y2}`
              return <path key={key} d={d} stroke="currentColor" className="text-secondary/60" strokeWidth={3} fill="none" />
            })}
          </svg>
          <div className="flex gap-6">
      {rounds.map(r => (
              <div key={r} className="min-w-[240px] relative z-10">
        <div ref={(el)=>{ labelRefs.current[r] = el }} className="gradient-label absolute top-0 left-0 z-20 pointer-events-none">{roundLabel(r)}</div>
        <div className="flex flex-col gap-4" style={{ paddingTop: (labelHeights[r] ?? 32) }}>
                {(() => { const arr = [...grouped[r]]; arr.sort((a:any,b:any)=>a.order-b.order); return arr })().map((m:any) => (
                  <div key={m.id} ref={(el) => { matchRefs.current[m.id] = el }} style={{ transform: `translateY(${(matchOffsets[m.id]||0)}px)`, willChange: 'transform' }} className={`relative z-10 p-2 rounded text-sm flex justify-between items-center border soft-ring ${matchStatusClass(m.status)}`}>
                    <div>
                      <div className={`flex items-center gap-1 ${m.winner === 'A' ? 'text-success font-medium' : ''}`}>
                        <span>A: {labelForEntryWithLists(entries, players, m.participantA?.entryId)}</span>
                        {m.winner === 'A' && <FiCheck />}
                      </div>
                      <div className={`flex items-center gap-1 ${m.winner === 'B' ? 'text-success font-medium' : ''}`}>
                        <span>B: {labelForEntryWithLists(entries, players, m.participantB?.entryId)}</span>
                        {m.winner === 'B' && <FiCheck />}
                      </div>
                      {((!m.participantA && m.participantB) || (m.participantA && !m.participantB)) && (
                        <div className="badge badge-ghost badge-sm mt-1">BYE</div>
                      )}
                      <div className="text-xs opacity-70">{(m.scores || []).map((s:any)=>`[${s.a}-${s.b}]`).join(' ')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-xs" onClick={() => onOpenScore(m.id, m.scores ?? [], m.status === 'completed' ? 'completed' : 'in-progress')}>Score</button>
                      {m.round === 1 && (
                        <button className="btn btn-ghost btn-xs" disabled={!!bracket.finalized} onClick={() => setEditModal({ matchId: m.id, a: m.participantA?.entryId, b: m.participantB?.entryId, clearScores: true })}>Edit</button>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Modals: Reuse existing flows via events */}
      {editModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Edit participants</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <EntrySelect entries={entries} players={players} value={editModal.a} onChange={(v)=> setEditModal(m => m ? ({ ...m, a: v || undefined }) : m)} label="Participant A" />
              <EntrySelect entries={entries} players={players} value={editModal.b} onChange={(v)=> setEditModal(m => m ? ({ ...m, b: v || undefined }) : m)} label="Participant B" />
            </div>
            <div className="mt-3">
              <label className="label cursor-pointer gap-2">
                <span className="label-text">Clear existing scores</span>
                <input type="checkbox" className="toggle" checked={editModal.clearScores} onChange={(e)=> setEditModal(m => m ? ({ ...m, clearScores: e.target.checked }) : m)} />
              </label>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setEditModal(null)}>Close</button>
              <button className="btn btn-primary" disabled={!!bracket.finalized} onClick={async () => {
                if (!editModal) return
                if (editModal.a && editModal.b && editModal.a === editModal.b) { alert('A and B cannot be the same entry.'); return }
                const call = httpsCallable(functions, 'addEvent')
                const fr = [...matches].filter((m:any)=>m.round===1)
                const tasks: Promise<any>[] = []
                for (const m of fr) {
                  if (m.id === editModal.matchId) continue
                  const patch: any = { tournamentId, bracketId: bracket.id, matchId: m.id }
                  let needs = false
                  if (editModal.a && m.participantA?.entryId === editModal.a) { patch.participantAEntryId = null; needs = true }
                  if (editModal.a && m.participantB?.entryId === editModal.a) { patch.participantBEntryId = null; needs = true }
                  if (editModal.b && m.participantA?.entryId === editModal.b) { patch.participantAEntryId = null; needs = true }
                  if (editModal.b && m.participantB?.entryId === editModal.b) { patch.participantBEntryId = null; needs = true }
                  if (needs) tasks.push(call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.UpdateMatchParticipants, eventPayload: patch }))
                }
                if (tasks.length) await Promise.all(tasks)
                await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.UpdateMatchParticipants, eventPayload: { tournamentId, bracketId: bracket.id, matchId: editModal.matchId, participantAEntryId: editModal.a || null, participantBEntryId: editModal.b || null, clearScores: !!editModal.clearScores } })
                setEditModal(null)
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {manageSeeds && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Manage seeding (first round)</h3>
            <div className="mt-3 space-y-3">
              {(() => {
                const fr = [...matches].filter((m:any)=>m.round===1).sort((a:any,b:any)=> (a.order||0)-(b.order||0))
                const allIds = entries.map(e=>e.id)
                function setSlot(idx: number, val: string) {
                  setManageSeeds(state => {
                    if (!state) return state
                    const slots = [...state.slots]
                    if (val) { for (let i=0;i<slots.length;i++) { if (i!==idx && slots[i]===val) slots[i]='' } }
                    slots[idx] = val
                    return { slots }
                  })
                }
                function optionsFor(idx: number) {
                  const current = manageSeeds?.slots || []
                  const chosen = new Set(current.filter((v, i) => v && i!==idx))
                  return allIds.filter(id => !chosen.has(id))
                }
                function autoFill() {
                  setManageSeeds(state => {
                    if (!state) return state
                    const used = new Set(state.slots.filter(Boolean))
                    const remaining = allIds.filter(id => !used.has(id))
                    const slots = [...state.slots]
                    for (let i=0;i<slots.length;i++) { if (!slots[i] && remaining.length) slots[i] = remaining.shift() as string }
                    return { slots }
                  })
                }
                return (
                  <>
                    <div className="text-xs opacity-70">Select entries for each slot. Duplicate selections are automatically removed from other slots. Use Auto-fill to fill the rest.</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fr.map((m:any, mi:number) => (
                        <div key={m.id} className="p-2 rounded bg-base-100 border border-base-200">
                          <div className="font-medium mb-2">Match {m.order}</div>
                          <div className="space-y-2">
                            <div>
                              <label className="label text-xs" htmlFor={`seed-a-${mi}`}>Participant A</label>
                              <select id={`seed-a-${mi}`} className="select select-bordered w-full" value={manageSeeds.slots[mi*2]}
                                onChange={(e)=> setSlot(mi*2, e.target.value)}>
                                <option value="">— Clear —</option>
                                {optionsFor(mi*2).map(id => (
                                  <option key={id} value={id}>{labelForEntryWithLists(entries, players, id)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs" htmlFor={`seed-b-${mi}`}>Participant B</label>
                              <select id={`seed-b-${mi}`} className="select select-bordered w-full" value={manageSeeds.slots[mi*2+1]}
                                onChange={(e)=> setSlot(mi*2+1, e.target.value)}>
                                <option value="">— Clear —</option>
                                {optionsFor(mi*2+1).map(id => (
                                  <option key={id} value={id}>{labelForEntryWithLists(entries, players, id)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-sm" type="button" onClick={autoFill}>Auto-fill remaining</button>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setManageSeeds(null)}>Close</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!manageSeeds) return
                const orderedEntryIds = manageSeeds.slots.filter(Boolean)
                const call = httpsCallable(functions, 'addEvent')
                await call({ eventType: EventTypes.Tournament, eventName: EventNames.Tournament.ReseedBracket, eventPayload: { tournamentId, bracketId: bracket.id, strategy: 'ordered', orderedEntryIds } })
                setManageSeeds(null)
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function EntrySelect({ entries, players, value, onChange, label }: Readonly<{ entries: Array<{ id: string; playerId?: string; player1Id?: string; player2Id?: string }>; players: Array<{ id: string; name?: string }>; value?: string; onChange: (v: string) => void; label: string }>) {
  const opts = entries
  return (
    <div className="space-y-1">
      <label className="label text-xs">{label}</label>
      <select className="select select-bordered w-full" value={value ?? ''} onChange={(e)=> onChange(e.target.value)}>
        <option value="">— Clear —</option>
        {opts.map(e => (
          <option key={e.id} value={e.id}>{labelForEntryWithLists(entries, players, e.id)}</option>
        ))}
      </select>
    </div>
  )
}
