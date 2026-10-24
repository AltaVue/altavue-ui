'use client'
// @comet/ui/topbar — the global reports menu (AO-2063). Same in every module,
// Stakeholders included. Reports live in AltaVue Home; from any other module
// they open in a new tab, from Home in the same tab (unchanged behaviour).
import { createPortal } from 'react-dom'
import { groupReports, reportUrl, type ReportRow } from './reports'
import { ExternalLinkIcon, reportIcon, ReportsIcon } from './icons'
import { usePopover } from './usePopover'
import { GOLD_BRIGHT } from './styles'

export function ReportsMenu({ reports, inHome }: { reports: ReportRow[] | null | undefined; inHome: boolean }) {
  const pop = usePopover('left')
  const groups = reports ? groupReports(reports) : []
  const newTab = !inHome

  function go(route: string) {
    pop.hide()
    const url = reportUrl(route)
    if (newTab) window.open(url, '_blank', 'noopener,noreferrer')
    else window.location.assign(url)
  }

  return (
    <>
      <button ref={pop.anchorRef} type="button" className="avtb-iconbtn" onClick={pop.toggle} aria-label="Reports" aria-haspopup="dialog" aria-expanded={pop.open}>
        <ReportsIcon size={20} color={GOLD_BRIGHT} aria-hidden />
      </button>
      {pop.open && pop.style && typeof document !== 'undefined' && createPortal(
        <div ref={pop.panelRef} className="avtb-panel" role="dialog" aria-label="Reports" style={{ ...pop.style, width: 400 }}>
          <div className="avtb-panel-head">
            <div className="avtb-panel-title">Reports</div>
            <div className="avtb-panel-sub">Cross-project insights</div>
          </div>
          {reports === undefined && <div className="avtb-msg">Loading…</div>}
          {reports === null && <div className="avtb-msg">Reports could not be loaded. Try again in a moment.</div>}
          {reports && groups.length === 0 && <div className="avtb-msg">No reports available yet.</div>}
          {groups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {groups.map((g) => (
                <div key={g.category}>
                  <div className="avtb-group">{g.category}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {g.reports.map((r) => {
                      const Icon = reportIcon(r.icon)
                      return (
                        <button key={r.id} type="button" className="avtb-item" style={{ padding: '8px 12px' }} title={newTab ? 'Opens in a new tab' : undefined} onClick={() => go(r.route)}>
                          <span className="avtb-item-icon"><Icon size={24} color={GOLD_BRIGHT} aria-hidden /></span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span className="avtb-item-name" style={{ display: 'block', whiteSpace: 'normal' }}>{r.title}</span>
                            {r.description && <span className="avtb-item-desc" style={{ display: 'block' }}>{r.description}</span>}
                          </span>
                          {newTab && <span style={{ flexShrink: 0, marginTop: 2, opacity: 0.5, display: 'flex' }}><ExternalLinkIcon size={13} color="#888" aria-hidden /></span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="avtb-panel-foot">
            <button type="button" className="avtb-menu-btn" style={{ textAlign: 'center', color: '#888', fontSize: 11 }} onClick={() => go('/reports')}>
              View all reports{newTab ? ' (opens in a new tab)' : ' →'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
