// @comet/ui/units — the AltaVue unit list, as plain logic with no React and no database (AO-993, AO-982 S5).
//
// WHAT THIS IS, IN PLAIN TERMS
// AltaVue has ONE list of units of measure for the whole platform (the database tables unit_catalog and
// unit_aliases, loaded from Saber's Universal Unit of Measure workbook; customers read it, only Saber changes it).
// This file is the shared rulebook for using that list on a screen: which units a menu shows, how a typed word
// ("hrs", "each", "sq ft") finds its unit, and how an old free-text value is recognised or flagged "Needs a unit".
//
// THE MATCHING RULES MIRROR THE DATABASE. The database function unit_normalize() is the referee: it converts an
// old spelling to the official code on every save. resolveUnit() below follows the same four steps in the same
// order so that what a person sees on screen is what the database will do with the value:
//   a. exactly an official code (case-sensitive; what the dropdown stores)
//   b. a known spelling (alias) -- converted only when the list marks it safe to convert without asking
//   c. an official code typed in another case (ea, Ea)
//   d. the unit's name (each, hour, lot)
// Anything else, or an alias the list marks "a person must choose" (TON, GAL, CY, SQ ...), is "needs a unit".
// If you change one side, change the other and run src/units/units.test.ts.
//
// This package must never acquire a database or auth dependency (see README), so the screens read the two
// tables with their own Supabase connection and hand the rows in; UNIT_COLUMNS / ALIAS_COLUMNS name what to read.

export type UnitUseKind = 'quantity' | 'billing_basis' | 'specification'
export type UnitAvailability = 'core' | 'extended'

export interface UnitRow {
  code: string
  name: string
  symbol: string
  category: string
  use_kind: UnitUseKind
  availability: UnitAvailability
  definition: string
  is_active: boolean
  sort_order: number
}

export interface AliasRow {
  alias: string
  unit_code: string | null
  auto_map: boolean
}

/** The columns to read from public.unit_catalog and public.unit_aliases. */
export const UNIT_COLUMNS = 'code, name, symbol, category, use_kind, availability, definition, is_active, sort_order'
export const ALIAS_COLUMNS = 'alias, unit_code, auto_map'

/**
 * Quantity menus (an estimate line, a material, a purchase request line, a stock item) offer measures you can count
 * or bill by. The "specification / utility" units (pressure ratings, voltages, flow rates ...) describe an item,
 * they are not a quantity you buy, so they are not offered there.
 */
export const QUANTITY_KINDS: readonly UnitUseKind[] = ['quantity', 'billing_basis']

const KINDS: readonly string[] = ['quantity', 'billing_basis', 'specification']
const AVAILS: readonly string[] = ['core', 'extended']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Keep only well-formed, active rows. A malformed row is dropped, never guessed at. */
export function cleanUnitRows(data: unknown): UnitRow[] {
  if (!Array.isArray(data)) return []
  const out: UnitRow[] = []
  for (const r of data) {
    if (!isRecord(r)) continue
    const { code, name, symbol, category, use_kind, availability, definition, is_active, sort_order } = r
    if (typeof code !== 'string' || !code || typeof name !== 'string' || !name) continue
    if (typeof use_kind !== 'string' || !KINDS.includes(use_kind)) continue
    if (typeof availability !== 'string' || !AVAILS.includes(availability)) continue
    if (is_active === false) continue
    out.push({
      code,
      name,
      symbol: typeof symbol === 'string' && symbol ? symbol : code,
      category: typeof category === 'string' && category ? category : 'Other',
      use_kind: use_kind as UnitUseKind,
      availability: availability as UnitAvailability,
      definition: typeof definition === 'string' ? definition : '',
      is_active: true,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
    })
  }
  return out.sort((a, b) => a.sort_order - b.sort_order)
}

export function cleanAliasRows(data: unknown): AliasRow[] {
  if (!Array.isArray(data)) return []
  const out: AliasRow[] = []
  for (const r of data) {
    if (!isRecord(r)) continue
    const { alias, unit_code, auto_map } = r
    if (typeof alias !== 'string' || !alias) continue
    out.push({ alias, unit_code: typeof unit_code === 'string' && unit_code ? unit_code : null, auto_map: auto_map === true })
  }
  return out
}

/** The database's spelling clean-up: trim spaces at both ends, squeeze runs of white space to one space, upper-case. */
export function spellingKey(value: string): string {
  return value.replace(/^ +| +$/g, '').replace(/\s+/g, ' ').toUpperCase()
}

export type UnitResolution =
  | { status: 'empty' }
  | { status: 'official'; unit: UnitRow }
  | { status: 'convertible'; unit: UnitRow; via: 'alias' | 'code' | 'name' }
  | { status: 'needs_unit'; text: string; suggestion: UnitRow | null }

/**
 * What the platform makes of a stored value. 'official' and 'convertible' both resolve to a unit on the list
 * ('convertible' is an old spelling the database converts for you); 'needs_unit' is text nobody can safely convert,
 * shown with a "Needs a unit" flag and, when the list has a likely answer, that answer as a suggestion.
 */
