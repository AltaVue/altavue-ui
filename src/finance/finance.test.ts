/**
 * Tests for the shared contract-value and margin wording (@comet/ui/finance).
 *
 * Every string asserted here is shown to customers on a money screen in
 * Vantage, the Launcher and Agile. The house rule (AO-1873, AO-1969, AO-1104)
 * is that a missing figure is a sentence naming what is missing, never $0 —
 * several cases below exist only to hold that line.
 *
 * Run with:  npx tsx src/finance/finance.test.ts
 */

import {
  contractSummary,
  CONTRACT_TYPES,
  formatMoney,
  isContractType,
  normaliseProjectFinancials,
  type ProjectFinancials,
} from "./index"

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1
    console.log("  PASS  " + name)
  } else {
    failed += 1
    console.log("  FAIL  " + name + (detail === undefined ? "" : "  →  " + JSON.stringify(detail)))
  }
}

function base(over: Partial<ProjectFinancials> = {}): ProjectFinancials {
  return normaliseProjectFinancials({ project_id: "p1", org_id: "o1", ...over } as Record<string, unknown>)
}

console.log("Row clean-up")
const raw = normaliseProjectFinancials({
  project_id: "p1",
  org_id: "o1",
  contract_type: "Lump Sum", // not a type we know
  original_contract_value: "1000.50", // Postgres numeric arrives as a string
  cost_budget: "",
  approved_co_count: null,
  value_source: "something-else",
  margin_applicable: "true", // not a real boolean
})
check("numeric strings become numbers", raw.original_contract_value === 1000.5)
check("unknown contract type becomes null", raw.contract_type === null)
check("empty string becomes null, not 0", raw.cost_budget === null)
check("missing counts become 0", raw.approved_co_count === 0)
check("unknown value source becomes null", raw.value_source === null)
check("a string 'true' is not treated as a boolean", raw.margin_applicable === null)
check("five contract types, all recognised", CONTRACT_TYPES.length === 5 && CONTRACT_TYPES.every(isContractType))

console.log("Missing figures are sentences, never $0")
const empty = contractSummary(base())
check("no contract value", empty.contractText === "Contract value not entered" && !empty.hasContractValue)
check("no margin without a contract value", empty.marginText === "Margin needs a contract value.")
check("no costs yet", empty.costToDateText === "No actual costs entered yet")
check("no breakdown, no source", empty.breakdownText === null && empty.sourceText === null)
check("nothing anywhere reads $0", !JSON.stringify(empty).includes("$0"))

const noType = contractSummary(base({ current_contract_value: 500000, original_contract_value: 500000 }))
check("value but no type", noType.marginText === "Choose a contract type to see margin.")

console.log("Where to create a budget (the one sentence that differs by app)")
const noBudget = base({ current_contract_value: 500000, original_contract_value: 500000, contract_type: "Fixed Fee", margin_applicable: true })
check("default wording (an app whose Budget tab is on this project)",
  contractSummary(noBudget).marginText === "Margin needs a cost budget — create a baseline on the Budget tab.",
  contractSummary(noBudget).marginText)
check("Launcher wording, unchanged from the AO-1999 Launcher copy",
  contractSummary(noBudget, undefined, { budgetLocation: "AltaVue Vantage" }).marginText ===
    "Margin needs a cost budget — create a baseline on the Budget tab of this project in AltaVue Vantage.")

console.log("Full picture")
const full = contractSummary(
  base({
    contract_type: "Fixed Fee",
    original_contract_value: 1000000,
    approved_co_price_total: 50000,
    current_contract_value: 1050000,
    margin_applicable: true,
    cost_budget: 800000,
    budgeted_margin_amount: 250000,
    budgeted_margin_pct: 23.8095,
    actual_cost_to_date: 200000,
    cost_to_date_pct_of_contract: 19.0476,
    approved_co_cost_total: 30000,
    value_source: "manual",
  }),
)
check("headline", full.contractText === "$1,050,000", full.contractText)
check("breakdown", full.breakdownText === "Original $1,000,000 + $50,000 approved change orders", full.breakdownText)
check("source", full.sourceText === "Entered by hand")
check("margin", full.marginText === "$250,000 (23.8%) budgeted" && full.hasMargin, full.marginText)
check("cost to date", full.costToDateText === "$200,000 spent — 19.0% of contract value", full.costToDateText)
check("warns that CO cost is not in the budget", full.notes.some((n) => n.includes("$30,000") && n.includes("may read high")))

const deduct = contractSummary(base({ original_contract_value: 1000000, approved_co_price_total: -25000, current_contract_value: 975000 }))
check("a deduct change order shows a minus, not a negative number",
  deduct.breakdownText === "Original $1,000,000 − $25,000 approved change orders", deduct.breakdownText)

const tm = contractSummary(base({ current_contract_value: 1, contract_type: "Time & Materials", margin_applicable: false }))
check("T&M explains why there is no margin", tm.marginText.startsWith("Margin is not shown for Time & Materials contracts"))

const nte = contractSummary(base({ current_contract_value: 1, contract_type: "Not-to-Exceed", margin_applicable: true, cost_budget: 1, budgeted_margin_amount: 10, budgeted_margin_pct: null }))
check("NTE margin says 'if billed to the ceiling'", nte.marginText === "$10 budgeted if billed to the ceiling", nte.marginText)

console.log("Approved estimate as the source")
const est = (when: string | null) =>
  contractSummary(base({ original_contract_value: 1, current_contract_value: 1, value_source: "estimate", source_set_at: when }), "America/New_York").sourceText
check("date shown in the viewer's zone (02:00 UTC is the day before in New York)",
  est("2026-10-12T02:00:00Z") === "From the approved estimate, Oct 11, 2026", est("2026-10-12T02:00:00Z"))
check("unreadable timestamp gives no date — not a dash", est("garbage") === "From the approved estimate", est("garbage"))
check("no timestamp gives no date", est(null) === "From the approved estimate")

console.log("Plurals in the notes")
const one = contractSummary(base({ approved_co_unpriced_count: 1, closed_co_outcome_unknown_count: 1 }))
const two = contractSummary(base({ approved_co_unpriced_count: 2 }))
check("one unpriced CO", one.notes[0] === "1 approved change order has no customer price entered and is not in the contract value.", one.notes[0])
check("two unpriced COs", two.notes[0] === "2 approved change orders have no customer price entered and are not in the contract value.", two.notes[0])
check("closed CO with unknown outcome", one.notes[1]?.startsWith("1 closed change order was closed before AltaVue recorded whether it was approved"))

check("formatMoney rounds to whole dollars", formatMoney(1234.56) === "$1,235")

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
