"use client"

import * as React from "react"

import { cn } from "../lib/cn"
import { absoluteTime, relativeTime } from "../lib/relativeTime"
import { CommentBody } from "./CommentBody"
import { CommentComposer } from "./CommentComposer"
import type { CommentDoc, CommentRecord, MentionCandidate } from "./doc"

/**
 * CommentThread — the discussion attached to one record.
 *
 * This component is presentational and knows nothing about the database. The
 * consuming module passes the comments in and supplies handlers that call its
 * own server actions. That is deliberate: @comet/ui has no Supabase dependency
 * and must not acquire one, because each app wires up authentication its own
 * way. It follows the same pattern as FieldHelpProvider, where the shared
 * component holds the behaviour and the app supplies the data.
 *
 * If `enabled` is false the component renders NOTHING rather than an error.
 * That is what makes it safe to drop into a screen before the entity type has
 * been registered in the database.
 */

const DEFAULT_EDIT_WINDOW_MINUTES = 15

function initials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("")
}

function withinEditWindow(createdAt: string, minutes: number): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created < minutes * 60_000
}

export type CommentThreadProps = {
  comments: CommentRecord[]
  currentUserId: string
  /** Admins may remove anyone's comment, for moderation. */
  currentUserIsAdmin?: boolean
  /**
   * Whether this surface is registered for comments.
   *
   *   `false`     — definitively not registered. Renders NOTHING, which is what
   *                 lets a later rollout phase drop the thread into a screen
   *                 before the database knows about that surface.
   *   `true`      — registered. Render the thread.
   *   `undefined` — not yet known, i.e. still loading. Renders a loading state.
   *
   * TRI-STATE ON PURPOSE. This was a plain boolean defaulting to false, which
   * meant any failure to load left it false and the whole section rendered
   * nothing at all — no error, no spinner, no empty box. A broken comment thread
   * was indistinguishable from a deliberately disabled one, and that is how a
   * completely broken feature reached Staging looking fine. Never let a failure
   * render as absence.
   */
  enabled?: boolean | undefined
  loading?: boolean
  /** A message to show above the composer, e.g. a failed save. */
  error?: string | null
  /**
   * How long after posting a comment can still be edited. Must match the
   * database policy, which is the real enforcement — this only decides whether
   * the Edit button is offered.
   */
  editWindowMinutes?: number
  onSubmit: (
    doc: CommentDoc,
    plainText: string,
    parentCommentId?: string
  ) => void | Promise<void>
  onEdit?: (
    commentId: string,
    doc: CommentDoc,
    plainText: string
  ) => void | Promise<void>
  onDelete?: (commentId: string) => void | Promise<void>
  onSearchMentions?: (query: string) => Promise<MentionCandidate[]>
  /** Offered alongside an error so a transient failure is recoverable. */
  onRetry?: () => void
  className?: string
}

