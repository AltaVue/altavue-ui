/**
 * Tests for the shared unit-list logic (@comet/ui/units), AO-993.
 *
 * The expected answers for "what does this old spelling become?" were taken from the database's own function
 * public.unit_normalize() run against the real list, so these tests fail if the screen rule and the database rule
 * ever drift apart. (The full parity run -- 3,261 spellings, including every real Staging value -- was 0 differences
 * when this was written; see the AO-993 notes.) The list below is a 36-unit slice of the real list, with real
 * definitions and the real aliases that point at it.
 *
 * Run with:  npx tsx src/units/units.test.ts
 */

import {
  cleanAliasRows,
  cleanUnitRows,
  extendedCount,
  groupUnits,
  resolveUnit,
  searchUnits,
  spellingKey,
  unitHover,
  unitShort,
  unitsForMenu,
  QUANTITY_KINDS,
} from "./index"

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1
    console.log("  PASS  " + name)
  } else {
    failed += 1
    console.log("  FAIL  " + name + (detail === undefined ? "" : "  ->  " + JSON.stringify(detail)))
  }
}

const UNITS_RAW: unknown = [
  {
    "code": "EA",
    "name": "Each",
    "symbol": "ea",
    "category": "Count",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "One discrete item. Piece, unit and item are aliases when they mean one item.",
    "is_active": true,
    "sort_order": 10
  },
  {
    "code": "PAIR",
    "name": "Pair",
    "symbol": "pair",
    "category": "Count",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Two related items.",
    "is_active": true,
    "sort_order": 20
  },
  {
    "code": "FT",
    "name": "Foot",
    "symbol": "ft",
    "category": "Length",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Length. 12 inches. Linear foot is an alias, not a separate dimension.",
    "is_active": true,
    "sort_order": 520
  },
  {
    "code": "FT2",
    "name": "Square foot",
    "symbol": "ft²",
    "category": "Area",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Area. SF and SQFT are aliases.",
    "is_active": true,
    "sort_order": 630
  },
  {
    "code": "YD3",
    "name": "Cubic yard",
    "symbol": "yd³",
    "category": "Volume",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "27 cubic feet. CY and CUYD are aliases.",
    "is_active": true,
    "sort_order": 760
  },
  {
    "code": "HR",
    "name": "Hour",
    "symbol": "h",
    "category": "Time",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "60 minutes.",
    "is_active": true,
    "sort_order": 1290
  },
  {
    "code": "DAY",
    "name": "Day",
    "symbol": "d",
    "category": "Time",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "24-hour elapsed day. Workday duration must be defined separately.",
    "is_active": true,
    "sort_order": 1300
  },
  {
    "code": "WK",
    "name": "Week",
    "symbol": "wk",
    "category": "Time",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "7 days. Rental billing rules may differ.",
    "is_active": true,
    "sort_order": 1310
  },
  {
    "code": "LS",
    "name": "Lump sum",
    "symbol": "LS",
    "category": "Services",
    "use_kind": "billing_basis",
    "availability": "core",
    "definition": "One defined scope at a total price. Define inclusions.",
    "is_active": true,
    "sort_order": 1430
  },
  {
    "code": "LOT",
    "name": "Lot",
    "symbol": "lot",
    "category": "Services",
    "use_kind": "billing_basis",
    "availability": "core",
    "definition": "One defined group of goods or work. Specify contents or scope.",
    "is_active": true,
    "sort_order": 1450
  },
  {
    "code": "SET",
    "name": "Set",
    "symbol": "set",
    "category": "Count",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Defined group of components. Specify contents.",
    "is_active": true,
    "sort_order": 60
  },
  {
    "code": "CASE",
    "name": "Case",
    "symbol": "case",
    "category": "Packaging",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Specify inner packs and total contents.",
    "is_active": true,
    "sort_order": 130
  },
  {
    "code": "PK",
    "name": "Pack",
    "symbol": "pk",
    "category": "Packaging",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Specify item count or net contents per pack.",
    "is_active": true,
    "sort_order": 110
  },
  {
    "code": "TON_US",
    "name": "Short ton (U.S.)",
    "symbol": "short ton",
    "category": "Mass",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "2,000 pounds.",
    "is_active": true,
    "sort_order": 1030
  },
  {
    "code": "TON_UK",
    "name": "Long ton",
    "symbol": "long ton",
    "category": "Mass",
    "use_kind": "quantity",
    "availability": "extended",
    "definition": "2,240 pounds.",
    "is_active": true,
    "sort_order": 1090
  },
  {
    "code": "TONNE",
    "name": "Tonne (metric ton)",
    "symbol": "t",
    "category": "Mass",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "1,000 kilograms.",
    "is_active": true,
    "sort_order": 1070
  },
  {
    "code": "GAL_US",
    "name": "Gallon (U.S. liquid)",
    "symbol": "US gal",
    "category": "Volume",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "4 U.S. liquid quarts.",
    "is_active": true,
    "sort_order": 850
  },
  {
    "code": "ROOF_SQ",
    "name": "Roofing square",
    "symbol": "square",
    "category": "Area",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "100 square feet of roof area. Waste and bundle coverage are separate.",
    "is_active": true,
    "sort_order": 700
  },
  {
    "code": "QT_US",
    "name": "Quart (U.S. liquid)",
    "symbol": "US qt",
    "category": "Volume",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "2 U.S. liquid pints.",
    "is_active": true,
    "sort_order": 840
  },
  {
    "code": "QT_IMP",
    "name": "Quart (Imperial)",
    "symbol": "Imp qt",
    "category": "Volume",
    "use_kind": "quantity",
    "availability": "extended",
    "definition": "2 Imperial pints.",
    "is_active": true,
    "sort_order": 900
  },
  {
    "code": "BF",
    "name": "Board foot",
    "symbol": "bd ft",
    "category": "Volume",
    "use_kind": "quantity",
    "availability": "extended",
    "definition": "144 cubic inches. Typically nominal lumber dimensions.",
    "is_active": true,
    "sort_order": 950
  },
  {
    "code": "SEAT",
    "name": "User seat",
    "symbol": "seat",
    "category": "Services",
    "use_kind": "billing_basis",
    "availability": "core",
    "definition": "One licensed user. Specify billing term.",
    "is_active": true,
    "sort_order": 1560
  },
  {
    "code": "LICENSE",
    "name": "License",
    "symbol": "license",
    "category": "Services",
    "use_kind": "billing_basis",
    "availability": "core",
    "definition": "One license. Specify term and permitted use.",
    "is_active": true,
    "sort_order": 1550
  },
  {
    "code": "MI",
    "name": "Mile",
    "symbol": "mi",
    "category": "Length",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "International mile. 5,280 feet.",
    "is_active": true,
    "sort_order": 540
  },
  {
    "code": "JOB",
    "name": "Job",
    "symbol": "job",
    "category": "Services",
    "use_kind": "billing_basis",
    "availability": "core",
    "definition": "One defined job.",
    "is_active": true,
    "sort_order": 1440
  },
  {
    "code": "SHEET",
    "name": "Sheet",
    "symbol": "sheet",
    "category": "Packaging",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Specify sheet dimensions and thickness.",
    "is_active": true,
    "sort_order": 250
  },
  {
    "code": "BAG",
    "name": "Bag",
    "symbol": "bag",
    "category": "Packaging",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Specify count or net mass or volume.",
    "is_active": true,
    "sort_order": 150
  },
  {
    "code": "ROLL",
    "name": "Roll",
    "symbol": "roll",
    "category": "Packaging",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Specify total length or area and width.",
    "is_active": true,
    "sort_order": 210
  },
  {
    "code": "LB",
    "name": "Pound (avoirdupois)",
    "symbol": "lb",
    "category": "Mass",
    "use_kind": "quantity",
    "availability": "core",
    "definition": "Mass. Distinguish from pound-force.",
    "is_active": true,
    "sort_order": 1020
  },
  {
    "code": "J",
    "name": "Joule",
    "symbol": "J",
    "category": "Energy and power",
    "use_kind": "specification",
    "availability": "extended",
    "definition": "Energy.",
    "is_active": true,
    "sort_order": 1630
  },
  {
    "code": "KJ",
    "name": "Kilojoule",
    "symbol": "kJ",
    "category": "Energy and power",
    "use_kind": "specification",
    "availability": "extended",
    "definition": "1,000 joules.",
    "is_active": true,
    "sort_order": 1640
  },
  {
    "code": "MJ",
    "name": "Megajoule",
    "symbol": "MJ",
    "category": "Energy and power",
    "use_kind": "specification",
    "availability": "extended",
    "definition": "1,000,000 joules.",
    "is_active": true,
    "sort_order": 1650
  },
  {
    "code": "GROSS",
    "name": "Gross",
    "symbol": "gross",
    "category": "Count",
    "use_kind": "quantity",
    "availability": "extended",
    "definition": "144 items.",
    "is_active": true,
    "sort_order": 90
  },
  {
    "code": "MILLION",
    "name": "Million items",
    "symbol": "1000000 ea",
    "category": "Count",
    "use_kind": "quantity",
    "availability": "extended",
    "definition": "1,000,000 items.",
    "is_active": true,
    "sort_order": 100
  },
  {
    "code": "BLISTER",
    "name": "Blister pack",
    "symbol": "blister",
    "category": "Packaging",
    "use_kind": "quantity",
    "availability": "extended",
    "definition": "Specify count or contents.",
    "is_active": true,
    "sort_order": 400
  },
  {
    "code": "STRIP",
    "name": "Strip",
    "symbol": "strip",
    "category": "Packaging",
    "use_kind": "quantity",
    "availability": "extended",
    "definition": "Counted product or package. Specify length and contents.",
    "is_active": true,
    "sort_order": 410
  }
]

