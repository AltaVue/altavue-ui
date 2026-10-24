// @comet/ui/topbar — reading module access for the switcher (AO-2063).
//
// Pure logic, no database or auth code (shared package rule 1). The answer is
// read by each app's connector through @altavue/auth getModuleAccess()
// (my_module_access(), AO-2019) and handed in. This file only decides how a
// switcher entry looks and where a locked one sends the person. The module's
// own guard and the Launcher refusal pages re-check live; nothing here grants
// access to anything.

import { LAUNCHER_URL } from './env'

/** Structural copy of @altavue/auth's ModuleAccess — only what is read here. */
export interface ModuleAccessLike {
  modules: Record<string, { allowed: boolean; reason: string } | undefined>
}

export type AccessState = 'open' | 'not_in_plan' | 'no_seat' | 'field_seat' | 'over_seat_limit' | 'unknown'
export type LockedState = Exclude<AccessState, 'open' | 'unknown'>

export const STATE_LABELS: Record<LockedState, string> = {
  not_in_plan: 'Not on your plan',
  no_seat: 'No seat assigned',
  field_seat: 'Not on a field seat',
  over_seat_limit: 'No seat available',
}

const ALWAYS_OPEN = new Set(['dashboard', 'library', 'portal'])

/**
 * access: undefined = still loading (listed as open; the module's own guard
 * decides on arrival), null = could not be read.
 */
export function accessState(id: string, access: ModuleAccessLike | null | undefined): AccessState {
  if (ALWAYS_OPEN.has(id)) return 'open'
  if (access === undefined) return 'open'
  const entry = access?.modules?.[id]
  if (!entry) return 'unknown'
  if (entry.allowed !== (entry.reason === 'ok')) return 'unknown'
  if (entry.allowed) return 'open'
  switch (entry.reason) {
    case 'not_in_plan':
    case 'no_seat':
    case 'field_seat':
    case 'over_seat_limit':
      return entry.reason
    default:
      return 'unknown'
  }
}

export function isLocked(state: AccessState): state is LockedState {
  return state !== 'open' && state !== 'unknown'
}

/** Canonical Launcher page that explains why a module is locked. */
export function refusalUrl(id: string, state: LockedState): string {
  return state === 'not_in_plan'
    ? `${LAUNCHER_URL}/upgrade-required?module=${encodeURIComponent(id)}`
    : `${LAUNCHER_URL}/seat-required?module=${encodeURIComponent(id)}&reason=${state}`
}
