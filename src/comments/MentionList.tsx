"use client"

import * as React from "react"

import { cn } from "../lib/cn"
import type { MentionCandidate } from "./doc"

/**
 * MentionList — the dropdown shown while someone is typing an @mention.
 *
 * A note on why this is not built on cmdk, since cmdk is available in Tracker:
 * cmdk takes keyboard focus in order to run its own filtering and selection.
 * A mention picker must leave focus in the editor, because the person is still
 * typing into the comment. Wiring cmdk into TipTap's suggestion plugin means
 * fighting over focus, and the result is an editor that loses the caret. This
 * list instead receives arrow and Enter keys forwarded from the editor through
 * TipTap's onKeyDown, which is how the suggestion plugin is designed to work.
 * It is styled to match the command palette so it looks like the rest of the
 * product.
 *
 * Only people who hold an AltaVue login appear here. External stakeholders
 * without a user account are deliberately absent — they cannot be mentioned and
 * are never emailed.
 */

export type MentionListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

function initials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("")
}

export const MentionList = React.forwardRef<
  MentionListHandle,
  {
    items: MentionCandidate[]
    loading?: boolean
    query?: string
    command: (item: { id: string; label: string }) => void
  }
>(function MentionList({ items, loading, query, command }, ref) {
  const [selected, setSelected] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setSelected(0)
  }, [items])

  const select = React.useCallback(
    (index: number) => {
      const item = items[index]
      if (!item) return
      command({
        id: item.profileId,
        label: item.fullName ?? item.email ?? "Unknown user",
      })
    },
    [items, command]
  )

  React.useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelected((current) => (current + items.length - 1) % Math.max(items.length, 1))
        return true
      }
      if (event.key === "ArrowDown") {
        setSelected((current) => (current + 1) % Math.max(items.length, 1))
        return true
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (items.length === 0) return false
        select(selected)
        return true
      }
      return false
    },
  }))

  // Keep the highlighted row in view when navigating with the keyboard.
  React.useEffect(() => {
    const node = containerRef.current?.querySelector<HTMLElement>(
      `[data-index="${selected}"]`
    )
    node?.scrollIntoView({ block: "nearest" })
  }, [selected])

  if (loading) {
    return (
      <div className="w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-muted)] shadow-lg">
        Looking up people…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-muted)] shadow-lg">
        {query
          ? `No one on this project matches “${query}”.`
          : "No one else on this project has a login yet."}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="max-h-56 w-64 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg"
      role="listbox"
      aria-label="Mention a person"
    >
      {items.map((item, index) => {
        const name = item.fullName ?? item.email ?? "Unknown user"
        return (
          <button
            key={item.profileId}
            type="button"
            data-index={index}
            role="option"
            aria-selected={index === selected}
            onMouseEnter={() => setSelected(index)}
            onMouseDown={(event) => {
              // Keep the caret in the editor.
              event.preventDefault()
              select(index)
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
              index === selected
                ? "bg-[var(--color-muted)] text-[var(--color-text)]"
                : "text-[var(--color-text)]"
            )}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/20 text-[10px] font-semibold text-[var(--color-text)]">
              {initials(item.fullName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{name}</span>
              {item.fullName && item.email ? (
                <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
                  {item.email}
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
})