const ALIASES_RAW: unknown = [
  {
    "alias": "BF",
    "unit_code": "BF",
    "auto_map": true
  },
  {
    "alias": "CU YD",
    "unit_code": "YD3",
    "auto_map": false
  },
  {
    "alias": "CUYD",
    "unit_code": "YD3",
    "auto_map": false
  },
  {
    "alias": "CY",
    "unit_code": "YD3",
    "auto_map": false
  },
  {
    "alias": "DAYS",
    "unit_code": "DAY",
    "auto_map": true
  },
  {
    "alias": "FBM",
    "unit_code": "BF",
    "auto_map": true
  },
  {
    "alias": "GAL",
    "unit_code": "GAL_US",
    "auto_map": false
  },
  {
    "alias": "H",
    "unit_code": "HR",
    "auto_map": true
  },
  {
    "alias": "HOUR",
    "unit_code": "HR",
    "auto_map": true
  },
  {
    "alias": "HOURS",
    "unit_code": "HR",
    "auto_map": true
  },
  {
    "alias": "HRS",
    "unit_code": "HR",
    "auto_map": true
  },
  {
    "alias": "ITEM",
    "unit_code": "EA",
    "auto_map": false
  },
  {
    "alias": "LF",
    "unit_code": "FT",
    "auto_map": true
  },
  {
    "alias": "LIN FT",
    "unit_code": "FT",
    "auto_map": true
  },
  {
    "alias": "LINEAR FOOT",
    "unit_code": "FT",
    "auto_map": true
  },
  {
    "alias": "M",
    "unit_code": null,
    "auto_map": false
  },
  {
    "alias": "MT",
    "unit_code": "TONNE",
    "auto_map": false
  },
  {
    "alias": "PACKAGE",
    "unit_code": "PK",
    "auto_map": false
  },
  {
    "alias": "PC",
    "unit_code": "EA",
    "auto_map": false
  },
  {
    "alias": "PCS",
    "unit_code": "EA",
    "auto_map": false
  },
  {
    "alias": "PIECE",
    "unit_code": "EA",
    "auto_map": false
  },
  {
    "alias": "PKG",
    "unit_code": "PK",
    "auto_map": false
  },
  {
    "alias": "PR",
    "unit_code": "PAIR",
    "auto_map": true
  },
  {
    "alias": "SF",
    "unit_code": "FT2",
    "auto_map": true
  },
  {
    "alias": "SHT",
    "unit_code": "SHEET",
    "auto_map": true
  },
  {
    "alias": "SQ",
    "unit_code": "ROOF_SQ",
    "auto_map": false
  },
  {
    "alias": "SQ FT",
    "unit_code": "FT2",
    "auto_map": true
  },
  {
    "alias": "SQFT",
    "unit_code": "FT2",
    "auto_map": true
  },
  {
    "alias": "SQUARE",
    "unit_code": "ROOF_SQ",
    "auto_map": false
  },
  {
    "alias": "ST",
    "unit_code": "TON_US",
    "auto_map": false
  },
  {
    "alias": "TN",
    "unit_code": "TON_US",
    "auto_map": false
  },
  {
    "alias": "TON",
    "unit_code": "TON_US",
    "auto_map": false
  },
  {
    "alias": "TONNE",
    "unit_code": "TONNE",
    "auto_map": false
  },
  {
    "alias": "UNIT",
    "unit_code": "EA",
    "auto_map": false
  },
  {
    "alias": "WEEKS",
    "unit_code": "WK",
    "auto_map": true
  },
  {
    "alias": "WKS",
    "unit_code": "WK",
    "auto_map": true
  }
]

