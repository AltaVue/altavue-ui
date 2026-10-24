/**
 * Tests for @comet/ui/topbar's pure logic (AO-2063): where links go in each
 * environment, the Portal rule, module access states, report and search link
 * safety, and module resolution.
 *
 * Run with:  npx tsx src/topbar/topbar.test.ts
 */
import { envPrefixForHost, domainFamilyForHost, toEnvUrlForHost, portalOrigin, ribbonOffsetForHost } from './env'
import { accessState, isLocked, refusalUrl } from './access'
import { canonicalResultUrl, isSearchableQuery, type SearchResultRow } from './search'
import { groupReports, isSafeReportRoute, type ReportRow } from './reports'
import { MODULE_BRANDS, SWITCHER_ENTRIES, isPlatformModuleKey, resolveModuleForPath } from './modules'

let passed = 0
let failed = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) { passed += 1; console.log('  PASS  ' + name) }
  else { failed += 1; console.log('  FAIL  ' + name + (detail === undefined ? '' : '  →  ' + JSON.stringify(detail))) }
}
function eq(name: string, got: unknown, want: unknown) { check(name, JSON.stringify(got) === JSON.stringify(want), { got, want }) }

console.log('\nEnvironment links')
eq('dev altavue host', toEnvUrlForHost('https://tracker.comet-app.com/x', 'agile.dev.altavue-app.com'), 'https://tracker.dev.altavue-app.com/x')
eq('staging altavue host', toEnvUrlForHost('https://scope.comet-app.com', 'time.staging.altavue-app.com'), 'https://scope.staging.altavue-app.com')
eq('production altavue host', toEnvUrlForHost('https://app.comet-app.com/profile', 'agile.altavue-app.com'), 'https://app.altavue-app.com/profile')
eq('production comet host', toEnvUrlForHost('https://app.comet-app.com/profile', 'agile.comet-app.com'), 'https://app.comet-app.com/profile')
eq('dev comet host', toEnvUrlForHost('https://app.comet-app.com/profile', 'agile.dev.comet-app.com'), 'https://app.dev.comet-app.com/profile')
eq('localhost → production family unchanged', toEnvUrlForHost('https://app.comet-app.com/x', 'localhost:3000'), 'https://app.comet-app.com/x')
eq('vercel preview → unchanged', toEnvUrlForHost('https://app.comet-app.com/x', 'agile-abc.vercel.app'), 'https://app.comet-app.com/x')
eq('host with port', envPrefixForHost('agile.staging.altavue-app.com:443'), '.staging')
eq('lookalike host is not dev', envPrefixForHost('agile.dev.altavue-app.com.evil.com'), '')
eq('lookalike host family', domainFamilyForHost('altavue-app.com.evil.com'), 'comet-app.com')
eq('non-canonical URL untouched', toEnvUrlForHost('https://evil.com/.comet-app.com', 'agile.dev.altavue-app.com'), 'https://evil.com/.comet-app.com')
eq('Portal is always production', portalOrigin(), 'https://portal.altavue-app.com')
eq('bar pins below the Dev ribbon', ribbonOffsetForHost('estimate.dev.altavue-app.com'), 28)
eq('bar pins below the Staging ribbon', ribbonOffsetForHost('time.staging.comet-app.com'), 28)
eq('bar pins at the top in Production', ribbonOffsetForHost('agile.altavue-app.com'), 0)
eq('bar pins at the top on localhost', ribbonOffsetForHost('localhost'), 0)
check('switcher Portal entry is not an env-rewritable URL', SWITCHER_ENTRIES.find((e) => e.id === 'portal')?.url === 'portal')

console.log('\nModule access')
const access = { modules: {
  agile: { allowed: true, reason: 'ok' },
  time: { allowed: false, reason: 'field_seat' },
  scoping: { allowed: false, reason: 'not_in_plan' },
  tracker: { allowed: true, reason: 'not_in_plan' },
  scheduler: { allowed: false, reason: 'something_new' },
} }
eq('allowed → open', accessState('agile', access), 'open')
eq('field seat → locked', accessState('time', access), 'field_seat')
eq('not in plan → locked', accessState('scoping', access), 'not_in_plan')
eq('inconsistent row → unknown (not locked)', accessState('tracker', access), 'unknown')
eq('unknown reason → unknown', accessState('scheduler', access), 'unknown')
eq('missing row → unknown', accessState('stakeholders', access), 'unknown')
eq('still loading → open', accessState('time', undefined), 'open')
eq('unreadable → unknown', accessState('time', null), 'unknown')
eq('Home always open', accessState('dashboard', { modules: {} }), 'open')
eq('Library always open', accessState('library', null), 'open')
check('unknown is not locked', !isLocked('unknown'))
eq('upgrade link', refusalUrl('scoping', 'not_in_plan'), 'https://app.comet-app.com/upgrade-required?module=scoping')
eq('seat link', refusalUrl('time', 'field_seat'), 'https://app.comet-app.com/seat-required?module=time&reason=field_seat')

