"use client"

import * as React from "react"
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Mention from "@tiptap/extension-mention"

import { cn } from "../lib/cn"
import { MentionList, type MentionListHandle } from "./MentionList"
import {
  COMMENT_LIMITS,
  emptyDoc,
  type CommentDoc,
  type MentionCandidate,
} from "./doc"

/**
 * CommentComposer — the rich-text box someone types a comment into.
 *
 * Formatting offered: bold, italic, strikethrough, inline code, bullet and
 * numbered lists, links, block quotes, code blocks, emoji, and @mentions. The
 * editor is configured to produce ONLY those node and mark types, matching the
 * allow-list in doc.ts exactly — so what the person can type is what the server
 * will accept, and nothing gets silently stripped on save.
 *
 * Headings, horizontal rules, and underline are switched off on purpose. A
 * comment is not a document, and every extra node type is another thing the
 * validator has to reason about.
 *
 * Attachments are NOT supported here. AltaVue already has two attachment
 * mechanisms and a third would be a maintenance liability.
 */

const EMOJI = [
  "👍", "👎", "✅", "❌", "⚠️", "🎯", "🚧", "🔧",
  "📌", "📅", "💰", "📈", "📉", "🙏", "👏", "🔥",
  "🤔", "👀", "💡", "❓", "‼️", "🙂", "😄", "😐",
]

type ToolbarButtonProps = {
  active?: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the caret where it is — the editor handles focus itself.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-medium transition-colors",
        "text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-[var(--color-muted)] text-[var(--color-text)]"
      )}
    >
      {children}
    </button>
  )
}

export type CommentComposerProps = {
  /** Existing content, when editing rather than writing something new. */
  initialDoc?: CommentDoc | null
  placeholder?: string
  /** Disables everything — while a save is in flight, for example. */
  disabled?: boolean
  submitLabel?: string
  /** Shows a Cancel button. Omit for the always-present "new comment" box. */
  onCancel?: () => void
  /**
   * Called with the document and its plain text. The plain text here is for
   * an optimistic preview only — the server derives its own copy from the
   * document it validates, and that is the one that gets stored.
   */
  onSubmit: (doc: CommentDoc, plainText: string) => void | Promise<void>
  /**
   * Looks up who can be @mentioned. Should call the server, which serves the
   * list from a database function so the browser can never read the profiles
   * table directly.
   */
  onSearchMentions?: (query: string) => Promise<MentionCandidate[]>
  autoFocus?: boolean
  className?: string
}