/** [what was typed or stored, the official code the database converts it to -- or null when a person must choose]. */
const DATABASE_SAYS: [string, string | null][] = [
  [
    "HRS",
    "HR"
  ],
  [
    "hr",
    "HR"
  ],
  [
    "hours",
    "HR"
  ],
  [
    "Hours",
    "HR"
  ],
  [
    "each",
    "EA"
  ],
  [
    "Each",
    "EA"
  ],
  [
    "EA",
    "EA"
  ],
  [
    "ea",
    "EA"
  ],
  [
    "sq ft",
    "FT2"
  ],
  [
    "SQ FT",
    "FT2"
  ],
  [
    "TON",
    null
  ],
  [
    "TN",
    null
  ],
  [
    "GAL",
    null
  ],
  [
    "gal",
    null
  ],
  [
    "CY",
    null
  ],
  [
    "SQ",
    null
  ],
  [
    "QT",
    null
  ],
  [
    "NIGHT",
    null
  ],
  [
    "board",
    null
  ],
  [
    "credit",
    null
  ],
  [
    "licence",
    null
  ],
  [
    "plan",
    null
  ],
  [
    "LS",
    "LS"
  ],
  [
    "lump sum",
    "LS"
  ],
  [
    "LOT",
    "LOT"
  ],
  [
    "lot",
    "LOT"
  ],
  [
    "job",
    "JOB"
  ],
  [
    "pack",
    "PK"
  ],
  [
    "sheet",
    "SHEET"
  ],
  [
    "seat",
    "SEAT"
  ],
  [
    "PR",
    "PAIR"
  ],
  [
    "MI",
    "MI"
  ],
  [
    "3 permits",
    null
  ],
  [
    "",
    null
  ],
  [
    "   ",
    null
  ],
  [
    "FLT",
    null
  ],
  [
    "x",
    null
  ],
  [
    "Ft2",
    "FT2"
  ],
  [
    "ft2",
    "FT2"
  ],
  [
    "FT2",
    "FT2"
  ]
]

