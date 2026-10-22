/**
 * Tests for the shared date helpers (@comet/ui/dates).
 *
 * The code here was moved unchanged from the apps' lib/dates.ts in v0.3.0
 * (AO-2005). These cases pin the behaviour that AO-2012 fixed — the "day
 * before" bug for anyone outside UTC — so a later change cannot quietly bring
 * it back across every app at once.
 *
 * Run with:  npx tsx src/dates/dates.test.ts
 */

import {
  addDays,
  dayOfMoment,
  dayOfWeek,
  dayOrNull,
  daysBetween,
  DEFAULT_TIME_ZONE,
  formatDay,
  formatMoment,
  isDay,
  safeTimeZone,
  TZ_COOKIE,
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

console.log("Calendar days")
check("formatDay shows the day itself, not the day before", formatDay("2026-12-03") === "Dec 3, 2026", formatDay("2026-12-03"))
check("formatDay accepts a zone-less midnight", formatDay("2026-12-03T00:00:00") === "Dec 3, 2026")
check("formatDay refuses a moment with a zone", formatDay("2026-12-03T00:00:00Z") === "—")
check("formatDay refuses an impossible day", formatDay("2026-02-30") === "—")
check("formatDay uses the given fallback", formatDay(null, undefined, "en-US", "") === "")
check("isDay true for a real day", isDay("2024-02-29"))
check("isDay false for a non-leap Feb 29", !isDay("2026-02-29"))
check("dayOrNull strips a zone-less midnight", dayOrNull("2026-12-03T00:00:00.000") === "2026-12-03")
check("addDays crosses a month", addDays("2026-01-30", 3) === "2026-02-02", addDays("2026-01-30", 3))
check("addDays goes backwards", addDays("2026-03-01", -1) === "2026-02-28")
check("addDays on garbage gives ''", addDays("nope", 1) === "")
check("daysBetween across DST change is whole days", daysBetween("2026-03-07", "2026-03-09") === 2)
check("dayOfWeek: 2026-10-22 is a Thursday", dayOfWeek("2026-10-22") === 4)

console.log("Moments")
check("dayOfMoment: 01:30 UTC is still the previous day in New York",
  dayOfMoment("2026-10-16T01:30:00Z", "America/New_York") === "2026-10-15")
check("dayOfMoment: same moment in London is the 16th",
  dayOfMoment("2026-10-16T01:30:00Z", "Europe/London") === "2026-10-16")
check("formatMoment in the viewer's zone",
  formatMoment("2026-10-12T02:00:00Z", undefined, "America/Los_Angeles") === "Oct 11, 2026",
  formatMoment("2026-10-12T02:00:00Z", undefined, "America/Los_Angeles"))
check("formatMoment fallback for garbage", formatMoment("not a date") === "—")
check("formatMoment custom fallback", formatMoment("not a date", undefined, "UTC", "en-US", "") === "")
check("safeTimeZone rejects an unknown zone", safeTimeZone("Mars/Olympus") === DEFAULT_TIME_ZONE)
check("safeTimeZone rejects an over-long value", safeTimeZone("A".repeat(65)) === DEFAULT_TIME_ZONE)
check("safeTimeZone keeps a real zone", safeTimeZone("America/Chicago") === "America/Chicago")
check("cookie name unchanged (apps read it on the server)", TZ_COOKIE === "av_tz")

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
