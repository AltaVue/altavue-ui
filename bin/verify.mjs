// @comet/ui/verify — the top-bar drift check (AO-2063).
//
// Called from every app's next.config.ts, so it runs on every `next build`
// (Vercel included) and every `next dev`, whatever build command a Vercel
// project uses. Any problem throws, and the build fails before anything is
// deployed. The Drift Guard (altavue-auth) runs the same rules on GitHub and
// additionally checks that this call is present and that the app pins the
// current @comet/ui version.
//
// Plain JavaScript on purpose: next.config.ts loads it with Node directly.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = join(HERE, '..')

export const MODULE_KEYS = ['dashboard', 'scoping', 'estimation', 'tracker', 'agile', 'scheduler', 'time', 'stakeholders']

/**
 * The ONLY pages in each app allowed to show no top bar. Route paths with
 * route groups removed; '' is the root redirect. Adding a page here needs a
 * new @comet/ui release — that is the point.
 */
export const PUBLIC_PAGES = {
  dashboard: [
    '', 'login', 'forgot-password', 'reset-password', 'challenge', 'onboarding', 'pricing', 'cookie-policy',
    'checkout/complete', 'inactive', 'no-organization', 'seat-required', 'unauthorized', 'upgrade-required', 'whats-changing',
  ],
  scoping: ['', 'login', 'review/[token]', 'whats-changing'],
  estimation: ['', 'login', 'whats-changing'],
  tracker: ['', 'login', 'whats-changing', '%5Fdev/ui-preview'],
  agile: ['', 'login', 'whats-changing', '%5Fdev/ui-preview'],
  scheduler: ['', 'login', 'whats-changing'],
  time: ['', 'login', 'whats-changing'],
  stakeholders: ['', 'login'],
}

/** Local copies of top-bar pieces that must never exist again. */
export const FORBIDDEN_FILES = ['TopBar', 'AppSwitcher', 'ReportsDropdown', 'GlobalSearch', 'AppHeaderActions', 'NavHeader']

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.vercel', 'graphify-out', 'coverage', 'out'])
const SRC_EXT = /\.(tsx?|jsx?|mjs|cjs)$/

function norm(text) {
  return text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
}

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function routeOf(appDir, pageFile) {
  const rel = relative(appDir, dirname(pageFile)).split(sep).filter(Boolean)
  const inApp = rel.includes('(app)')
  const route = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')'))).join('/')
  return { route, inApp }
}

export function canonicalConnector() {
  return norm(readFileSync(join(PKG_ROOT, 'connector', 'PlatformTopBarConnector.tsx'), 'utf8'))
}

export function installedVersion() {
  return JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version
}