export function CommentThread({
  comments,
  currentUserId,
  currentUserIsAdmin,
  enabled = true,
  loading,
  error,
  editWindowMinutes = DEFAULT_EDIT_WINDOW_MINUTES,
  onSubmit,
  onEdit,
  onDelete,
  onSearchMentions,
  onRetry,
  className,
}: CommentThreadProps) {
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)

  // Re-render on a slow tick so "just now" becomes "2 minutes ago" and the Edit
  // button disappears when the window closes, without needing a page refresh.
  const [, forceTick] = React.useState(0)
  React.useEffect(() => {
    const timer = window.setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // An error is ALWAYS shown, even before we know whether the surface is
  // registered — otherwise a failed load is invisible.
  if (error && !enabled) {
    return (
      <section className={cn("space-y-2", className)} aria-label="Comments">
        <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
          Comments
        </h3>
        <p
          role="alert"
          className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]"
        >
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
          >
            Try again
          </button>
        )}
      </section>
    )
  }

  // Still finding out whether this surface takes comments. Say so rather than
  // rendering nothing, which would look identical to "not available".
  if (enabled === undefined) {
    return (
      <section className={cn("space-y-2", className)} aria-label="Comments">
        <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
          Comments
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">Loading comments…</p>
      </section>
    )
  }

  // Definitively not registered for comments. This is the only case that
  // renders nothing, and it is deliberate.
  if (enabled === false) return null

  const topLevel = comments.filter((comment) => !comment.parentCommentId)
  const repliesByParent = new Map<string, CommentRecord[]>()
  for (const comment of comments) {
    if (!comment.parentCommentId) continue
    const list = repliesByParent.get(comment.parentCommentId) ?? []
    list.push(comment)
    repliesByParent.set(comment.parentCommentId, list)
  }

  const renderComment = (comment: CommentRecord, isReply: boolean) => {
    const isAuthor = comment.authorId === currentUserId
    const canEdit =
      Boolean(onEdit) && isAuthor && withinEditWindow(comment.createdAt, editWindowMinutes)
    const canDelete = Boolean(onDelete) && (isAuthor || Boolean(currentUserIsAdmin))
    const isEditing = editing === comment.id

    return (
      <div key={comment.id} className={cn("flex gap-2.5", isReply && "ml-8")}>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/20 font-semibold text-[var(--color-text)]",
            isReply ? "mt-0.5 h-6 w-6 text-[10px]" : "mt-0.5 h-8 w-8 text-xs"
          )}
          aria-hidden
        >
          {initials(comment.authorName)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {comment.authorName ?? "Unknown user"}
            </span>
            <span
              className="text-xs text-[var(--color-text-muted)]"
              title={absoluteTime(comment.createdAt)}
            >
              {relativeTime(comment.createdAt)}
            </span>
            {comment.editedAt && (
              <span
                className="text-xs text-[var(--color-text-subtle)]"
                title={`Edited ${absoluteTime(comment.editedAt)}`}
              >
                (edited)
              </span>
            )}
          </div>

          {isEditing && onEdit ? (
            <CommentComposer
              initialDoc={comment.bodyJson}
              submitLabel="Save changes"
              autoFocus
              onCancel={() => setEditing(null)}
              onSearchMentions={onSearchMentions}
              onSubmit={async (doc, text) => {
                await onEdit(comment.id, doc, text)
                setEditing(null)
              }}
            />
          ) : (
            <>
              <CommentBody
                doc={comment.bodyJson}
                fallbackText={comment.bodyText}
                currentUserId={currentUserId}
              />

              <div className="mt-1 flex items-center gap-3">
                {!isReply && (
                  <button
                    type="button"
                    onClick={() =>
                      setReplyingTo((current) =>
                        current === comment.id ? null : comment.id
                      )
                    }
                    className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    Reply
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(comment.id)}
                    className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(comment.id)}
                    className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}

          {confirmDelete === comment.id && onDelete && (
            <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2">
              <p className="text-xs text-[var(--color-text)]">
                Remove this comment? It is hidden rather than erased, so it can be
                recovered if needed.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmDelete(null)
                    await onDelete(comment.id)
                  }}
                  className="rounded bg-[var(--color-danger)] px-2 py-1 text-xs font-semibold text-white"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="rounded px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
                >
                  Keep it
                </button>
              </div>
            </div>
          )}

          {/* Replies */}
          {!isReply && (repliesByParent.get(comment.id)?.length ?? 0) > 0 && (
            <div className="mt-3 space-y-3">
              {repliesByParent
                .get(comment.id)!
                .map((reply) => renderComment(reply, true))}
            </div>
          )}

          {/* Reply composer */}
          {!isReply && replyingTo === comment.id && (
            <div className="mt-3">
              <CommentComposer
                submitLabel="Reply"
                placeholder={`Reply to ${comment.authorName ?? "this comment"}…`}
                autoFocus
                onCancel={() => setReplyingTo(null)}
                onSearchMentions={onSearchMentions}
                onSubmit={async (doc, text) => {
                  await onSubmit(doc, text, comment.id)
                  setReplyingTo(null)
                }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className={cn("space-y-4", className)} aria-label="Comments">
      <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
        Comments{comments.length > 0 ? ` (${comments.length})` : ""}
      </h3>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading comments…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No comments yet. Start the discussion below.
        </p>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment) => renderComment(comment, false))}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]"
        >
          {error}
        </p>
      )}

      <CommentComposer
        onSubmit={(doc, text) => onSubmit(doc, text)}
        onSearchMentions={onSearchMentions}
      />
    </section>
  )
}
