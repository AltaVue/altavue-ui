'use client'
// @comet/ui/topbar — the app switcher (AO-2063). Merged from the eight copies:
// Scope/Time logic (AO-2019 access states, AO-1918 Portal rule), Launcher's
// body portal, Stakeholders' runtime environment detection.
import { createPortal } from 'react-dom'
import { SWITCHER_ENTRIES, type SwitcherEntry } from './modules'
import { accessState, isLocked, refusalUrl, STATE_LABELS, type ModuleAccessLike } from './access'
import { portalOrigin, toEnvUrl } from './env'
import { LockIcon, SWITCHER_ICONS } from './icons'
import { usePopover } from './usePopover'

function destination(entry: SwitcherEntry, access: ModuleAccessLike | null | undefined): string {
  const state = accessState(entry.id, access)
  if (isLocked(state)) return toEnvUrl(refusalUrl(entry.id, state))
  // AO-1918: the Portal is never rewritten for the environment.
  if (entry.id === 'portal') return portalOrigin()
  return toEnvUrl(entry.url)
}

export function AppSwitcher({ currentId, access }: { currentId: string; access: ModuleAccessLike | null | undefined }) {
  const pop = usePopover('left')

  return (
    <>
      <button
        ref={pop.anchorRef}
        type="button"
        className="avtb-iconbtn"
        onClick={pop.toggle}
        aria-label="Switch modules"
        aria-haspopup="dialog"
        aria-expanded={pop.open}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          {[4, 10, 16].map((y) => [4, 10, 16].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />))}
        </svg>
      </button>
      {pop.open && pop.style && typeof document !== 'undefined' && createPortal(
        <div ref={pop.panelRef} className="avtb-panel" role="dialog" aria-label="Switch modules" style={{ ...pop.style, width: 400 }}>
          <div className="avtb-panel-head">
            <div className="avtb-panel-title">AltaVue</div>
            <div className="avtb-panel-sub">Switch modules</div>
          </div>
          <div className="avtb-grid">
            {SWITCHER_ENTRIES.map((entry) => {
              const Icon = SWITCHER_ICONS[entry.icon]
              const state = accessState(entry.id, access)
              const locked = isLocked(state)
              const current = entry.id === currentId
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="avtb-item"
                  data-current={current}
                  data-locked={locked}
                  aria-current={current ? 'page' : undefined}
                  onClick={() => {
                    pop.hide()
                    window.location.assign(destination(entry, access))
                  }}
                >
                  <span className="avtb-item-icon"><Icon size={24} color={entry.iconColor} aria-hidden /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="avtb-item-name" style={{ color: locked ? '#888' : undefined }}>{entry.name}</span>
                      {locked && <LockIcon size={12} color="#888" aria-hidden />}
                    </span>
                    {current && <span className="avtb-item-note" style={{ display: 'block' }}>Current</span>}
                    {locked && (
                      <>
                        <span className="avtb-item-lock" style={{ display: 'block' }}>{STATE_LABELS[state]}</span>
                        <span className="avtb-item-note" style={{ display: 'block' }}>Click for details</span>
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="avtb-panel-foot">AltaVue Project Management Suite</div>
        </div>,
        document.body,
      )}
    </>
  )
}