const units = cleanUnitRows(UNITS_RAW)
const aliases = cleanAliasRows(ALIASES_RAW)
const codeOf = (v: string | null) => {
  const r = resolveUnit(v, units, aliases)
  return r.status === "official" || r.status === "convertible" ? r.unit.code : null
}

console.log("Spelling clean-up")
check("spaces at both ends go, inner runs of white space collapse, case is ignored", spellingKey("  sq \t  ft ") === "SQ FT", spellingKey("  sq \t  ft "))

console.log("Row clean-up")
const dirty = cleanUnitRows([
  { code: "OK", name: "Fine", symbol: "ok", category: "Count", use_kind: "quantity", availability: "core", definition: "d", is_active: true, sort_order: 2 },
  { code: "", name: "No code", use_kind: "quantity", availability: "core" },
  { code: "BAD1", name: "Bad kind", use_kind: "weird", availability: "core" },
  { code: "BAD2", name: "Bad availability", use_kind: "quantity", availability: "sometimes" },
  { code: "OFF", name: "Retired", use_kind: "quantity", availability: "core", is_active: false },
  { code: "FIRST", name: "First", use_kind: "quantity", availability: "core", sort_order: 1 },
  "not a row", null, 7,
])
check("malformed and retired rows are dropped, never guessed at", dirty.map((u) => u.code).join(",") === "FIRST,OK", dirty.map((u) => u.code))
check("a missing symbol falls back to the code", dirty[0].symbol === "FIRST")
check("rows come back in list order", dirty[0].sort_order <= dirty[1].sort_order)
check("something that is not a list gives an empty list", cleanUnitRows({}).length === 0 && cleanAliasRows("x").length === 0)

