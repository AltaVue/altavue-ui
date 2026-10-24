// @comet/ui/topbar — what the connector hands the bar (AO-2063).
import type { PlatformModuleKey } from './modules'
import type { ModuleAccessLike } from './access'
import type { ReportRow } from './reports'
import type { SearchResultRow } from './search'

export interface TopBarUser {
  email: string | null
  fullName: string | null
  /** profiles.avatar_url, then the public avatars/<id>/avatar.jpg fallback. */
  avatarUrls: string[]
}

export interface PlatformTopBarProps {
  module: PlatformModuleKey
  /** undefined while loading. */
  user: TopBarUser | null | undefined
  /** undefined while loading, null when it could not be read. */
  moduleAccess: ModuleAccessLike | null | undefined
  /** undefined while loading, null when it could not be read. */
  reports: ReportRow[] | null | undefined
  /** Runs comet_search with the signed-in user's own client. Rejects on error. */
  search: (query: string) => Promise<SearchResultRow[]>
  /** The app's existing sign-out: Supabase signOut() with the user's own session, then /login. */
  onSignOut: () => Promise<void>
}
