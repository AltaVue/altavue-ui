// @comet/ui/topbar — the module registry (AO-2063).
//
// The ONLY list of AltaVue modules the top bar and app switcher know about.
// Ids must match the database (subscription_plans.included_modules,
// org_subscriptions.included_modules, my_module_access()): a mismatch silently
// shows a paid module as locked. 'estimation' and 'tracker' are the database
// ids for Estimation and Vantage.

export type PlatformModuleKey =
  | 'dashboard'
  | 'scoping'
  | 'estimation'
  | 'tracker'
  | 'agile'
  | 'scheduler'
  | 'time'
  | 'stakeholders'
  | 'super-admin'

export type SwitcherIcon =
  | 'home'
  | 'scope'
  | 'estimation'
  | 'vantage'
  | 'agile'
  | 'scheduler'
  | 'time'
  | 'stakeholders'
  | 'library'
  | 'portal'

export interface SwitcherEntry {
  id: string
  name: string
  /** Canonical production URL; rewritten per environment by toEnvUrl(). */
  url: string
  icon: SwitcherIcon
  iconColor: string
}

/** What the switcher lists, in this order. */
export const SWITCHER_ENTRIES: readonly SwitcherEntry[] = [
  { id: 'dashboard', name: 'AltaVue Home', url: 'https://app.comet-app.com/dashboard', icon: 'home', iconColor: '#D4AF37' },
  { id: 'scoping', name: 'Scope', url: 'https://scope.comet-app.com', icon: 'scope', iconColor: '#3B82F6' },
  { id: 'estimation', name: 'Estimation', url: 'https://estimate.comet-app.com', icon: 'estimation', iconColor: '#22C55E' },
  { id: 'tracker', name: 'Vantage', url: 'https://tracker.comet-app.com', icon: 'vantage', iconColor: '#14B8A6' },
  { id: 'agile', name: 'Agile', url: 'https://agile.comet-app.com', icon: 'agile', iconColor: '#38BDF8' },
  { id: 'scheduler', name: 'Scheduler', url: 'https://scheduler.comet-app.com', icon: 'scheduler', iconColor: '#A855F7' },
  { id: 'time', name: 'Time', url: 'https://time.comet-app.com', icon: 'time', iconColor: '#F97316' },
  { id: 'stakeholders', name: 'Stakeholders', url: 'https://stakeholders.comet-app.com', icon: 'stakeholders', iconColor: '#6366F1' },
  { id: 'library', name: 'Project Library', url: 'https://app.comet-app.com/library', icon: 'library', iconColor: '#D4AF37' },
  { id: 'portal', name: 'Portal', url: 'portal', icon: 'portal', iconColor: '#D4AF37' },
]

export interface ModuleBrand {
  /** Gold second word of the brand: ALTAVUE <label>. */
  label: string
  /** Where the brand links to, inside the same app. */
  homePath: string
  /** Which switcher entry is marked "Current". */
  switcherId: string
}

export const MODULE_BRANDS: Record<PlatformModuleKey, ModuleBrand> = {
  dashboard: { label: 'HOME', homePath: '/dashboard', switcherId: 'dashboard' },
  scoping: { label: 'SCOPE', homePath: '/dashboard', switcherId: 'scoping' },
  estimation: { label: 'ESTIMATION', homePath: '/dashboard', switcherId: 'estimation' },
  tracker: { label: 'VANTAGE', homePath: '/dashboard', switcherId: 'tracker' },
  agile: { label: 'AGILE', homePath: '/dashboard', switcherId: 'agile' },
  scheduler: { label: 'SCHEDULER', homePath: '/dashboard', switcherId: 'scheduler' },
  time: { label: 'TIME', homePath: '/dashboard', switcherId: 'time' },
  stakeholders: { label: 'STAKEHOLDERS', homePath: '/dashboard', switcherId: 'stakeholders' },
  'super-admin': { label: 'SUPER ADMIN', homePath: '/super-admin', switcherId: 'dashboard' },
}

export function isPlatformModuleKey(v: unknown): v is PlatformModuleKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(MODULE_BRANDS, v)
}

/**
 * Which brand a page shows. The Launcher app is module 'dashboard' everywhere
 * except its Super Admin area, which shows ALTAVUE SUPER ADMIN.
 */
export function resolveModuleForPath(appModule: PlatformModuleKey, pathname: string | null | undefined): PlatformModuleKey {
  if (appModule === 'dashboard' && typeof pathname === 'string' && (pathname === '/super-admin' || pathname.startsWith('/super-admin/'))) {
    return 'super-admin'
  }
  return appModule
}
