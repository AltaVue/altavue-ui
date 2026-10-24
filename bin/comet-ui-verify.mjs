#!/usr/bin/env node
// CLI: `npx comet-ui-verify [appRoot]` — same check the build runs (AO-2063).
import { checkPlatformTopBar } from './verify.mjs'
const root = process.argv[2] || process.cwd()
const problems = checkPlatformTopBar(root)
if (problems.length) {
  console.error('[@comet/ui] top bar check FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}
console.log('[@comet/ui] top bar check passed.')