export function CommentComposer({
  initialDoc,
  placeholder = "Add a comment… use @ to mention someone",
  disabled,
  submitLabel = "Comment",
  onCancel,
  onSubmit,
  onSearchMentions,
  autoFocus,
  className,
}: CommentComposerProps) {
  const [submitting, setSubmitting] = React.useState(false)
  const [linkBarOpen, setLinkBarOpen] = React.useState(false)
  const [linkValue, setLinkValue] = React.useState("")
  const [linkError, setLinkError] = React.useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = React.useState(false)
  const [isEmpty, setIsEmpty] = React.useState(true)

  // Held in a ref so the mention extension, which is created once, always sees
  // the current lookup function.
  const searchRef = React.useRef(onSearchMentions)
  React.useEffect(() => {
    searchRef.current = onSearchMentions
  }, [onSearchMentions])

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({
        // Off on purpose — see the note at the top of this file.
        heading: false,
        horizontalRule: false,
        underline: false,
        // StarterKit ships Link in TipTap 3, so it is configured here rather
        // than installed as a separate extension.
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https"],
          HTMLAttributes: {
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        },
      }),
      Mention.configure({
        HTMLAttributes: { class: "altavue-mention" },
        suggestion: {
          char: "@",
          allowSpaces: false,
          items: async ({ query }: { query: string }) => {
            const search = searchRef.current
            if (!search) return []
            try {
              return await search(query)
            } catch {
              return []
            }
          },
          render: () => {
            let component: ReactRenderer<MentionListHandle> | null = null
            let host: HTMLDivElement | null = null

            const place = (rect: DOMRect | null) => {
              if (!host || !rect) return
              host.style.top = `${rect.bottom + window.scrollY + 4}px`
              host.style.left = `${rect.left + window.scrollX}px`
            }

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  editor: props.editor,
                  props: {
                    items: props.items ?? [],
                    query: props.query,
                    command: props.command,
                  },
                })

                host = document.createElement("div")
                host.style.position = "absolute"
                host.style.zIndex = "60"
                host.appendChild(component.element)
                document.body.appendChild(host)
                place(props.clientRect?.() ?? null)
              },
              onUpdate: (props: any) => {
                component?.updateProps({
                  items: props.items ?? [],
                  query: props.query,
                  command: props.command,
                })
                place(props.clientRect?.() ?? null)
              },
              onKeyDown: (props: any) => {
                if (props.event.key === "Escape") {
                  host?.remove()
                  host = null
                  return true
                }
                return component?.ref?.onKeyDown(props) ?? false
              },
              onExit: () => {
                host?.remove()
                host = null
                component?.destroy()
                component = null
              },
            }
          },
        },
      }),
    ],
    []
  )

  const editor = useEditor({
    extensions,
    content: initialDoc ?? emptyDoc(),
    editable: !disabled && !submitting,
    autofocus: autoFocus ? "end" : false,
    // Required in Next.js: the editor must not render during the server pass.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[72px] max-h-64 overflow-y-auto px-3 py-2 text-sm leading-relaxed",
          "text-[var(--color-text)] focus:outline-none",
          "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-border)] [&_blockquote]:pl-3 [&_blockquote]:italic",
          "[&_pre]:my-2 [&_pre]:rounded-md [&_pre]:bg-[var(--color-muted)] [&_pre]:p-3 [&_pre]:text-xs",
          "[&_code]:rounded [&_code]:bg-[var(--color-muted)] [&_code]:px-1 [&_code]:text-[0.85em]",
          "[&_.altavue-mention]:rounded [&_.altavue-mention]:bg-[var(--color-accent)]/15 [&_.altavue-mention]:px-1 [&_.altavue-mention]:font-medium"
        ),
        "aria-label": "Comment",
      },
    },
    onUpdate: ({ editor: instance }) => {
      const text = instance.getText().trim()
      const hasMention = instance.getJSON()
        ? JSON.stringify(instance.getJSON()).includes('"mention"')
        : false
      setIsEmpty(text.length === 0 && !hasMention)
    },
  })

  React.useEffect(() => {
    editor?.setEditable(!disabled && !submitting)
  }, [editor, disabled, submitting])

  const handleSubmit = async () => {
    if (!editor || submitting || isEmpty) return

    const doc = editor.getJSON() as CommentDoc
    const text = editor.getText()

    if (text.length > COMMENT_LIMITS.maxTextLength) return

    setSubmitting(true)
    try {
      await onSubmit(doc, text)
      if (!initialDoc) {
        editor.commands.clearContent(true)
        setIsEmpty(true)
      }
    } finally {
      setSubmitting(false)
      setLinkBarOpen(false)
      setEmojiOpen(false)
    }
  }

  const applyLink = () => {
    if (!editor) return
    const raw = linkValue.trim()

    if (raw.length === 0) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      setLinkBarOpen(false)
      setLinkValue("")
      setLinkError(null)
      return
    }

    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(href)) {
      setLinkError("Enter a full web address, for example https://example.com")
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    setLinkBarOpen(false)
    setLinkValue("")
    setLinkError(null)
  }

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]",
          className
        )}
      >
        <div className="min-h-[112px] px-3 py-2 text-sm text-[var(--color-text-subtle)]">
          {placeholder}
        </div>
      </div>
    )
  }

  const busy = disabled || submitting

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]",
        "focus-within:border-[var(--color-accent)]/60",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] px-2 py-1">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={editor.isActive("code")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <span className="font-mono">{"</>"}</span>
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" aria-hidden />

        <ToolbarButton
          label="Bulleted list"
          active={editor.isActive("bulletList")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          ❝
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          active={editor.isActive("codeBlock")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <span className="font-mono text-[10px]">{"{ }"}</span>
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" aria-hidden />

        <ToolbarButton
          label="Link"
          active={editor.isActive("link") || linkBarOpen}
          disabled={busy}
          onClick={() => {
            setEmojiOpen(false)
            setLinkError(null)
            setLinkValue((editor.getAttributes("link").href as string) ?? "")
            setLinkBarOpen((open) => !open)
          }}
        >
          🔗
        </ToolbarButton>
        <ToolbarButton
          label="Emoji"
          active={emojiOpen}
          disabled={busy}
          onClick={() => {
            setLinkBarOpen(false)
            setEmojiOpen((open) => !open)
          }}
        >
          🙂
        </ToolbarButton>
      </div>

      {/* Link bar */}
      {linkBarOpen && (
        <div className="border-b border-[var(--color-border)] px-2 py-2">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={linkValue}
              autoFocus
              placeholder="https://example.com"
              onChange={(event) => {
                setLinkValue(event.target.value)
                setLinkError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  applyLink()
                }
                if (event.key === "Escape") {
                  event.preventDefault()
                  setLinkBarOpen(false)
                }
              }}
              className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-xs text-[var(--color-text)] focus:border-[var(--color-accent)]/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={applyLink}
              className="rounded bg-[var(--color-accent)] px-2 py-1 text-xs font-semibold text-[var(--color-accent-text)]"
            >
              Apply
            </button>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            {linkError ?? "Leave it blank and apply to remove an existing link."}
          </p>
        </div>
      )}

      {/* Emoji palette */}
      {emojiOpen && (
        <div className="grid grid-cols-8 gap-0.5 border-b border-[var(--color-border)] px-2 py-2">
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Insert ${emoji}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor.chain().focus().insertContent(emoji).run()
                setEmojiOpen(false)
              }}
              className="flex h-7 items-center justify-center rounded text-base hover:bg-[var(--color-muted)]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <EditorContent editor={editor} />

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-2 py-1.5">
        <span className="text-[11px] text-[var(--color-text-subtle)]">
          Type @ to mention someone on this project
        </span>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || isEmpty}
            className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-text)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
