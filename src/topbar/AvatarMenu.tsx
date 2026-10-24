'use client'
// @comet/ui/topbar — the profile avatar (AO-2063). Picture from
// profiles.avatar_url, then the public avatars/<id>/avatar.jpg fallback, then
// the person's initial (the cross-module convention from Vantage/Estimation).
// Menu: Your profile (AltaVue Home) and Sign out. Sign out is the app's own
// existing call, handed in by the connector — nothing new here.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LAUNCHER_URL, toEnvUrl } from './env'
import { usePopover } from './usePopover'
import type { TopBarUser } from './types'

function safeImageUrl(u: string): boolean {
  try {
    const p = new URL(u)
    return p.protocol === 'https:' || (p.protocol === 'http:' && (p.hostname === 'localhost' || p.hostname === '127.0.0.1'))
  } catch {
    return false
  }
}

export function AvatarMenu({ user, onSignOut }: { user: TopBarUser | null | undefined; onSignOut: () => Promise<void> }) {
  const pop = usePopover('right')
  const [failed, setFailed] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const urls = (user?.avatarUrls ?? []).filter(safeImageUrl)
  const src = urls[failed]
  const display = user?.fullName?.trim() || user?.email || ''
  const initial = (display.trim()[0] ?? '?').toUpperCase()

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    try { await onSignOut() } finally { setSigningOut(false) }
  }

  return (
    <>
      <button ref={pop.anchorRef} type="button" className="avtb-avatar-btn" onClick={pop.toggle} aria-label="Your profile and sign out" aria-haspopup="menu" aria-expanded={pop.open}>
        {src ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed((n) => n + 1)} /> : <span aria-hidden="true">{initial}</span>}
      </button>
      {pop.open && pop.style && typeof document !== 'undefined' && createPortal(
        <div ref={pop.panelRef} className="avtb-panel" role="menu" aria-label="Your account" style={{ ...pop.style, width: 240, padding: 6 }}>
          {display && (
            <div style={{ padding: '8px 12px 10px', borderBottom: '0.5px solid #e2e8f0', marginBottom: 4 }}>
              {user?.fullName && <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.fullName}</div>}
              {user?.email && <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>}
            </div>
          )}
          <a role="menuitem" className="avtb-menu-btn" href={toEnvUrl(LAUNCHER_URL + '/profile')}>Your profile</a>
          <button role="menuitem" type="button" className="avtb-menu-btn" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}
