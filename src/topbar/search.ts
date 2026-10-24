// @comet/ui/topbar — global search results and where they open (AO-2063).
//
// The query itself runs in each app's connector (comet_search RPC through the
// app's own signed-in Supabase client — SECURITY INVOKER, org-scoped, RLS and
// the AO-2019 seat gate apply). This file is pure: it validates each row and
// decides where it opens. Because the same bar runs in every module, every
// destination is an absolute, environment-aware URL — never a path relative to
// whichever app the bar happens to be in.
//
// Moved from Agile's lib/agile/search.ts (crossResultLink, labels). Every id
// placed into a URL is checked to be a UUID (or an integer for item numbers)
// first, so a row can never inject anything into a link.

import { toEnvUrl } from './env'

export interface SearchResultRow {
  module: string
  entity_type: string
  entity_id: string
  entity_number: number | null
  title: string
  project_id: string | null
  project_name: string | null
  methodology: string | null
}

export const SEARCH_MODULE_LABELS: Record<string, string> = {
  agile: 'Agile',
  tracker: 'Vantage',
  scope: 'Scope',
  scheduler: 'Scheduler',
  platform: 'Project',
}

export const SEARCH_ENTITY_LABELS: Record<string, string> = {
  project: 'Project',
  work_item: 'Work Item',
  milestone: 'Milestone',
  risk: 'Risk',
  change: 'Change',
  decision: 'Decision',
  person: 'Person',
  scoping_project: 'Scoping Project',
  requirement: 'Requirement',
  scoping_risk: 'Risk',
  scoping_stakeholder: 'Stakeholder',
  activity: 'Activity',
  baseline: 'Baseline',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const AGILE = 'https://agile.comet-app.com'
const TRACKER = 'https://tracker.comet-app.com'
const SCOPE = 'https://scope.comet-app.com'
const SCHEDULER = 'https://scheduler.comet-app.com'

/** Canonical (production, comet-app.com) URL for a row, or null if it has no safe target. */
export function canonicalResultUrl(r: SearchResultRow): string | null {
  const pid = r.project_id
  if (!pid || !UUID.test(pid)) return null
  const p = encodeURIComponent(pid)
  const isAgileProject = r.methodology === 'agile' || r.methodology === 'hybrid'
  const num = Number.isInteger(r.entity_number) && (r.entity_number as number) > 0 ? (r.entity_number as number) : null

  switch (r.entity_type) {
    case 'work_item':
      if (r.module === 'agile' && num != null) return `${AGILE}/projects/${p}/items/${num}`
      return `${TRACKER}/dashboard/projects/${p}/tasks`
    case 'milestone':
      return `${TRACKER}/dashboard/projects/${p}/milestones`
    case 'risk':
      return `${TRACKER}/dashboard/projects/${p}/risks`
    case 'change':
      return `${TRACKER}/dashboard/projects/${p}/changes`
    case 'decision':
      return `${TRACKER}/dashboard/projects/${p}/decisions`
    case 'person':
      if (r.module === 'agile') return `${AGILE}/stakeholders/${p}`
      return `${TRACKER}/dashboard/projects/${p}/stakeholders`
    case 'scoping_project':
    case 'requirement':
    case 'scoping_risk':
    case 'scoping_stakeholder':
      return `${SCOPE}/projects/${p}`
    case 'activity':
      if (!UUID.test(r.entity_id)) return `${SCHEDULER}/schedule/${p}`
      return `${SCHEDULER}/schedule/${p}?focus=${encodeURIComponent(r.entity_id)}`
    case 'baseline':
      return `${SCHEDULER}/baselines/${p}`
    case 'project':
      return isAgileProject ? `${AGILE}/dashboard` : `${TRACKER}/dashboard/projects/${p}`
    default:
      return null
  }
}

/** Where a row opens in the environment the browser is on. */
export function resultUrl(r: SearchResultRow): string | null {
  const u = canonicalResultUrl(r)
  return u ? toEnvUrl(u) : null
}

/** True for strings the search will send (mirrors comet_search's own floor). */
export function isSearchableQuery(q: string): boolean {
  const t = q.trim()
  return t.length >= 2 || /^\d$/.test(t)
}
