/**
 * Relative time formatting ("3 minutes ago", "yesterday").
 *
 * Uses the browser's built-in Intl.RelativeTimeFormat rather than a date
 * library. No AltaVue module carries a date dependency today and this does not
 * add one.
 */

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
]

/**
 * Format a timestamp as time elapsed since now, e.g. "just now",
 * "5 minutes ago", "2 days ago".
 *
 * Anything under a minute reads "just now" rather than counting seconds, which
 * would otherwise make a freshly posted comment look like it is ticking.
 */
export function relativeTime(
  value: string | number | Date,
  locale?: string
): string {
  const then = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(then.getTime())) return ""

  let delta = (then.getTime() - Date.now()) / 1000

  if (Math.abs(delta) < 45) return "just now"

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  for (const division of DIVISIONS) {
    if (Math.abs(delta) < division.amount) {
      return formatter.format(Math.round(delta), division.unit)
    }
    delta /= division.amount
  }

  return formatter.format(Math.round(delta), "year")
}

/**
 * Full timestamp for a tooltip or title attribute, e.g.
 * "2 August 2026 at 14:32".
 */
export function absoluteTime(
  value: string | number | Date,
  locale?: string
): string {
  const then = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(then.getTime())) return ""

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(then)
}
