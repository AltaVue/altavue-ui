// @comet/ui/topbar — the reports menu (AO-2063).
//
// The list comes from the report_registry table, read by each app's connector
// with the signed-in user's own client. This file is pure: it groups rows and
// makes their links safe. Reports live in AltaVue Home (Launcher); from any
// other module they open in a new tab, as before.

import { LAUNCHER_URL, toEnvUrl } from './env'

export interface ReportRow {
  id: string
  slug: string
  title: string
  description: string | null
  category: string
  route: string
  icon: string | null
  sort_order: number
}

export interface ReportGroup {
  category: string
  reports: ReportRow[]
}

/** Only same-site absolute paths are accepted ("/reports/x"); anything else is dropped. */
export function isSafeReportRoute(route: unknown): route is string {
  return typeof route === 'string' && /^\/[A-Za-z0-9\-_/]*(\?[A-Za-z0-9\-_=&%.]*)?$/.test(route) && !route.startsWith('//')
}

/** Launcher URL for a report route in the current environment. */
export function reportUrl(route: string): string {
  return toEnvUrl(LAUNCHER_URL + route)
}

/** Rows (already ordered by category, sort_order) → groups; unsafe routes dropped. */
export function groupReports(rows: readonly ReportRow[]): ReportGroup[] {
  const out: ReportGroup[] = []
  for (const row of rows) {
    if (!row || !isSafeReportRoute(row.route)) continue
    const last = out[out.length - 1]
    if (last && last.category === row.category) last.reports.push(row)
    else out.push({ category: row.category, reports: [row] })
  }
  return out
}
