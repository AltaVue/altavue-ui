// Tests for the build-time top-bar check (AO-2063). Builds throwaway apps in
// a temp folder — one clean, then one broken in each way the check must catch.
// Run with:  node bin/verify.test.mjs
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as verifyModule from './verify.mjs'
import { checkPlatformTopBar, installedVersion } from './verify.mjs'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name) } else { failed++; console.log('  FAIL  ' + name + (detail ? '  →  ' + JSON.stringify(detail) : '')) }
}
function put(root, rel, text) { const p = join(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text) }

function cleanApp(module = 'agile') {
  const root = mkdtempSync(join(tmpdir(), 'avtb-'))
  put(root, 'package.json', JSON.stringify({ dependencies: { '@comet/ui': `github:AltaVue/altavue-ui#v${installedVersion()}` } }))
  put(root, 'lib/platformModule.ts', `import type { PlatformModuleKey } from '@comet/ui/topbar'\nexport const PLATFORM_MODULE: PlatformModuleKey = '${module}'\n`)
  cpSync(join(PKG, 'connector', 'PlatformTopBarConnector.tsx'), join(root, 'components', 'PlatformTopBarConnector.tsx'), { recursive: true })
  put(root, 'app/(app)/layout.tsx', "import PlatformTopBarConnector from '@/components/PlatformTopBarConnector'\nexport default function L({children}){return <><PlatformTopBarConnector />{children}</>}\n")
  put(root, 'app/(app)/backlog/page.tsx', 'export default function P(){return null}\n')
  put(root, 'app/(app)/projects/[projectId]/budget/page.tsx', 'export default function P(){return null}\n')
  put(root, 'app/login/page.tsx', 'export default function P(){return null}\n')
  put(root, 'app/page.tsx', 'export default function P(){return null}\n')
  put(root, 'node_modules/x/TopBar.tsx', 'ignored\n')
  return root
}
function run(name, mutate, expectFragment) {
  const root = cleanApp()
  try {
    mutate(root)
    const problems = checkPlatformTopBar(root)
    if (expectFragment === null) check(name, problems.length === 0, problems)
    else check(name, problems.some((p) => p.includes(expectFragment)), problems)
  } finally { rmSync(root, { recursive: true, force: true }) }
}

{
  const declared = [...readFileSync(join(PKG, 'bin', 'verify.d.mts'), 'utf8').matchAll(/export declare (?:const|function) (\w+)/g)].map((m) => m[1]).sort()
  const actual = Object.keys(verifyModule).sort()
  check('verify.d.mts declares exactly what verify.mjs exports', JSON.stringify(declared) === JSON.stringify(actual), { declared, actual })
  const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'))
  check('package exports ./verify with types', pkg.exports['./verify']?.types === './bin/verify.d.mts' && pkg.exports['./verify']?.default === './bin/verify.mjs')
}
run('clean app passes', () => {}, null)
run('CRLF connector still passes', (r) => { const p = join(r, 'components/PlatformTopBarConnector.tsx'); writeFileSync(p, readFileSync(p, 'utf8').replace(/\n/g, '\r\n')) }, null)
run('signed-in page outside (app) fails', (r) => put(r, 'app/kanban/page.tsx', 'x'), 'app/kanban/page.tsx has no top bar')
run('edited connector fails', (r) => { const p = join(r, 'components/PlatformTopBarConnector.tsx'); writeFileSync(p, readFileSync(p, 'utf8') + '\n// tweak\n') }, 'differs from the canonical copy')
run('missing connector fails', (r) => rmSync(join(r, 'components/PlatformTopBarConnector.tsx')), 'PlatformTopBarConnector.tsx is missing')
run('layout without the bar fails', (r) => put(r, 'app/(app)/layout.tsx', 'export default function L({children}){return children}\n'), 'must import and render')
run('missing (app) layout fails', (r) => rmSync(join(r, 'app/(app)/layout.tsx')), 'layout.tsx is missing')
run('local TopBar copy fails', (r) => put(r, 'components/TopBar.tsx', 'x'), 'local copy of a top-bar piece')
run('local AppSwitcher in app/components fails', (r) => put(r, 'app/components/AppSwitcher.tsx', 'x'), 'local copy')
run('importing an old piece fails', (r) => put(r, 'app/(app)/x/page.tsx', "import R from '../../_to_delete/ReportsDropdown'\n"), 'imports "../../_to_delete/ReportsDropdown"')
run('second bar rendered elsewhere fails', (r) => put(r, 'components/Other.tsx', "import { PlatformTopBar } from '@comet/ui/topbar'\n"), 'only the connector may render the bar')
run('wrong module key fails', (r) => put(r, 'lib/platformModule.ts', "import type { PlatformModuleKey } from '@comet/ui/topbar'\nexport const PLATFORM_MODULE: PlatformModuleKey = 'portal'\n"), 'two-line form')
run('extra code in platformModule fails', (r) => put(r, 'lib/platformModule.ts', "import type { PlatformModuleKey } from '@comet/ui/topbar'\nexport const PLATFORM_MODULE: PlatformModuleKey = 'agile'\nexport const X = 1\n"), 'two-line form')
run('old package address fails', (r) => put(r, 'package.json', JSON.stringify({ dependencies: { '@comet/ui': 'git+https://github.com/mmcdaniel-saber/comet-ui.git#v0.1.0' } })), 'must pin')
run('pinned version not installed fails', (r) => put(r, 'package.json', JSON.stringify({ dependencies: { '@comet/ui': 'github:AltaVue/altavue-ui#v0.3.1' } })), 'Run npm install')
run('public page under (app) fails', (r) => put(r, 'app/(app)/login/page.tsx', 'x'), 'is a public page but sits under (app)')
run('public page in a (public) group passes', (r) => put(r, 'app/(public)/whats-changing/page.tsx', 'x'), null)
run('node_modules ignored', () => {}, null)
{
  const root = cleanApp('scoping')
  put(root, 'app/review/[token]/page.tsx', 'x')
  check('Scope external review link allowed in Scope', checkPlatformTopBar(root).length === 0, checkPlatformTopBar(root))
  rmSync(root, { recursive: true, force: true })
}
{
  const root = cleanApp('agile')
  put(root, 'app/review/[token]/page.tsx', 'x')
  check('…but not in Agile', checkPlatformTopBar(root).some((p) => p.includes('review/[token]/page.tsx has no top bar')))
  rmSync(root, { recursive: true, force: true })
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
