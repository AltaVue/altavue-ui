'use client'
// @comet/ui/units/select — the ONE unit dropdown for the whole platform (AO-993, AO-982 S5), and the small
// read-only label that shows a unit's meaning on hover wherever a unit appears in a table.
//
// WHAT A PERSON SEES
//   * A closed control showing the chosen unit's symbol and name ("ft² · Square foot"). Hover shows what it means.
//   * Open: a search box, then the Core units grouped by category. "Show all units" adds the Extended ones.
//     Typing finds a unit by code, symbol, name, a word in the name or a known spelling ("hrs", "sq ft", "cu yd");
//     typed searches look at Extended units too. Specification units (pressure, voltage ...) are not offered
//     in quantity menus.
//   * A definition strip under the list always shows what the highlighted unit means (hover or arrow keys).
//   * An old value nobody can safely convert shows "Needs a unit" and the old text; nothing is ever written
//     into the field for that, it is only a flag on screen. Picking a unit replaces it.
//   * The code is what gets saved (FT2), the symbol (ft²) is what people read.
//
// DATA: this package has no database dependency, so the list comes in as props, from <UnitListProvider> or from
// the useUnitList() hook, both of which read public.unit_catalog / public.unit_aliases through the app's own
// Supabase client. The list is read once per page load and shared.
//
// STYLING: self-contained (a <style> block with an aus- prefix), because an app's Tailwind build does not scan
// this package. It follows the AltaVue navy and gold, and works inside slide-over panels and modals because the
// open list is drawn on <body>.

import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  ALIAS_COLUMNS,
  QUANTITY_KINDS,
  UNIT_COLUMNS,
  cleanAliasRows,
  cleanUnitRows,
  extendedCount,
  groupUnits,
  resolveUnit,
  searchUnits,
  unitHover,
  unitShort,
  unitsForMenu,
  type AliasRow,
  type UnitResolution,
  type UnitRow,
  type UnitUseKind,
} from './units'

const NAVY = '#0a1628'
const GOLD = '#c9a84c'

const CSS = `
.aus-wrap{position:relative;display:block;width:100%;font-family:var(--font-sans,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif)}
.aus-wrap *{box-sizing:border-box}
.aus-trigger{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;
  color:${NAVY};font-size:14px;font-family:inherit;text-align:left;cursor:pointer;line-height:1.3}
.aus-wrap[data-size="sm"] .aus-trigger{min-height:32px;padding:5px 9px;font-size:13px}
.aus-trigger:hover:not(:disabled){border-color:#9ca3af}
.aus-trigger:focus-visible{outline:2px solid ${GOLD};outline-offset:1px}
.aus-trigger:disabled{background:#f3f4f6;color:#9ca3af;cursor:not-allowed}
.aus-trigger[data-invalid="true"]{border-color:#dc2626}
.aus-trigger[aria-expanded="true"]{border-color:${GOLD}}
.aus-val{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aus-sym{font-weight:600}
.aus-name{color:#6b7280}
.aus-ph{color:#9ca3af}
.aus-caret{flex-shrink:0;color:#6b7280;font-size:11px}
.aus-flag{display:inline-block;padding:1px 7px;border-radius:9999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;border:1px solid #f59e0b;white-space:nowrap}
.aus-was{color:#6b7280;font-size:12px;margin-left:6px}
.aus-panel{position:fixed;z-index:10000;display:flex;flex-direction:column;background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 32px rgba(10,22,40,0.18);color:${NAVY};overflow:hidden;font-family:var(--font-sans,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif)}
.aus-panel *{box-sizing:border-box}
.aus-search{flex-shrink:0;padding:10px 10px 8px;border-bottom:1px solid #eef2f7}
.aus-search input{width:100%;height:36px;padding:0 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;color:${NAVY};outline:none;background:#fff}
.aus-search input:focus{border-color:${GOLD};box-shadow:0 0 0 2px rgba(201,168,76,0.25)}
.aus-list{flex:1;min-height:0;overflow-y:auto;padding:4px 6px;overscroll-behavior:contain}
.aus-group{padding:8px 8px 4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280}
.aus-opt{display:flex;align-items:baseline;gap:8px;padding:7px 8px;border-radius:6px;cursor:pointer;font-size:14px;line-height:1.3}
.aus-opt[data-active="true"]{background:#f3f6fb}
.aus-opt[aria-selected="true"]{background:#eef3fc;box-shadow:inset 3px 0 0 ${GOLD}}
.aus-opt .aus-oname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aus-ext{flex-shrink:0;font-size:10px;color:#6b7280;border:1px solid #d1d5db;border-radius:4px;padding:0 4px}
.aus-none{font-style:italic;color:#6b7280}
.aus-empty{padding:18px 12px;text-align:center;font-size:13px;color:#6b7280;line-height:1.45}
.aus-def{flex-shrink:0;min-height:74px;padding:9px 12px;border-top:1px solid #eef2f7;background:#f8fafc;font-size:12px;line-height:1.45;color:#374151}
.aus-def b{display:block;color:${NAVY};font-size:13px;margin-bottom:2px}
.aus-def .aus-cat{color:#6b7280}
.aus-foot{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 12px;border-top:1px solid #eef2f7;font-size:12px;color:#6b7280}
.aus-toggle{border:none;background:transparent;color:#1d4ed8;font-size:12px;font-weight:600;cursor:pointer;padding:2px 0;font-family:inherit}
.aus-toggle:hover{text-decoration:underline}
.aus-toggle:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
.aus-label{cursor:help;border-bottom:1px dotted #9ca3af}
.aus-label[data-needs="true"]{border-bottom-color:#f59e0b;color:#92400e}
`

