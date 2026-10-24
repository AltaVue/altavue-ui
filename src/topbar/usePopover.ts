'use client'
// @comet/ui/topbar — one open/close behaviour for every menu in the bar.
// Panels render through a portal onto <body> (Launcher fix, kept): an ancestor
// with backdrop-filter becomes the containing block for fixed children and
// trapped the old switcher panel under the dashboard's glass cards.
import { useCallback, useEffect, useRef, useState } from 'react'

export interface PopoverPos { top: number; left: number; right: number }

export function usePopover(align: 'left' | 'right' = 'left') {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<PopoverPos | null>(null)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const place = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 8, left: Math.max(8, r.left), right: Math.max(8, window.innerWidth - r.right) })
  }, [])

  const show = useCallback(() => { place(); setOpen(true) }, [place])
  const hide = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => { if (open) setOpen(false); else { place(); setOpen(true) } }, [open, place])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); anchorRef.current?.focus() }
    }
    function onResize() { place() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open, place])

  const style = pos
    ? (align === 'left' ? { top: pos.top, left: pos.left } : { top: pos.top, right: pos.right })
    : undefined

  return { open, show, hide, toggle, anchorRef, panelRef, style }
}
