'use client'
// @comet/ui/topbar — global search, in every module (AO-2063; Michael 2026-10-24).
// Replaces Agile's GlobalSearch. Searches the whole company through
// comet_search (projects, work items, milestones, risks, changes, decisions,
// people, Scope and Scheduler records); "#42" or "42" jumps by item number.
// Ctrl+K / Cmd+K focuses it from anywhere on the page.
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isSearchableQuery, resultUrl, SEARCH_ENTITY_LABELS, SEARCH_MODULE_LABELS, type SearchResultRow } from './search'
import { SearchIcon } from './icons'

type Status = 'idle' | 'loading' | 'done' | 'error'
interface Hit { row: SearchResultRow; url: string }

export function SearchBox({ search, pathname }: { search: (q: string) => Promise<SearchResultRow[]>; pathname: string | null }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)
  const listId = useId()

  function place() {
    const r = wrapRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 360) })
  }

  // A new page starts with an empty search box (the bar itself stays mounted
  // across pages, so without this the last query would follow the person).
  useEffect(() => {
    seq.current++
    setQuery('')
    setHits([])
    setStatus('idle')
    setOpen(false)
  }, [pathname])

  // Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Debounced query; a later keystroke always wins over an earlier answer.
  useEffect(() => {
    const q = query.trim()
    if (!isSearchableQuery(q)) {
      seq.current++
      setHits([])
      setStatus('idle')
      return
    }
    const mine = ++seq.current
    setStatus('loading')
    const t = setTimeout(() => {
      search(q)
        .then((rows) => {
          if (mine !== seq.current) return
          const next: Hit[] = []
          for (const row of Array.isArray(rows) ? rows : []) {
            const url = resultUrl(row)
            if (url) next.push({ row, url })
          }
          setHits(next)
          setActive(0)
          setStatus('done')
        })
        .catch(() => {
          if (mine !== seq.current) return
          setHits([])
          setStatus('error')
        })
    }, 250)
    return () => clearTimeout(t)
  }, [query, search])

  function go(hit: Hit | undefined) {
    if (!hit) return
    setOpen(false)
    window.location.assign(hit.url)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(hits[active]) }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  const showPanel = open && pos && status !== 'idle'
  const activeId = hits[active] ? `${listId}-${active}` : undefined

  return (
    <div ref={wrapRef} className="avtb-search">
      <span className="avtb-search-icon"><SearchIcon size={16} aria-hidden /></span>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search AltaVue"
        aria-expanded={!!showPanel}
        aria-controls={listId}
        aria-activedescendant={showPanel ? activeId : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        maxLength={200}
        placeholder="Search projects, items, risks… or #42"
        value={query}
        onChange={(e) => { setQuery(e.target.value); place(); setOpen(true) }}
        onFocus={() => { place(); setOpen(true) }}
        onKeyDown={onKeyDown}
      />
      <span className="avtb-kbd" aria-hidden="true">Ctrl K</span>
      {showPanel && typeof document !== 'undefined' && createPortal(
        <div ref={panelRef} className="avtb-panel" style={{ top: pos.top, left: pos.left, width: pos.width, padding: 6 }}>
          {status === 'loading' && hits.length === 0 && <div className="avtb-msg">Searching…</div>}
          {status === 'error' && <div className="avtb-msg">Search is unavailable right now. Try again in a moment.</div>}
          {status === 'done' && hits.length === 0 && <div className="avtb-msg">No matches in your company’s projects.</div>}
          {hits.length > 0 && (
            <div id={listId} role="listbox" aria-label="Search results">
              {hits.map((h, i) => (
                <a
                  key={`${h.row.entity_type}-${h.row.entity_id}-${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="avtb-item"
                  data-active={i === active}
                  href={h.url}
                  onMouseEnter={() => setActive(i)}
                  onClick={(e) => { e.preventDefault(); go(h) }}
                  style={{ padding: '8px 10px' }}
                >
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="avtb-item-name" style={{ display: 'block' }}>
                      {h.row.entity_number != null && h.row.entity_type === 'work_item' ? `#${h.row.entity_number} ` : ''}{h.row.title}
                    </span>
                    <span className="avtb-item-desc" style={{ display: 'block' }}>
                      {SEARCH_MODULE_LABELS[h.row.module] ?? h.row.module} · {SEARCH_ENTITY_LABELS[h.row.entity_type] ?? h.row.entity_type}
                      {h.row.project_name && h.row.entity_type !== 'project' ? ` · ${h.row.project_name}` : ''}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