export function resolveUnit(value: string | null | undefined, units: readonly UnitRow[], aliases: readonly AliasRow[] = []): UnitResolution {
  const raw = value ?? ''
  const key = spellingKey(raw)
  if (key === '') return { status: 'empty' }
  const byCode = new Map(units.map((u) => [u.code, u]))

  // a. exactly an official code
  const exact = byCode.get(raw.replace(/^ +| +$/g, ''))
  if (exact) return { status: 'official', unit: exact }

  // b. a known spelling
  const alias = aliases.find((a) => a.alias === key)
  if (alias) {
    const target = alias.unit_code ? byCode.get(alias.unit_code) : undefined
    if (alias.auto_map && target) return { status: 'convertible', unit: target, via: 'alias' }
    return { status: 'needs_unit', text: raw.trim(), suggestion: target ?? null }
  }

  // c. an official code in another case
  const upper = byCode.get(key)
  if (upper) return { status: 'convertible', unit: upper, via: 'code' }

  // d. the unit's name (first by list order when two units share a name)
  const named = units.find((u) => u.name.toUpperCase() === key)
  if (named) return { status: 'convertible', unit: named, via: 'name' }

  return { status: 'needs_unit', text: raw.trim(), suggestion: null }
}

export interface MenuOptions {
  /** Which kinds of unit the menu offers. Default: quantity and billing basis (never specification). */
  kinds?: readonly UnitUseKind[]
  /** false (default): the Core units only. true: Core and Extended. */
  showAll?: boolean
}

/** The units a menu offers, in the list's own order. */
export function unitsForMenu(units: readonly UnitRow[], opts: MenuOptions = {}): UnitRow[] {
  const kinds = opts.kinds ?? QUANTITY_KINDS
  return units.filter((u) => u.is_active && kinds.includes(u.use_kind) && (opts.showAll || u.availability === 'core'))
}

export interface UnitGroup {
  category: string
  units: UnitRow[]
}

/** Group units by category; categories appear in the order of their first unit on the list. */
export function groupUnits(units: readonly UnitRow[]): UnitGroup[] {
  const groups: UnitGroup[] = []
  const at = new Map<string, UnitGroup>()
  for (const u of units) {
    let g = at.get(u.category)
    if (!g) {
      g = { category: u.category, units: [] }
      at.set(u.category, g)
      groups.push(g)
    }
    g.units.push(u)
  }
  return groups
}

/** The units a menu would offer if the person ticks "Show all units", minus those already shown. */
export function extendedCount(units: readonly UnitRow[], opts: MenuOptions = {}): number {
  return unitsForMenu(units, { ...opts, showAll: true }).length - unitsForMenu(units, { ...opts, showAll: false }).length
}

/**
 * Find units by what a person types: a code (FT2), a symbol, a name (square foot), a known spelling (sq ft, hrs, cu yd),
 * or a word from the name. Searching looks at Core AND Extended units (a person who types "tonne" should find it
 * without first ticking "Show all units") but never at units the menu's kinds exclude. Best match first.
 */
export function searchUnits(units: readonly UnitRow[], aliases: readonly AliasRow[], query: string, opts: MenuOptions = {}): UnitRow[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  const qKey = spellingKey(query)
  const kinds = opts.kinds ?? QUANTITY_KINDS
  const pool = units.filter((u) => u.is_active && kinds.includes(u.use_kind))
  const aliasCodes = new Map<string, number>() // unit code -> best alias score
  for (const a of aliases) {
    if (!a.unit_code) continue
    const ak = a.alias
    const s = ak === qKey ? 95 : ak.startsWith(qKey) && qKey.length >= 2 ? 55 : 0
    if (s > 0) aliasCodes.set(a.unit_code, Math.max(aliasCodes.get(a.unit_code) ?? 0, s))
  }
  const scored: { u: UnitRow; s: number }[] = []
  for (const u of pool) {
    const code = u.code.toLowerCase()
    const sym = u.symbol.toLowerCase()
    const name = u.name.toLowerCase()
    let s = 0
    if (code === q) s = Math.max(s, 100)
    if (sym === q) s = Math.max(s, 90)
    if (name === q) s = Math.max(s, 92)
    s = Math.max(s, aliasCodes.get(u.code) ?? 0)
    if (code.startsWith(q)) s = Math.max(s, 80)
    if (name.startsWith(q)) s = Math.max(s, 70)
    if (name.split(/[\s(),/-]+/).some((w) => w.startsWith(q))) s = Math.max(s, 60)
    if (name.includes(q)) s = Math.max(s, 40)
    if (q.length >= 3 && u.definition.toLowerCase().includes(q)) s = Math.max(s, 20)
    if (s > 0) scored.push({ u, s })
  }
  scored.sort((a, b) => b.s - a.s || a.u.sort_order - b.u.sort_order)
  return scored.map((x) => x.u)
}

/** The text a screen shows for a unit: its symbol, because that is what people read ("ft²", "hr"). */
export function unitShort(u: UnitRow): string {
  return u.symbol || u.code
}

/** The hover text for a unit: its name, its code and what it means. */
export function unitHover(u: UnitRow): string {
  return `${u.name} (${u.code})${u.definition ? ' — ' + u.definition : ''}`
}
