// @comet/ui/topbar — public entry point (AO-2063).
export { PlatformTopBar } from './PlatformTopBar'
export type { PlatformTopBarProps, TopBarUser } from './types'
export type { PlatformModuleKey } from './modules'
export { isPlatformModuleKey, resolveModuleForPath } from './modules'
export type { ModuleAccessLike } from './access'
export type { ReportRow } from './reports'
export type { SearchResultRow } from './search'
export { portalOrigin, toEnvUrl } from './env'
