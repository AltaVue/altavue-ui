import { formatMoment } from '../dates'

// AO-1999 / AO-2005 -- contract value, contract type and margin: the shared,
// database-free part. Imported as @comet/ui/finance.
//
// What lives here: the contract types, the ProjectFinancials shape, the clean-up
// of a raw `project_financials` row, formatMoney, and contractSummary -- every
// customer-facing sentence about contract value and margin. One copy, so every
// module describes the same numbers in the same words.
//
// What does NOT live here: reading the `project_financials` view and the
// user_can_access_budget permission check. Those use the app's own Supabase
// client and stay in each app's lib/projectFinancials.ts, which re-exports this
// file. This package must never acquire a database or auth dependency.
//
// The view only returns a row for a project the caller may see money for:
// finance.view AND (org admin OR the project's PM) -- the same rule as the
// budget. A Member gets no rows at all, so every screen that uses this renders
// nothing for them rather than a zero.
//
// House rule (AO-1873, AO-1969, AO-1104): a missing figure is a sentence naming
// what is missing, never $0.

export const CONTRACT_TYPES = [
  'Fixed Fee',
  'Time & Materials',
  'Milestone',
  'Cost Plus',
  'Not-to-Exceed',
] as const
export type ContractType = (typeof CONTRACT_TYPES)[number]

export function isContractType(v: unknown): v is ContractType {
  return typeof v === 'string' && (CONTRACT_TYPES as readonly string[]).includes(v)
}

export interface ProjectFinancials {
  project_id: string
  org_id: string
  project_name: string | null
  baseline_status: string | null
  contract_type: ContractType | null
  original_contract_value: number | null
  value_source: 'manual' | 'estimate' | null
  source_estimate_version_id: string | null
  source_set_at: string | null
  contract_updated_at: string | null
  approved_co_count: number
  approved_co_price_total: number
  approved_co_unpriced_count: number
  approved_co_cost_total: number
  pending_co_count: number
  pending_co_price_total: number
  closed_co_outcome_unknown_count: number
  current_contract_value: number | null
  cost_budget: number | null
  cost_budget_version: number | null
  actual_cost_to_date: number | null
  cost_actuals_through: string | null
  cost_actual_weeks: number
  margin_applicable: boolean | null
  budgeted_margin_amount: number | null
  budgeted_margin_pct: number | null
  cost_to_date_pct_of_contract: number | null
  final_margin_amount: number | null
  final_margin_pct: number | null
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Turns a raw `project_financials` row into a typed, null-safe ProjectFinancials. */
export function normaliseProjectFinancials(r: Record<string, unknown>): ProjectFinancials {
  return {
    project_id: String(r.project_id),
    org_id: String(r.org_id),
    project_name: (r.project_name as string | null) ?? null,
    baseline_status: (r.baseline_status as string | null) ?? null,
    contract_type: isContractType(r.contract_type) ? r.contract_type : null,
    original_contract_value: numOrNull(r.original_contract_value),
    value_source: r.value_source === 'estimate' || r.value_source === 'manual' ? r.value_source : null,
    source_estimate_version_id: (r.source_estimate_version_id as string | null) ?? null,
    source_set_at: (r.source_set_at as string | null) ?? null,
    contract_updated_at: (r.contract_updated_at as string | null) ?? null,
    approved_co_count: num(r.approved_co_count),
    approved_co_price_total: num(r.approved_co_price_total),
    approved_co_unpriced_count: num(r.approved_co_unpriced_count),
    approved_co_cost_total: num(r.approved_co_cost_total),
    pending_co_count: num(r.pending_co_count),
    pending_co_price_total: num(r.pending_co_price_total),
    closed_co_outcome_unknown_count: num(r.closed_co_outcome_unknown_count),
    current_contract_value: numOrNull(r.current_contract_value),
    cost_budget: numOrNull(r.cost_budget),
    cost_budget_version: numOrNull(r.cost_budget_version),
    actual_cost_to_date: numOrNull(r.actual_cost_to_date),
    cost_actuals_through: (r.cost_actuals_through as string | null) ?? null,
    cost_actual_weeks: num(r.cost_actual_weeks),
    margin_applicable: typeof r.margin_applicable === 'boolean' ? r.margin_applicable : null,
    budgeted_margin_amount: numOrNull(r.budgeted_margin_amount),
    budgeted_margin_pct: numOrNull(r.budgeted_margin_pct),
    cost_to_date_pct_of_contract: numOrNull(r.cost_to_date_pct_of_contract),
    final_margin_amount: numOrNull(r.final_margin_amount),
    final_margin_pct: numOrNull(r.final_margin_pct),
  }
}

/** Whole US dollars, e.g. $1,250,000. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

const pct = (v: number) => `${v.toFixed(1)}%`

export interface ContractSummary {
  /** Headline: the current contract value, or a sentence saying it is missing. */
  contractText: string
  hasContractValue: boolean
  /** "Original $X + $Y approved change orders", or null when there is nothing to add. */
  breakdownText: string | null
  /** Where the original value came from. */
  sourceText: string | null
  /** Budgeted margin, or a sentence saying why it cannot be shown. */
  marginText: string
  hasMargin: boolean
  /** Final margin once the project is closed, else null. */
  finalMarginText: string | null
  /** Actual cost to date against the contract, or a sentence. */
  costToDateText: string
  /** Things the reader must know before trusting the numbers. */
  notes: string[]
}