/** Returns a list of problems (empty = clean). Never throws on its own. */
export function checkPlatformTopBar(appRoot) {
  const problems = []
  const files = walk(appRoot)
  const rel = (p) => relative(appRoot, p).split(sep).join('/')

  // 1. Which module this app is.
  let moduleKey = null
  const pmPath = join(appRoot, 'lib', 'platformModule.ts')
  if (!existsSync(pmPath)) {
    problems.push('lib/platformModule.ts is missing.')
  } else {
    const m = norm(readFileSync(pmPath, 'utf8')).match(
      /^import type \{ PlatformModuleKey \} from '@comet\/ui\/topbar'\nexport const PLATFORM_MODULE: PlatformModuleKey = '([a-z-]+)'\n?$/,
    )
    if (!m || !MODULE_KEYS.includes(m[1])) {
      problems.push("lib/platformModule.ts must be exactly the two-line form with one module key (see @comet/ui README).")
    } else {
      moduleKey = m[1]
    }
  }

  // 2. The connector is byte-identical to the canonical copy.
  const connPath = join(appRoot, 'components', 'PlatformTopBarConnector.tsx')
  if (!existsSync(connPath)) problems.push('components/PlatformTopBarConnector.tsx is missing.')
  else if (norm(readFileSync(connPath, 'utf8')) !== canonicalConnector()) {
    problems.push('components/PlatformTopBarConnector.tsx differs from the canonical copy in @comet/ui/connector. Copy it again; do not edit it.')
  }

  // 3. The app frame renders the bar.
  const appDir = existsSync(join(appRoot, 'src', 'app')) ? join(appRoot, 'src', 'app') : join(appRoot, 'app')
  const layoutPath = ['tsx', 'jsx', 'ts', 'js'].map((e) => join(appDir, '(app)', `layout.${e}`)).find((p) => existsSync(p))
  if (!layoutPath) problems.push('app/(app)/layout.tsx is missing — every signed-in page lives under app/(app).')
  else {
    const t = norm(readFileSync(layoutPath, 'utf8'))
    if (!/from '@\/components\/PlatformTopBarConnector'/.test(t) || !/<PlatformTopBarConnector\s*\/>/.test(t)) {
      problems.push(`${rel(layoutPath)} must import and render <PlatformTopBarConnector />.`)
    }
  }

  // 4. Every page either sits under (app) or is on this module's public list.
  if (moduleKey) {
    const allowed = new Set(PUBLIC_PAGES[moduleKey])
    for (const f of files) {
      if (!f.startsWith(appDir + sep)) continue
      if (!/[\\/]page\.(tsx|jsx|ts|js)$/.test(f)) continue
      const { route, inApp } = routeOf(appDir, f)
      if (inApp) {
        if (allowed.has(route) && route !== '') problems.push(`${rel(f)} is a public page but sits under (app).`)
        continue
      }
      if (!allowed.has(route)) {
        problems.push(`${rel(f)} has no top bar: signed-in pages must live under app/(app). (Public pages are listed in @comet/ui PUBLIC_PAGES.)`)
      }
    }
  }

  // 5. No local copies of top-bar pieces, and nothing else renders the bar.
  for (const f of files) {
    const r = rel(f)
    if (r.split('/').some((seg) => seg.startsWith('_to_delete'))) continue
    const base = r.split('/').pop().replace(SRC_EXT, '')
    if (SRC_EXT.test(r) && FORBIDDEN_FILES.includes(base)) {
      problems.push(`${r} is a local copy of a top-bar piece. Delete it; the bar comes from @comet/ui/topbar.`)
    }
  }
  const importRe = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g
  for (const f of files) {
    if (!SRC_EXT.test(f)) continue
    const r = rel(f)
    if (r === 'next.config.ts' || r === 'next.config.mjs' || r === 'next.config.js') continue
    const t = readFileSync(f, 'utf8')
    for (const m of t.matchAll(importRe)) {
      const spec = m[1]
      const last = spec.split('/').pop().replace(SRC_EXT, '')
      if (FORBIDDEN_FILES.includes(last)) problems.push(`${r} imports "${spec}" — the top bar comes from @comet/ui/topbar only.`)
      if (spec === '@comet/ui/topbar' && r !== 'components/PlatformTopBarConnector.tsx' && r !== 'lib/platformModule.ts') {
        problems.push(`${r} imports @comet/ui/topbar — only the connector may render the bar.`)
      }
    }
  }

  // 6. The installed package is the version package.json pins.
  const pkgPath = join(appRoot, 'package.json')
  if (existsSync(pkgPath)) {
    const spec = JSON.parse(readFileSync(pkgPath, 'utf8')).dependencies?.['@comet/ui'] ?? ''
    const tag = (spec.match(/#v(\d+\.\d+\.\d+)$/) || [])[1]
    if (!/^github:AltaVue\/altavue-ui#v\d+\.\d+\.\d+$/.test(spec)) {
      problems.push(`package.json must pin "@comet/ui": "github:AltaVue/altavue-ui#vX.Y.Z" (found "${spec}").`)
    } else if (tag !== installedVersion()) {
      problems.push(`package.json pins @comet/ui v${tag} but v${installedVersion()} is installed. Run npm install.`)
    }
  }

  return problems
}

/** For next.config.ts: throws (failing the build) when anything is wrong. */
export function verifyPlatformTopBar(appRoot = process.cwd()) {
  const problems = checkPlatformTopBar(appRoot)
  if (problems.length > 0) {
    const msg =
      '\n[@comet/ui] The AltaVue top bar check failed (AO-2063). Nothing will build until this is fixed:\n' +
      problems.map((p) => '  - ' + p).join('\n') + '\n'
    throw new Error(msg)
  }
}
