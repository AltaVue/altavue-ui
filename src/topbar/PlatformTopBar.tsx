'use client'
// @comet/ui/topbar — THE AltaVue top bar (AO-2063).
//
// One copy for all eight apps. A module tells it which module it is; nothing
// else about the bar can be changed from outside — no slots, no style props,
// no optional pieces. That is deliberate: options are how the eight copies
// drifted apart. Every piece is always present: app switcher, module name,
// global reports, global search, help, profile avatar.
//
// Data (user, module access, reports, search, sign-out) comes from the app's
// PlatformTopBarConnector, which is byte-identical in every app and checked by
// comet-ui-verify at build time. This package holds no database or auth code.
import { useEffect, useState } from 'react'
import { AppSwitcher } from './AppSwitcher'
import { AvatarMenu } from './AvatarMenu'
import { ReportsMenu } from './ReportsMenu'
import { SearchBox } from './SearchBox'
import { MODULE_BRANDS, isPlatformModuleKey } from './modules'
import { TOPBAR_CSS } from './styles'
import { ribbonOffsetForHost } from './env'
import type { PlatformTopBarProps } from './types'

export function PlatformTopBar(props: PlatformTopBarProps) {
  // The bar stays in view while a page scrolls, pinned just below the Dev /
  // Staging ribbon (none in Production). Same behaviour in every module,
  // whether the page scrolls the window or an inner panel.
  const [top, setTop] = useState(0)
  useEffect(() => setTop(ribbonOffsetForHost(window.location.hostname)), [])

  if (!isPlatformModuleKey(props.module)) {
    throw new Error(`@comet/ui/topbar: unknown module "${String(props.module)}"`)
  }
  const brand = MODULE_BRANDS[props.module]
  const inHome = props.module === 'dashboard' || props.module === 'super-admin'

  return (
    <>
      <style>{TOPBAR_CSS}</style>
      <header className="avtb-bar" data-altavue-topbar="v1" style={{ top }}>
        <div className="avtb-brand">
          <AppSwitcher currentId={brand.switcherId} access={props.moduleAccess} />
          <a href={brand.homePath} className="avtb-brand-link avtb-hide-collapsed">
            <div className="avtb-brand-name">ALTAVUE <span>{brand.label}</span></div>
            <div className="avtb-brand-sub">Project Management Software</div>
          </a>
        </div>
        <div className="avtb-middle">
          <ReportsMenu reports={props.reports} inHome={inHome} />
          <SearchBox search={props.search} pathname={props.pathname} />
        </div>
        <div className="avtb-right">
          <button
            type="button"
            className="avtb-help"
            aria-label="Open help"
            onClick={() => window.dispatchEvent(new CustomEvent('comet:open-help'))}
          >
            ?
          </button>
          <AvatarMenu user={props.user} onSignOut={props.onSignOut} />
        </div>
      </header>
    </>
  )
}