export interface ContractSummaryOptions {
  /**
   * Where the reader goes to create a cost budget, for an app that has no
   * Budget tab of its own (the Launcher passes e.g. 'AltaVue Vantage').
   * Omitted = "the Budget tab", for an app where that tab is on this project.
   */
  budgetLocation?: string
}

/**
 * AO-2012: `timeZone` is the zone source_set_at (a timestamp) is shown in —
 * getRequestTimeZone() on the server, useViewerTimeZone() in a client
 * component. Omitted = the runtime's own zone (UTC on the server).
 */
export function contractSummary(
  f: ProjectFinancials,
  timeZone?: string,
  options: ContractSummaryOptions = {},
): ContractSummary {
  const hasContractValue = f.current_contract_value != null
  const contractText = hasContractValue ? formatMoney(f.current_contract_value as number) : 'Contract value not entered'

  let breakdownText: string | null = null
  if (f.original_contract_value != null && f.approved_co_price_total !== 0) {
    const sign = f.approved_co_price_total < 0 ? '−' : '+'
    breakdownText = `Original ${formatMoney(f.original_contract_value)} ${sign} ${formatMoney(Math.abs(f.approved_co_price_total))} approved change orders`
  } else if (f.original_contract_value != null) {
    breakdownText = `Original ${formatMoney(f.original_contract_value)}, no priced change orders approved`
  }

  let sourceText: string | null = null
  if (f.original_contract_value != null) {
    if (f.value_source === 'estimate') {
      // An unreadable timestamp gives no date rather than a dash (taken from the Launcher copy).
      const when = f.source_set_at ? formatMoment(f.source_set_at, { month: 'short', day: 'numeric', year: 'numeric' }, timeZone, 'en-US', '') || null : null
      sourceText = when ? `From the approved estimate, ${when}` : 'From the approved estimate'
    } else {
      sourceText = 'Entered by hand'
    }
  }

  let marginText: string
  let hasMargin = false
  if (!hasContractValue) {
    marginText = 'Margin needs a contract value.'
  } else if (f.contract_type == null) {
    marginText = 'Choose a contract type to see margin.'
  } else if (f.margin_applicable === false) {
    marginText = `Margin is not shown for ${f.contract_type} contracts — the customer pays for actual time and cost, so the contract value is not a fixed price.`
  } else if (f.cost_budget == null) {
    const where = options.budgetLocation ? ` of this project in ${options.budgetLocation}` : ''
    marginText = `Margin needs a cost budget — create a baseline on the Budget tab${where}.`
  } else if (f.budgeted_margin_amount != null) {
    hasMargin = true
    const pctText = f.budgeted_margin_pct != null ? ` (${pct(f.budgeted_margin_pct)})` : ''
    marginText = `${formatMoney(f.budgeted_margin_amount)}${pctText} budgeted`
    if (f.contract_type === 'Not-to-Exceed') marginText += ' if billed to the ceiling'
  } else {
    marginText = 'Margin could not be worked out.'
  }

  const finalMarginText =
    f.final_margin_amount != null
      ? `Final margin ${formatMoney(f.final_margin_amount)}${f.final_margin_pct != null ? ` (${pct(f.final_margin_pct)})` : ''}`
      : null

  let costToDateText: string
  if (f.actual_cost_to_date == null) {
    costToDateText = 'No actual costs entered yet'
  } else if (f.cost_to_date_pct_of_contract != null) {
    costToDateText = `${formatMoney(f.actual_cost_to_date)} spent — ${pct(f.cost_to_date_pct_of_contract)} of contract value`
  } else {
    costToDateText = `${formatMoney(f.actual_cost_to_date)} spent`
  }

  const notes: string[] = []
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
  if (f.approved_co_unpriced_count > 0) {
    notes.push(
      `${f.approved_co_unpriced_count} approved change ${plural(f.approved_co_unpriced_count, 'order has', 'orders have')} no customer price entered and ${plural(f.approved_co_unpriced_count, 'is', 'are')} not in the contract value.`,
    )
  }
  if (f.closed_co_outcome_unknown_count > 0) {
    notes.push(
      `${f.closed_co_outcome_unknown_count} closed change ${plural(f.closed_co_outcome_unknown_count, 'order was', 'orders were')} closed before AltaVue recorded whether ${plural(f.closed_co_outcome_unknown_count, 'it was', 'they were')} approved, so ${plural(f.closed_co_outcome_unknown_count, 'its', 'their')} price is not included.`,
    )
  }
  if (hasMargin && f.approved_co_cost_total > 0) {
    notes.push(
      `Approved change-order cost (${formatMoney(f.approved_co_cost_total)}) is not yet in the cost budget, so budgeted margin may read high.`,
    )
  }

  return {
    contractText,
    hasContractValue,
    breakdownText,
    sourceText,
    marginText,
    hasMargin,
    finalMarginText,
    costToDateText,
    notes,
  }
}