// React 19 puts a <style href precedence> in the page head once, however many dropdowns and labels use it
// (a table can hold hundreds of unit labels). No build step or app stylesheet is needed.
function Style() {
  return <style href="aus-units-v1" precedence="default">{CSS}</style>
}

// ---------------------------------------------------------------------------------------------------------------
// Loading the list
// ---------------------------------------------------------------------------------------------------------------

/** Anything with a Supabase-style from(table).select(columns)... chain. Kept structural so this package needs no Supabase. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UnitListClient { from: (table: string) => any }

export interface UnitList {
  units: UnitRow[]
  aliases: AliasRow[]
  loading: boolean
  error: string | null
}

const EMPTY: UnitList = { units: [], aliases: [], loading: true, error: null }
let cached: Promise<{ units: UnitRow[]; aliases: AliasRow[] }> | null = null

async function readList(client: UnitListClient) {
  const [u, a] = await Promise.all([
    client.from('unit_catalog').select(UNIT_COLUMNS).eq('is_active', true).order('sort_order', { ascending: true }),
    client.from('unit_aliases').select(ALIAS_COLUMNS),
  ])
  if (u.error) throw new Error(String(u.error.message ?? u.error))
  if (a.error) throw new Error(String(a.error.message ?? a.error))
  return { units: cleanUnitRows(u.data), aliases: cleanAliasRows(a.data) }
}

/** Read the platform unit list once per page load (shared by every dropdown on the page). */
export function useUnitList(client: UnitListClient | null | undefined): UnitList {
  const [state, setState] = React.useState<UnitList>(EMPTY)
  React.useEffect(() => {
    if (!client) return
    let live = true
    if (!cached) cached = readList(client)
    cached.then(
      (r) => { if (live) setState({ ...r, loading: false, error: null }) },
      (e: unknown) => {
        cached = null // try again next time
        if (live) setState({ units: [], aliases: [], loading: false, error: e instanceof Error ? e.message : 'The unit list could not be loaded.' })
      },
    )
    return () => { live = false }
  }, [client])
  return state
}

const UnitListContext = React.createContext<UnitList | null>(null)

/** Read the list once near the top of a screen and let every UnitSelect / UnitLabel below use it. */
export function UnitListProvider({ client, children }: { client: UnitListClient | null | undefined; children: React.ReactNode }) {
  const list = useUnitList(client)
  return <UnitListContext.Provider value={list}>{children}</UnitListContext.Provider>
}

