// ---------------------------------------------------------------------------
// Calendar days and moments in time — single source of truth (AO-2012)
// ---------------------------------------------------------------------------
//
// THIS IS THE SHARED COPY — @comet/ui/dates, since v0.3.0 (AO-2005).
// An app that has moved to it keeps a one-line lib/dates.ts that re-exports
// this file, so none of that app's imports change. An app that has not moved
// yet still holds a local copy of the code below, which must stay identical
// to this one until it switches. Change it HERE, cut a new tag, and bump the
// apps. Never add logic to an app's forwarder.
//
// No React, no browser API, no server API — it runs anywhere.
//
// WHAT THIS IS, IN PLAIN TERMS
// AltaVue handles two different kinds of "date", and mixing them up shifts
// dates by a day for anyone outside UTC (AO-2012):
//
//   1. A CALENDAR DAY — 'YYYY-MM-DD', a Postgres `date` column (start_date,
//      due_date, release_date, sprint end_date ...). It has no time and no
//      time zone: Dec 3 is Dec 3 for everyone.
//      NEVER pass one to `new Date(s)`. JavaScript reads '2026-12-03' as
//      midnight UTC, which is the evening of Dec 2 in every US time zone, so
//      toLocaleDateString / getDate / getDay all give the day before.
//      Use formatDay, parseDay, addDays, daysBetween, dayOfWeek instead.
//
//   2. A MOMENT — an ISO timestamp, a Postgres `timestamptz` (created_at,
//      approved_at, last_sign_in_at ...), or `new Date()`. It is a point in
//      time and is shown in the viewer's own time zone.
//      Use formatMoment / dayOfMoment. In a component that is rendered on the
//      server first, get the zone from useViewerTimeZone() or <LocalTime>
//      (components/LocalTime.tsx) so the server and browser render the same
//      text (otherwise React error #418). On the server, pass the zone from
//      getRequestTimeZone() (lib/requestTimeZone.ts).
//
// "TODAY" IS A CALENDAR DAY THAT DEPENDS ON WHERE YOU ARE
// `new Date().toISOString().slice(0, 10)` is today in London. After 8pm
// Eastern / 5pm Pacific it is already tomorrow. Use todayDay(): in the browser
// with no argument it is the viewer's today; on the server pass the request's
// time zone. Never build a calendar day from toISOString() on a local date.

/** Fallback when the viewer's time zone is unknown (most customers are US Eastern). */
export const DEFAULT_TIME_ZONE = 'America/New_York'

/** Name of the session cookie that carries the browser's time zone to the server. */
export const TZ_COOKIE = 'av_tz'

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
// A calendar day sometimes arrives with a zone-less midnight attached
// ('2026-12-03T00:00:00'). Anything carrying 'Z' or an offset is a moment.
const DAY_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})(?:T00:00(?::00(?:\.0+)?)?)?$/

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + '|' + JSON.stringify(options)
  let f = formatterCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options)
    formatterCache.set(key, f)
  }
  return f
}

/** Splits a calendar day into numbers, or null if it is not a real 'YYYY-MM-DD'. */
function splitDay(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string') return null
  const m = DAY_PREFIX_RE.exec(value.trim())
  if (!m) return null
  const parts = DAY_RE.exec(m[1])
  if (!parts) return null
  const y = Number(parts[1])
  const mo = Number(parts[2])
  const d = Number(parts[3])
  const check = new Date(Date.UTC(y, mo - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null
  return [y, mo, d]
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

function joinDay(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`
}

/** True if `value` is a real calendar day ('YYYY-MM-DD', optionally with a zone-less 'T00:00:00'). */
export function isDay(value: unknown): value is string {
  return splitDay(value) !== null
}

/** The 'YYYY-MM-DD' part of a calendar day, or null if it is not one. */
export function dayOrNull(value: unknown): string | null {
  const p = splitDay(value)
  return p ? joinDay(p[0], p[1], p[2]) : null
}

/**
 * Shows a calendar day. Gives the same text on the server and in every
 * browser, in every time zone. Returns `fallback` for an empty or invalid value.
 *
 *   formatDay('2026-12-03')                                   → 'Dec 3, 2026'
 *   formatDay('2026-12-03', { day: '2-digit', month: 'short' }, 'en-AU') → '03 Dec'
 */
export function formatDay(
  day: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  locale = 'en-US',
  fallback = '—',
): string {
  const p = splitDay(day)
  if (!p) return fallback
  const at = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12))
  return formatter(locale, { ...options, timeZone: 'UTC' }).format(at)
}

/**
 * A calendar day as a Date at LOCAL midnight — for charts, local comparisons
 * and anything that needs a Date object in the browser. Invalid input gives an
 * Invalid Date (getTime() is NaN), the same as `new Date('garbage')`.
 */
export function parseDay(day: string | null | undefined): Date {
  const p = splitDay(day)
  if (!p) return new Date(NaN)
  return new Date(p[0], p[1] - 1, p[2])
}

/** A Date's calendar day in the runtime's local time zone (local getters, never toISOString). */
export function toDay(date: Date): string {
  return joinDay(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** `day` moved by `n` days (n may be negative). Returns '' for an invalid day. */
export function addDays(day: string, n: number): string {
  const p = splitDay(day)
  if (!p || !Number.isFinite(n)) return ''
  const at = new Date(Date.UTC(p[0], p[1] - 1, p[2] + Math.trunc(n)))
  return joinDay(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate())
}

/** Whole days from `from` to `to` (positive when `to` is later). NaN if either is invalid. */
export function daysBetween(from: string, to: string): number {
  const a = splitDay(from)
  const b = splitDay(to)
  if (!a || !b) return NaN
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86_400_000)
}

/** Day of the week of a calendar day: 0 = Sunday … 6 = Saturday. NaN if invalid. */
export function dayOfWeek(day: string): number {
  const p = splitDay(day)
  if (!p) return NaN
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()
}

/** Returns `tz` if it is a time zone this runtime knows, otherwise DEFAULT_TIME_ZONE. */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

/** The time zone this runtime is in (the viewer's, in a browser). */
export function runtimeTimeZone(): string {
  try {
    return safeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

function toMomentDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * The calendar day a moment falls on in `timeZone` (default: the runtime's
 * local zone). '' for an invalid moment.
 *
 *   dayOfMoment('2026-10-16T01:30:00Z', 'America/New_York') → '2026-10-15'
 */
export function dayOfMoment(
  value: string | number | Date | null | undefined,
  timeZone?: string,
): string {
  const d = toMomentDate(value)
  if (!d) return ''
  const parts = formatter('en-US', {
    timeZone: timeZone ? safeTimeZone(timeZone) : undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value)
  return joinDay(get('year'), get('month'), get('day'))
}

/**
 * Today's calendar day. In the browser with no argument: the viewer's today.
 * On the server: pass the request's zone (getRequestTimeZone()), otherwise you
 * get the server's today, which is UTC.
 */
export function todayDay(timeZone?: string): string {
  return dayOfMoment(new Date(), timeZone)
}

/**
 * Shows a moment in `timeZone` (default: the runtime's local zone). Returns
 * `fallback` for an empty or invalid value.
 *
 * In a component that is server-rendered, pass the zone from
 * useViewerTimeZone(); on the server, from getRequestTimeZone().
 */
export function formatMoment(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  timeZone?: string,
  locale = 'en-US',
  fallback = '—',
): string {
  const d = toMomentDate(value)
  if (!d) return fallback
  return formatter(locale, { ...options, timeZone: timeZone ? safeTimeZone(timeZone) : undefined }).format(d)
}
