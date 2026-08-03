"use client"

import * as React from "react"

import { cn } from "../lib/cn"
import type { CommentDoc, CommentMark, CommentNode } from "./doc"

/**
 * CommentBody — renders a stored comment document as React elements.
 *
 * There is no `dangerouslySetInnerHTML` anywhere in this file, and there never
 * should be. The document has already been rebuilt from an allow-list by
 * `validateCommentDoc` on the server; this component is the second half of that
 * guarantee. Anything it does not recognise renders as nothing.
 *
 * Theme contract: uses the standard AltaVue tokens — --color-text,
 * --color-text-muted, --color-border, --color-muted, --color-accent.
 */

const MARK_ORDER = ["link", "code", "strike", "italic", "bold"] as const

function applyMarks(
  content: React.ReactNode,
  marks: CommentMark[] | undefined,
  key: string
): React.ReactNode {
  if (!marks || marks.length === 0) return content

  // Apply in a fixed order so the same document always produces the same tree.
  let wrapped = content

  for (const markType of MARK_ORDER) {
    const mark = marks.find((m) => m.type === markType)
    if (!mark) continue

    switch (markType) {
      case "bold":
        wrapped = (
          <strong key={`${key}-b`} className="font-semibold">
            {wrapped}
          </strong>
        )
        break
      case "italic":
        wrapped = <em key={`${key}-i`}>{wrapped}</em>
        break
      case "strike":
        wrapped = (
          <s key={`${key}-s`} className="opacity-70">
            {wrapped}
          </s>
        )
        break
      case "code":
        wrapped = (
          <code
            key={`${key}-c`}
            className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[0.85em] text-[var(--color-text)]"
          >
            {wrapped}
          </code>
        )
        break
      case "link": {
        const href = mark.attrs?.href
        if (typeof href !== "string") break
        // target and rel are forced here, never read from the document.
        wrapped = (
          <a
            key={`${key}-a`}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[var(--color-accent)] underline decoration-[var(--color-accent)]/40 underline-offset-2 hover:decoration-[var(--color-accent)]"
          >
            {wrapped}
          </a>
        )
        break
      }
    }
  }

  return wrapped
}

function renderNodes(
  nodes: CommentNode[] | undefined,
  keyPrefix: string,
  currentUserId?: string
): React.ReactNode[] {
  if (!nodes) return []

  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`

    switch (node.type) {
      case "text":
        return (
          <React.Fragment key={key}>
            {applyMarks(node.text ?? "", node.marks, key)}
          </React.Fragment>
        )

      case "hardBreak":
        return <br key={key} />

      case "mention": {
        const id = node.attrs?.id as string | undefined
        const label = (node.attrs?.label as string | undefined) ?? "Unknown user"
        const isMe = Boolean(currentUserId && id === currentUserId)
        return (
          <span
            key={key}
            data-mention-id={id}
            className={cn(
              "rounded px-1 py-0.5 text-[0.95em] font-medium",
              isMe
                ? "bg-[var(--color-accent)]/25 text-[var(--color-text)]"
                : "bg-[var(--color-accent)]/12 text-[var(--color-text)]"
            )}
          >
            @{label}
          </span>
        )
      }

      case "paragraph":
        return (
          <p key={key} className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">
            {renderNodes(node.content, key, currentUserId)}
          </p>
        )

      case "bulletList":
        return (
          <ul key={key} className="my-2 list-disc space-y-0.5 pl-5">
            {renderNodes(node.content, key, currentUserId)}
          </ul>
        )

      case "orderedList": {
        const start = Number(node.attrs?.start ?? 1) || 1
        return (
          <ol
            key={key}
            start={start}
            className="my-2 list-decimal space-y-0.5 pl-5"
          >
            {renderNodes(node.content, key, currentUserId)}
          </ol>
        )
      }

      case "listItem":
        return (
          <li key={key} className="leading-relaxed">
            {renderNodes(node.content, key, currentUserId)}
          </li>
        )

      case "blockquote":
        return (
          <blockquote
            key={key}
            className="my-2 border-l-2 border-[var(--color-border-strong,var(--color-border))] pl-3 text-[var(--color-text-muted)] italic"
          >
            {renderNodes(node.content, key, currentUserId)}
          </blockquote>
        )

      case "codeBlock":
        return (
          <pre
            key={key}
            className="my-2 overflow-x-auto rounded-md bg-[var(--color-muted)] p-3 text-xs leading-relaxed"
          >
            <code>{renderNodes(node.content, key, currentUserId)}</code>
          </pre>
        )

      default:
        // Unknown node types render as nothing rather than as raw content.
        return null
    }
  })
}

export function CommentBody({
  doc,
  fallbackText,
  currentUserId,
  className,
}: {
  /** The stored structured document. */
  doc: CommentDoc | null | undefined
  /**
   * Plain text to show when there is no structured document — for example the
   * Customer Portal comments posted before rich text existed.
   */
  fallbackText?: string
  /** Highlights a mention of the signed-in user more strongly. */
  currentUserId?: string
  className?: string
}) {
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) {
    if (!fallbackText) return null
    return (
      <div
        className={cn(
          "text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-text)]",
          className
        )}
      >
        {fallbackText}
      </div>
    )
  }

  return (
    <div className={cn("text-sm text-[var(--color-text)]", className)}>
      {renderNodes(doc.content, "cb", currentUserId)}
    </div>
  )
}