function useList(units?: UnitRow[], aliases?: AliasRow[]): UnitList {
  const ctx = React.useContext(UnitListContext)
  if (units) return { units, aliases: aliases ?? ctx?.aliases ?? [], loading: false, error: null }
  return ctx ?? { units: [], aliases: [], loading: false, error: 'No unit list was provided.' }
}

// ---------------------------------------------------------------------------------------------------------------
// The read-only label
// ---------------------------------------------------------------------------------------------------------------

export interface UnitLabelProps {
  value: string | null | undefined
  units?: UnitRow[]
  aliases?: AliasRow[]
  /** Text shown when there is no unit. Default: an em dash. */
  empty?: string
  /** 'symbol' (default, "ft²") or 'code' ("FT2") or 'name' ("Square foot"). */
  show?: 'symbol' | 'code' | 'name'
}

/** A unit inside a table or sentence. Hover shows its name, code and meaning; an unconvertible value is flagged. */
export function UnitLabel({ value, units, aliases, empty = '—', show = 'symbol' }: UnitLabelProps) {
  const list = useList(units, aliases)
  const r: UnitResolution = resolveUnit(value, list.units, list.aliases)
  if (r.status === 'empty') return <span>{empty}</span>
  if (r.status === 'needs_unit') {
    return (
      <span className="aus-label" data-needs="true" title={r.suggestion ? `Needs a unit. Possible match: ${r.suggestion.name}. Open the line and choose one.` : 'Needs a unit. Open the line and choose one from the list.'}>
        <Style />{r.text}
      </span>
    )
  }
  const u = r.unit
  return <span className="aus-label" title={unitHover(u)}><Style />{show === 'code' ? u.code : show === 'name' ? u.name : unitShort(u)}</span>
}

// ---------------------------------------------------------------------------------------------------------------
// The dropdown
// ---------------------------------------------------------------------------------------------------------------

export interface UnitSelectProps {
  /** The stored value: an official unit code, an old free-text value, or empty. */
  value: string | null | undefined
  /** Called with the official unit CODE, or null when the person clears it. */
  onChange: (code: string | null) => void
  /** Optional: pass the list directly. Otherwise it comes from <UnitListProvider>. */
  units?: UnitRow[]
  aliases?: AliasRow[]
  /** Which kinds of unit to offer. Default: quantity and billing basis. */
  kinds?: readonly UnitUseKind[]
  disabled?: boolean
  /** Offer a "No unit" row. Default true. */
  allowClear?: boolean
  /** Show the "Needs a unit" flag when the value is empty (for a field that must have a unit). */
  flagEmpty?: boolean
  placeholder?: string
  id?: string
  /** Adds a hidden form field with this name carrying the unit code (for plain <form> posts). */
  name?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  size?: 'md' | 'sm'
  invalid?: boolean
}

interface Opt { key: string; unit: UnitRow | null }

