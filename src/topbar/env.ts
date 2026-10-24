// @comet/ui/topbar — where links go (AO-2063).
//
// One definition for every app. Until AO-2063 each module carried its own
// toEnvUrl(), most of them keyed off the build-time NEXT_PUBLIC_COOKIE_DOMAIN,
// which has to be set per environment AND rebuilt to take effect. Stakeholders
// had already moved to reading the hostname the app is running on; that is the
// version kept here, so one build behaves correctly in every environment and
// on both domain families (altavue-app.com and the retired comet-app.com).
//
//   localhost / *.vercel.app / unknown  -> production family, no env prefix
//   *.dev.<family>                      -> '.dev'
//   *.staging.<family>                  -> '.staging'
//   <family> / *.<family>               -> '' (production)
//
// The Customer Portal is the exception and is NEVER rewritten (AO-1918, Portal
// link rule): it has one deployment and no dev or staging copy.

const DOMAIN_FAMILIES = ['altavue-app.com', 'comet-app.com'] as const

/** The one place the Customer Portal lives. Always production, on purpose. */
export const PORTAL_ORIGIN = 'https://portal.altavue-app.com'

export function portalOrigin(): string {
  return PORTAL_ORIGIN
}

function cleanHost(host: string | null | undefined): string {
  return (host ?? '').split(':')[0].toLowerCase()
}

/** The domain family the host belongs to; the retired family when unknown. */
export function domainFamilyForHost(host: string | null | undefined): string {
  const h = cleanHost(host)
  return DOMAIN_FAMILIES.find((b) => h === b || h.endsWith('.' + b)) ?? 'comet-app.com'
}

/** '.dev', '.staging' or '' (production / unknown host). */
export function envPrefixForHost(host: string | null | undefined): string {
  const h = cleanHost(host)
  for (const base of DOMAIN_FAMILIES) {
    if (h.endsWith('.dev.' + base)) return '.dev'
    if (h.endsWith('.staging.' + base)) return '.staging'
  }
  return ''
}

/**
 * Rewrite a canonical https://<sub>.comet-app.com URL into the environment and
 * domain family of `host`. Anything that is not a canonical comet-app.com URL
 * is returned unchanged.
 */
export function toEnvUrlForHost(url: string, host: string | null | undefined): string {
  if (!/^https:\/\/[a-z0-9-]+\.comet-app\.com(\/|$)/.test(url)) return url
  return url.replace('.comet-app.com', envPrefixForHost(host) + '.' + domainFamilyForHost(host))
}

/** Browser convenience: reads the current hostname at call time. */
export function toEnvUrl(url: string): string {
  const host = typeof window === 'undefined' ? null : window.location.hostname
  return toEnvUrlForHost(url, host)
}

/** Home (Launcher) — the refusal pages, profile and reports live there. */
export const LAUNCHER_URL = 'https://app.comet-app.com'