console.log("What the database does with a stored value (parity)")
for (const [text, want] of DATABASE_SAYS) {
  const got = codeOf(text)
  check(JSON.stringify(text) + " -> " + (want ?? "needs a unit"), got === want, { got })
}
check("an empty value is 'empty'", resolveUnit("   ", units, aliases).status === "empty" && resolveUnit(null, units, aliases).status === "empty")
check("an official code is 'official'; another case is 'convertible'", resolveUnit("FT2", units, aliases).status === "official" && resolveUnit("ft2", units, aliases).status === "convertible")
const ton = resolveUnit("TON", units, aliases)
check("TON needs a unit and suggests the short ton", ton.status === "needs_unit" && ton.suggestion?.code === "TON_US", ton)
const night = resolveUnit("NIGHT", units, aliases)
check("NIGHT needs a unit and has no suggestion", night.status === "needs_unit" && night.suggestion === null, night)
check("the original text is kept for the 'was ...' note", night.status === "needs_unit" && night.text === "NIGHT")

console.log("What a menu offers")
const core = unitsForMenu(units)
const all = unitsForMenu(units, { showAll: true })
check("a quantity menu never offers a specification unit, even with Show all", all.every((u) => u.use_kind !== "specification") && !all.some((u) => ["J", "KJ", "MJ"].includes(u.code)))
check("Core only by default; Show all adds the Extended ones", core.every((u) => u.availability === "core") && all.length > core.length)
check("extendedCount is exactly what Show all adds", extendedCount(units) === all.length - core.length && extendedCount(units) === units.filter((u) => u.availability === "extended" && u.use_kind !== "specification").length, extendedCount(units))
check("a menu can ask for specification units explicitly", unitsForMenu(units, { kinds: ["specification"], showAll: true }).length === 3)
check("billing-basis units (lump sum, lot, seat) are in quantity menus", ["LS", "LOT", "SEAT"].every((c) => core.some((u) => u.code === c)))
check("QUANTITY_KINDS is quantity plus billing basis", QUANTITY_KINDS.join(",") === "quantity,billing_basis")

console.log("Grouping")
const groups = groupUnits(core)
check("every unit appears in exactly one group", groups.reduce((n, g) => n + g.units.length, 0) === core.length)
check("groups follow the list's own order (Count first)", groups[0].category === "Count", groups.map((g) => g.category))

console.log("Typing finds units")
const top = (q: string) => searchUnits(units, aliases, q)[0]?.code
check('"hrs" finds HR', top("hrs") === "HR")
check('"HR" finds HR before anything else', top("HR") === "HR")
check('"sq ft" finds FT2', top("sq ft") === "FT2")
check('"each" finds EA', top("each") === "EA")
check('"square foot" finds FT2', top("square foot") === "FT2")
check('"cu yd" finds YD3', top("cu yd") === "YD3")
check('"gross" finds an Extended unit without Show all', top("gross") === "GROSS")
check('a code beats a word: "day" finds DAY', top("day") === "DAY")
check("nothing typed finds nothing", searchUnits(units, aliases, "   ").length === 0)
check("a made-up word finds nothing", searchUnits(units, aliases, "zzzzqq").length === 0)
check("search never returns a specification unit", searchUnits(units, aliases, "j").every((u) => u.use_kind !== "specification"))
check("an alias a person must choose still FINDS its unit (TON offers the short ton)", searchUnits(units, aliases, "ton").some((u) => u.code === "TON_US"))

console.log("Display")
const ft2 = units.find((u) => u.code === "FT2")!
check("the symbol is what people read", unitShort(ft2) === ft2.symbol && ft2.symbol !== "")
check("the hover text carries the name, the code and the meaning", unitHover(ft2).includes("Square foot") && unitHover(ft2).includes("(FT2)") && unitHover(ft2).includes(ft2.definition))

console.log("\n" + passed + " passed, " + failed + " failed")
if (failed > 0) process.exit(1)