export function UnitSelect(props: UnitSelectProps) {
  const {
    value, onChange, kinds = QUANTITY_KINDS, disabled = false, allowClear = true, flagEmpty = false,
    placeholder = 'Select a unit', id, name, ariaLabel, ariaLabelledBy, size = 'md', invalid = false,
  } = props
  const list = useList(props.units, props.aliases)
  const uid = React.useId()
  const listId = `${uid}-list`
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [showAll, setShowAll] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [pos, setPos] = React.useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const resolution = React.useMemo(() => resolveUnit(value, list.units, list.aliases), [value, list.units, list.aliases])
  const searching = query.trim() !== ''

  const menuUnits = React.useMemo(() => unitsForMenu(list.units, { kinds, showAll }), [list.units, kinds, showAll])
  const extra = React.useMemo(() => extendedCount(list.units, { kinds }), [list.units, kinds])
  const groups = React.useMemo(() => groupUnits(menuUnits), [menuUnits])
  const found = React.useMemo(() => (searching ? searchUnits(list.units, list.aliases, query, { kinds }) : []), [searching, list.units, list.aliases, query, kinds])

  // The flat list of rows the keyboard walks through.
  const opts: Opt[] = React.useMemo(() => {
    const o: Opt[] = []
    if (allowClear && !searching) o.push({ key: 'none', unit: null })
    const src = searching ? found : groups.flatMap((g) => g.units)
    for (const u of src) o.push({ key: u.code, unit: u })
    return o
  }, [allowClear, searching, found, groups])

  const place = React.useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(Math.max(r.width, 340), vw - 16)
    const left = Math.max(8, Math.min(r.left, vw - width - 8))
    const below = vh - r.bottom - 12
    const above = r.top - 12
    const wanted = 460
    if (below >= Math.min(wanted, 320) || below >= above) setPos({ left, width, top: r.bottom + 4, maxHeight: Math.max(220, Math.min(wanted, below)) })
    else setPos({ left, width, bottom: vh - r.top + 4, maxHeight: Math.max(220, Math.min(wanted, above)) })
  }, [])

  const close = React.useCallback((refocus: boolean) => {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus()
  }, [])

  const openIt = React.useCallback(() => {
    if (disabled) return
    place()
    setQuery('')
    setShowAll(resolution.status === 'official' || resolution.status === 'convertible' ? resolution.unit.availability === 'extended' : false)
    setOpen(true)
  }, [disabled, place, resolution])

  // Put the highlight on the current unit when the list opens, otherwise on the first row.
  React.useEffect(() => {
    if (!open) return
    const cur = resolution.status === 'official' || resolution.status === 'convertible' ? resolution.unit.code : null
    const i = cur ? opts.findIndex((o) => o.unit?.code === cur) : -1
    setActive(i >= 0 ? i : allowClear && !searching ? 1 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  React.useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      close(false)
    }
    const onResize = () => place()
    const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) place() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close, place])

  // Keep the highlighted row in view while arrowing.
  React.useEffect(() => {
    if (!open) return
    document.getElementById(`${uid}-o${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, uid])

  const choose = (o: Opt | undefined) => {
    if (!o) return
    onChange(o.unit ? o.unit.code : null)
    close(true)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(opts.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Home' && !searching) { e.preventDefault(); setActive(0) }
    else if (e.key === 'End' && !searching) { e.preventDefault(); setActive(opts.length - 1) }
    else if (e.key === 'PageDown') { e.preventDefault(); setActive((a) => Math.min(opts.length - 1, a + 8)) }
    else if (e.key === 'PageUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 8)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(opts[active]) }
    else if (e.key === 'Tab') { close(false) }
  }

  const activeUnit = opts[active]?.unit ?? null

  // ---- the closed control ----
  let shown: React.ReactNode
  let hover: string | undefined
  if (list.loading) shown = <span className="aus-ph">Loading units…</span>
  else if (list.error && list.units.length === 0) shown = <span className="aus-ph">{value ? String(value) : 'Units could not be loaded'}</span>
  else if (resolution.status === 'empty') {
    shown = flagEmpty ? <span className="aus-flag">Needs a unit</span> : <span className="aus-ph">{placeholder}</span>
  } else if (resolution.status === 'needs_unit') {
    shown = (
      <>
        <span className="aus-flag">Needs a unit</span>
        <span className="aus-was">was “{resolution.text}”</span>
      </>
    )
    hover = resolution.suggestion
      ? `This value is not on the AltaVue unit list. Possible match: ${resolution.suggestion.name}. Choose a unit.`
      : 'This value is not on the AltaVue unit list. Choose a unit.'
  } else {
    shown = (
      <>
        <span className="aus-sym">{resolution.unit.name}</span>
      </>
    )
    hover = unitHover(resolution.unit)
  }

  const panel = open && pos && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={panelRef}
          className="aus-panel"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true) } }}
        >
          <Style />
          <div className="aus-search">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={opts[active] ? `${uid}-o${active}` : undefined}
              aria-autocomplete="list"
              aria-label="Search units"
              placeholder="Search units: name, symbol or spelling"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={onKey}
            />
          </div>
          <div className="aus-list" role="listbox" id={listId} aria-label="Units of measure">
            {searching && found.length === 0 && (
              <div className="aus-empty">
                No unit matches “{query.trim()}”.<br />
                AltaVue uses one list of units for everyone. If one is missing, send an enhancement request from the Portal.
              </div>
            )}
            {!searching && opts[0]?.key === 'none' && (
              <div
                id={`${uid}-o0`}
                role="option"
                aria-selected={resolution.status === 'empty'}
                data-active={active === 0}
                className="aus-opt"
                onMouseMove={() => active !== 0 && setActive(0)}
                onClick={() => choose(opts[0])}
              >
                <span className="aus-oname aus-none">No unit</span>
              </div>
            )}
            {searching
              ? found.map((u, i) => <OptionRow key={u.code} uid={uid} index={i} u={u} active={active === i} selected={isChosen(resolution, u)} showCategory onHover={setActive} onPick={() => choose(opts[i])} />)
              : renderGroups(groups, opts, active, resolution, uid, setActive, choose)}
          </div>
          <div className="aus-def" aria-live="polite">
            {activeUnit ? (
              <>
                <b>{activeUnit.name} <span style={{ fontWeight: 400, color: '#6b7280' }}>· {activeUnit.code}{activeUnit.symbol !== activeUnit.code ? ` · ${activeUnit.symbol}` : ''}</span></b>
                {activeUnit.definition || 'No description on the list for this unit.'}
                <div className="aus-cat">{activeUnit.category}{activeUnit.availability === 'extended' ? ' · Extended list' : ''}</div>
              </>
            ) : (
              <span>Point at a unit, or use the arrow keys, to see what it means.</span>
            )}
          </div>
          <div className="aus-foot">
            {!searching && extra > 0 ? (
              <button type="button" className="aus-toggle" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show fewer units' : `Show all units (+${extra})`}
              </button>
            ) : <span>{searching ? `${found.length} found` : ' '}</span>}
            <span>Esc to close</span>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <span className="aus-wrap" data-size={size}>
      <Style />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="aus-trigger"
        data-invalid={invalid || undefined}
        disabled={disabled || list.loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        title={hover}
        onClick={() => (open ? close(false) : openIt())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openIt() }
        }}
      >
        <span className="aus-val">{shown}</span>
        <span className="aus-caret" aria-hidden="true">▾</span>
      </button>
      {name ? <input type="hidden" name={name} value={resolution.status === 'official' || resolution.status === 'convertible' ? resolution.unit.code : ''} /> : null}
      {panel}
    </span>
  )
}

function isChosen(r: UnitResolution, u: UnitRow): boolean {
  return (r.status === 'official' || r.status === 'convertible') && r.unit.code === u.code
}

function renderGroups(
  groups: { category: string; units: UnitRow[] }[],
  opts: Opt[],
  active: number,
  resolution: UnitResolution,
  uid: string,
  setActive: (i: number) => void,
  choose: (o: Opt | undefined) => void,
) {
  const out: React.ReactNode[] = []
  let i = opts[0]?.key === 'none' ? 1 : 0
  for (const g of groups) {
    out.push(<div key={`g-${g.category}`} className="aus-group" role="presentation">{g.category}</div>)
    for (const u of g.units) {
      const idx = i++
      out.push(<OptionRow key={u.code} uid={uid} index={idx} u={u} active={active === idx} selected={isChosen(resolution, u)} onHover={setActive} onPick={() => choose(opts[idx])} />)
    }
  }
  return out
}

function OptionRow(props: { uid: string; index: number; u: UnitRow; active: boolean; selected: boolean; showCategory?: boolean; onHover: (i: number) => void; onPick: () => void }) {
  const { uid, index, u, active, selected, showCategory, onHover, onPick } = props
  return (
    <div
      id={`${uid}-o${index}`}
      role="option"
      aria-selected={selected}
      data-active={active}
      className="aus-opt"
      onMouseMove={() => !active && onHover(index)}
      onClick={onPick}
      title={unitHover(u)}
    >
      <span className="aus-oname">{u.name}{showCategory ? <span style={{ color: '#9ca3af' }}> · {u.category}</span> : null}</span>
      {u.availability === 'extended' ? <span className="aus-ext">Extended</span> : null}
    </div>
  )
}
