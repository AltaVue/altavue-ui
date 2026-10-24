// @comet/ui/topbar — the bar's styling (AO-2063).
//
// Ships inside the package on purpose: an app's Tailwind build only scans the
// app's own files, so utility classes in a shared component can silently come
// out unstyled. Plain CSS with an avtb- prefix cannot collide with app styles.
//
// The brand column follows the sidebar width through --sidebar-w and the
// data-sidebar attribute on <html> (AO-1964), which every app already sets.

export const NAVY = '#0a1628'
export const GOLD = '#c9a84c'
export const GOLD_BRIGHT = '#D4AF37'

const FONT = 'var(--font-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)'

export const TOPBAR_CSS = `
.avtb-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;height:64px;flex-shrink:0;width:100%;box-sizing:border-box;
  background:linear-gradient(100deg,#0a1628 0%,#0c1b32 55%,#091322 100%);border-bottom:1px solid rgba(96,165,250,0.25);
  box-shadow:0 6px 24px -16px rgba(0,0,0,0.6);font-family:${FONT};color:#fff}
.avtb-bar *{box-sizing:border-box}
.avtb-brand{position:relative;display:flex;align-items:center;gap:12px;height:100%;flex-shrink:0;padding:0 24px;
  width:var(--sidebar-w,260px);min-width:var(--sidebar-w,260px);border-right:1px solid rgba(255,255,255,0.1)}
html[data-sidebar-motion] .avtb-brand{transition:width .2s ease,min-width .2s ease}
html[data-sidebar="collapsed"] .avtb-brand{justify-content:center;padding-left:0;padding-right:0;gap:0}
html[data-sidebar="collapsed"] .avtb-hide-collapsed{display:none}
.avtb-brand-link{min-width:0;text-decoration:none;color:inherit}
.avtb-brand-name{font-size:14px;font-weight:700;letter-spacing:.06em;line-height:1.15;white-space:nowrap;color:#fff}
.avtb-brand-name span{color:${GOLD}}
.avtb-brand-sub{color:rgba(255,255,255,0.45);font-size:11px;margin-top:2px;white-space:nowrap}
.avtb-middle{position:relative;display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:0 20px}
.avtb-right{position:relative;display:flex;align-items:center;gap:16px;padding:0 24px 0 12px;flex-shrink:0}
.avtb-iconbtn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:none;border-radius:8px;background:transparent;
  color:#fff;cursor:pointer;padding:8px;flex-shrink:0;transition:background-color .15s ease}
.avtb-iconbtn:hover,.avtb-iconbtn[aria-expanded="true"]{background:rgba(255,255,255,0.12)}
.avtb-iconbtn:focus-visible,.avtb-help:focus-visible,.avtb-avatar-btn:focus-visible,.avtb-item:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
.avtb-help{display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;border-radius:9999px;border:none;cursor:pointer;
  background:${GOLD};color:${NAVY};font-size:15px;font-weight:700;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,0.25);transition:transform .15s ease}
.avtb-help:hover{transform:scale(1.1)}
.avtb-avatar-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;padding:0;cursor:pointer;overflow:hidden;
  border:2px solid rgba(201,168,76,0.6);background:#1e3a5f;color:#fff;font-size:14px;font-weight:600}
.avtb-avatar-btn img{width:100%;height:100%;object-fit:cover;display:block}
.avtb-search{position:relative;flex:1;max-width:420px;min-width:120px}
.avtb-search input{width:100%;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);
  color:#fff;font-size:13px;padding:0 64px 0 34px;outline:none;font-family:inherit}
.avtb-search input::placeholder{color:rgba(255,255,255,0.45)}
.avtb-search input:focus{border-color:${GOLD};background:rgba(255,255,255,0.12)}
.avtb-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.5);pointer-events:none;display:flex}
.avtb-kbd{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;color:rgba(255,255,255,0.45);border:1px solid rgba(255,255,255,0.2);
  border-radius:4px;padding:1px 5px;pointer-events:none}
.avtb-panel{position:fixed;z-index:9999;background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);
  padding:12px;color:${NAVY};font-family:${FONT};max-height:calc(100vh - 96px);overflow-y:auto}
.avtb-panel-head{margin-bottom:8px;padding-bottom:8px;border-bottom:0.5px solid #e2e8f0}
.avtb-panel-title{font-weight:600;font-size:13px;color:${NAVY}}
.avtb-panel-sub{font-size:12px;color:#888;margin-top:1px}
.avtb-panel-foot{border-top:0.5px solid #e2e8f0;margin-top:8px;padding-top:8px;text-align:center;font-size:11px;color:#aaa}
.avtb-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px}
.avtb-item{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;padding:10px 12px;border:none;border-radius:8px;background:transparent;
  cursor:pointer;font-family:inherit;color:${NAVY};text-decoration:none}
.avtb-item:hover,.avtb-item[data-active="true"]{background:#f8f9fb}
.avtb-item[data-current="true"]{background:#EEF3FC;box-shadow:inset 3px 0 0 #185FA5}
.avtb-item[data-locked="true"]{opacity:.55}
.avtb-item-icon{flex-shrink:0;display:flex;align-items:center;margin-top:1px}
.avtb-item-name{font-size:13px;font-weight:500;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.avtb-item-note{font-size:10px;color:#888;margin-top:2px}
.avtb-item-lock{font-size:10px;color:${GOLD};font-weight:500;margin-top:2px}
.avtb-item-desc{font-size:11px;color:#888;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.avtb-group{font-size:10px;font-weight:700;color:#888;letter-spacing:.08em;text-transform:uppercase;padding:2px 12px 6px}
.avtb-msg{padding:20px 12px;text-align:center;font-size:12px;color:#888}
.avtb-menu-btn{display:block;width:100%;text-align:left;padding:8px 12px;border:none;border-radius:8px;background:transparent;cursor:pointer;
  font-size:13px;color:${NAVY};text-decoration:none;font-family:inherit}
.avtb-menu-btn:hover,.avtb-menu-btn:focus-visible{background:#f8f9fb;outline:none}
.avtb-menu-btn[disabled]{opacity:.6;cursor:default}
@media (max-width:900px){.avtb-kbd{display:none}.avtb-search input{padding-right:12px}.avtb-middle{padding:0 12px}.avtb-right{gap:10px;padding-right:12px}}
@media (max-width:640px){.avtb-brand-sub{display:none}}
@media print{.avtb-bar{display:none}}
`