console.log('\nSearch result links')
const P = '11111111-2222-3333-4444-555555555555'
const row = (o: Partial<SearchResultRow>): SearchResultRow => ({ module: 'agile', entity_type: 'work_item', entity_id: P, entity_number: 42, title: 't', project_id: P, project_name: 'p', methodology: 'agile', ...o })
eq('agile work item', canonicalResultUrl(row({})), `https://agile.comet-app.com/projects/${P}/items/42`)
eq('tracker work item', canonicalResultUrl(row({ module: 'tracker' })), `https://tracker.comet-app.com/dashboard/projects/${P}/tasks`)
eq('agile project → Agile', canonicalResultUrl(row({ entity_type: 'project' })), 'https://agile.comet-app.com/dashboard')
eq('waterfall project → Vantage', canonicalResultUrl(row({ entity_type: 'project', methodology: 'waterfall' })), `https://tracker.comet-app.com/dashboard/projects/${P}`)
eq('scheduler activity', canonicalResultUrl(row({ entity_type: 'activity', module: 'scheduler' })), `https://scheduler.comet-app.com/schedule/${P}?focus=${P}`)
eq('scope requirement', canonicalResultUrl(row({ entity_type: 'requirement', module: 'scope' })), `https://scope.comet-app.com/projects/${P}`)
eq('no project → no link', canonicalResultUrl(row({ project_id: null })), null)
eq('non-UUID project id → no link', canonicalResultUrl(row({ project_id: '../../evil' })), null)
eq('injected entity id dropped from activity link', canonicalResultUrl(row({ entity_type: 'activity', entity_id: 'x"><script>' })), `https://scheduler.comet-app.com/schedule/${P}`)
eq('negative item number → Vantage tasks', canonicalResultUrl(row({ entity_number: -1 })), `https://tracker.comet-app.com/dashboard/projects/${P}/tasks`)
eq('unknown type → no link', canonicalResultUrl(row({ entity_type: 'secret' })), null)
check('"#42" searchable', isSearchableQuery('#42'))
check('"7" searchable', isSearchableQuery('7'))
check('"a" not searchable', !isSearchableQuery(' a '))

console.log('\nReports')
check('normal route safe', isSafeReportRoute('/reports/project-health'))
check('javascript: unsafe', !isSafeReportRoute('javascript:alert(1)'))
check('protocol-relative unsafe', !isSafeReportRoute('//evil.com/x'))
check('absolute URL unsafe', !isSafeReportRoute('https://evil.com'))
check('backslash unsafe', !isSafeReportRoute('/\\evil.com'))
const r = (slug: string, category: string, route: string): ReportRow => ({ id: slug, slug, title: slug, description: null, category, route, icon: null, sort_order: 0 })
eq('grouping keeps order, drops unsafe', groupReports([r('a', 'Portfolio', '/reports/a'), r('b', 'Portfolio', 'javascript:x'), r('c', 'Project', '/reports/c')]).map((g) => [g.category, g.reports.map((x) => x.slug)]), [['Portfolio', ['a']], ['Project', ['c']]])

console.log('\nModules')
check('every brand points at a switcher entry', Object.values(MODULE_BRANDS).every((b) => SWITCHER_ENTRIES.some((e) => e.id === b.switcherId)))
check('database ids kept', ['estimation', 'tracker', 'scoping'].every((id) => SWITCHER_ENTRIES.some((e) => e.id === id)))
check('unknown module rejected', !isPlatformModuleKey('portal') && !isPlatformModuleKey('__proto__'))
eq('Super Admin brand in Launcher', resolveModuleForPath('dashboard', '/super-admin/orgs'), 'super-admin')
eq('not Super Admin for /super-administrator', resolveModuleForPath('dashboard', '/super-administrator'), 'dashboard')
eq('other modules unchanged', resolveModuleForPath('agile', '/super-admin'), 'agile')

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
