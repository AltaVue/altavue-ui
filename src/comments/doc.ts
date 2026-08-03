/**
 * Comment document model, validation, and plain-text extraction.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS FILE IS ONE OF TWO DEFENCES. IT IS NOT THE ONLY ONE, AND IT CAN BE
 * BYPASSED ENTIRELY.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A comment arrives as a structured TipTap document (JSON), never as HTML.
 * `validateCommentDoc` walks it and rebuilds it from scratch, keeping only the
 * node types, mark types and attributes on the allow-lists below. Anything
 * unrecognised is dropped rather than sanitised — there is no "clean it up and
 * hope" path.
 *
 * BE CLEAR ABOUT WHAT THIS DOES NOT GUARANTEE. An earlier version of this
 * comment claimed the validator meant untrusted content "never exists in the
 * first place". That was wrong, and the security review caught it. The insert
 * grant on the comments table is table-level, so any signed-in user can write
 * `body_json` straight to the REST API without this function ever running — and
 * the Customer Portal does write that way. So:
 *
 *   * Running this on the server before storing is necessary but NOT sufficient.
 *   * `CommentBody` must, and does, re-check anything dangerous at render time,
 *     in particular link schemes. That is the check that actually holds.
 *   * The database bounds size and derives the fields that matter in
 *     `comments_normalize()`, which every writer goes through.
 *
 * What genuinely does hold: comments render as React elements and nothing ever
 * touches `dangerouslySetInnerHTML`, so stored markup cannot become live markup.
 * That is why no HTML sanitiser library is needed — not because the input is
 * guaranteed clean.
 *
 * Making validation unavoidable (all writes through a database function) needs
 * the Customer Portal changed and is Phase 6 work.
 *
 * This module is deliberately free of React and of any browser API, so a server
 * action can import and run it in Node.
 */

// ── Document shape ──────────────────────────────────────────────────────────

export type CommentMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type CommentNode = {
  type: string
  attrs?: Record<string, unknown>
  marks?: CommentMark[]
  text?: string
  content?: CommentNode[]
}

export type CommentDoc = {
  type: "doc"
  content: CommentNode[]
}

/** A person who can be @mentioned: an AltaVue user account. */
export type MentionCandidate = {
  profileId: string
  fullName: string | null
  email: string | null
  personId?: string | null
}

/** One comment as the thread component needs it. */
export type CommentRecord = {
  id: string
  authorId: string
  authorName: string | null
  bodyJson: CommentDoc | null
  bodyText: string
  createdAt: string
  editedAt: string | null
  parentCommentId: string | null
}

// ── Allow-lists ─────────────────────────────────────────────────────────────
// Keep these tight. Every entry is a deliberate decision, and anything absent
// is silently discarded on the way in.

/** Block and inline nodes a comment may contain. */
const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "mention",
])

/** Formatting marks a run of text may carry. */
const ALLOWED_MARKS = new Set(["bold", "italic", "strike", "code", "link"])

/**
 * Attributes kept per node type. Anything not listed is dropped, so a crafted
 * document cannot smuggle an event handler, a style, or an id through.
 */
const ALLOWED_NODE_ATTRS: Record<string, readonly string[]> = {
  orderedList: ["start"],
  codeBlock: ["language"],
  mention: ["id", "label"],
}

/** Attributes kept per mark type. `link` keeps only href — target and rel are
 *  forced at render time, never taken from the document. */
const ALLOWED_MARK_ATTRS: Record<string, readonly string[]> = {
  link: ["href"],
}

/**
 * Links must be plain web links. No javascript:, data:, mailto:, or file:.
 *
 * Exported because the RENDERER must re-test it. This check on the way in is not
 * sufficient on its own: the comments table grants insert at table level, so a
 * client can store a document without this function ever running.
 */
export const SAFE_HREF = /^https?:\/\//i

// ── Limits ──────────────────────────────────────────────────────────────────
// A comment is a comment. These caps stop a single post from becoming a
// denial-of-service against the database, the renderer, or a future email.

export const COMMENT_LIMITS = {
  /** Maximum nesting depth of the document tree. */
  maxDepth: 10,
  /** Maximum total number of nodes. */
  maxNodes: 2000,
  /** Maximum total characters of text content. */
  maxTextLength: 20_000,
  /** Maximum length of a single link target. */
  maxHrefLength: 2048,
  /** Maximum @mentions in one comment. */
  maxMentions: 25,
} as const

export type ValidationResult =
  | { ok: true; doc: CommentDoc; text: string; mentionIds: string[] }
  | { ok: false; error: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Validate and rebuild an untrusted comment document.
 *
 * Returns the cleaned document, its plain-text shadow copy, and the profile ids
 * of everyone mentioned. Call this on the SERVER before storing anything — a
 * client-side check is a convenience, not a control.
 */
export function validateCommentDoc(input: unknown): ValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: "The comment could not be read." }
  }
  if (input.type !== "doc") {
    return { ok: false, error: "The comment is not a valid document." }
  }

  let nodeCount = 0
  let textLength = 0
  const mentionIds: string[] = []

  function walkMarks(raw: unknown): CommentMark[] | undefined {
    if (!Array.isArray(raw)) return undefined

    const kept: CommentMark[] = []
    for (const mark of raw) {
      if (!isPlainObject(mark)) continue
      const type = mark.type
      if (typeof type !== "string" || !ALLOWED_MARKS.has(type)) continue

      const allowed = ALLOWED_MARK_ATTRS[type]
      let attrs: Record<string, unknown> | undefined

      if (allowed && isPlainObject(mark.attrs)) {
        attrs = {}
        for (const key of allowed) {
          const value = mark.attrs[key]
          if (value === undefined || value === null) continue
          attrs[key] = value
        }
      }

      if (type === "link") {
        const href = attrs?.href
        if (typeof href !== "string") continue
        const trimmed = href.trim()
        if (trimmed.length === 0 || trimmed.length > COMMENT_LIMITS.maxHrefLength) continue
        if (!SAFE_HREF.test(trimmed)) continue
        attrs = { href: trimmed }
      }

      kept.push(attrs && Object.keys(attrs).length > 0 ? { type, attrs } : { type })
    }

    return kept.length > 0 ? kept : undefined
  }

  function walkNode(raw: unknown, depth: number): CommentNode | null {
    if (depth > COMMENT_LIMITS.maxDepth) return null
    if (!isPlainObject(raw)) return null

    const type = raw.type
    if (typeof type !== "string" || !ALLOWED_NODES.has(type)) return null

    nodeCount += 1
    if (nodeCount > COMMENT_LIMITS.maxNodes) {
      throw new RangeError("too-many-nodes")
    }

    const node: CommentNode = { type }

    // Attributes, filtered to the allow-list for this node type.
    const allowedAttrs = ALLOWED_NODE_ATTRS[type]
    if (allowedAttrs && isPlainObject(raw.attrs)) {
      const attrs: Record<string, unknown> = {}
      for (const key of allowedAttrs) {
        const value = raw.attrs[key]
        if (value === undefined || value === null) continue
        attrs[key] = value
      }
      if (Object.keys(attrs).length > 0) node.attrs = attrs
    }

    // A mention must name a real profile id, or it is not a mention.
    if (type === "mention") {
      const id = node.attrs?.id
      const label = node.attrs?.label
      if (typeof id !== "string" || !UUID_RE.test(id)) return null
      const safeLabel =
        typeof label === "string" && label.trim().length > 0
          ? label.trim().slice(0, 120)
          : "Unknown user"
      node.attrs = { id, label: safeLabel }
      if (!mentionIds.includes(id)) {
        if (mentionIds.length >= COMMENT_LIMITS.maxMentions) {
          throw new RangeError("too-many-mentions")
        }
        mentionIds.push(id)
      }
      return node
    }

    if (type === "text") {
      if (typeof raw.text !== "string") return null
      // Strip control characters other than tab and newline. These have caused
      // real problems before, notably in email subject lines.
      // Strip control characters (a newline in a future email subject is a
      // header-injection risk) and the invisible characters used to disguise
      // text: bidirectional overrides can make a comment read differently from
      // what it says, and zero-width characters can hide content entirely.
      const text = raw.text
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
      if (text.length === 0) return null
      textLength += text.length
      if (textLength > COMMENT_LIMITS.maxTextLength) {
        throw new RangeError("too-long")
      }
      node.text = text
      const marks = walkMarks(raw.marks)
      if (marks) node.marks = marks
      return node
    }

    if (Array.isArray(raw.content)) {
      const content: CommentNode[] = []
      for (const child of raw.content) {
        const walked = walkNode(child, depth + 1)
        if (walked) content.push(walked)
      }
      if (content.length > 0) node.content = content
    }

    // A container that ended up with nothing in it is not worth keeping,
    // except a paragraph, which is how an intentional blank line is expressed.
    const isContainer =
      type === "bulletList" ||
      type === "orderedList" ||
      type === "listItem" ||
      type === "blockquote"
    if (isContainer && !node.content) return null

    return node
  }

  let content: CommentNode[]
  try {
    const rawContent = Array.isArray(input.content) ? input.content : []
    content = []
    for (const child of rawContent) {
      const walked = walkNode(child, 1)
      if (walked) content.push(walked)
    }
  } catch (err) {
    if (err instanceof RangeError) {
      switch (err.message) {
        case "too-many-nodes":
          return { ok: false, error: "That comment is too complex. Please shorten it." }
        case "too-long":
          return {
            ok: false,
            error: `A comment can be up to ${COMMENT_LIMITS.maxTextLength.toLocaleString()} characters.`,
          }
        case "too-many-mentions":
          return {
            ok: false,
            error: `You can mention up to ${COMMENT_LIMITS.maxMentions} people in one comment.`,
          }
      }
    }
    return { ok: false, error: "The comment could not be read." }
  }

  const doc: CommentDoc = { type: "doc", content }
  const text = docToPlainText(doc)

  if (text.trim().length === 0 && mentionIds.length === 0) {
    return { ok: false, error: "Write something before posting." }
  }

  return { ok: true, doc, text, mentionIds }
}

/**
 * Flatten a comment document to plain text — the shadow copy stored in
 * comments.body_text, used for search, notification previews, and anywhere
 * rich text cannot be rendered.
 */
export function docToPlainText(doc: CommentDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return ""

  const lines: string[] = []

  function renderInline(nodes: CommentNode[] | undefined): string {
    if (!nodes) return ""
    let out = ""
    for (const node of nodes) {
      if (node.type === "text") {
        out += node.text ?? ""
      } else if (node.type === "mention") {
        out += `@${(node.attrs?.label as string | undefined) ?? "Unknown user"}`
      } else if (node.type === "hardBreak") {
        out += "\n"
      } else if (node.content) {
        out += renderInline(node.content)
      }
    }
    return out
  }

  function walk(nodes: CommentNode[], listPrefix?: (index: number) => string) {
    nodes.forEach((node, index) => {
      switch (node.type) {
        case "paragraph": {
          const text = renderInline(node.content)
          lines.push(listPrefix ? `${listPrefix(index)}${text}` : text)
          break
        }
        case "codeBlock":
          lines.push(renderInline(node.content))
          break
        case "blockquote":
          if (node.content) {
            const before = lines.length
            walk(node.content)
            for (let i = before; i < lines.length; i += 1) lines[i] = `> ${lines[i]}`
          }
          break
        case "bulletList":
          if (node.content) {
            node.content.forEach((item) => {
              if (item.content) walk(item.content, () => "- ")
            })
          }
          break
        case "orderedList":
          if (node.content) {
            const start = Number(node.attrs?.start ?? 1) || 1
            node.content.forEach((item, itemIndex) => {
              if (item.content) walk(item.content, () => `${start + itemIndex}. `)
            })
          }
          break
        default:
          if (node.content) walk(node.content)
          else if (node.type === "text" || node.type === "mention") {
            lines.push(renderInline([node]))
          }
      }
    })
  }

  walk(doc.content)

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/** The profile ids @mentioned anywhere in a document. */
export function extractMentionIds(doc: CommentDoc | null | undefined): string[] {
  const found: string[] = []
  if (!doc || !Array.isArray(doc.content)) return found

  function walk(nodes: CommentNode[]) {
    for (const node of nodes) {
      if (node.type === "mention") {
        const id = node.attrs?.id
        if (typeof id === "string" && UUID_RE.test(id) && !found.includes(id)) {
          found.push(id)
        }
      }
      if (node.content) walk(node.content)
    }
  }

  walk(doc.content)
  return found
}

/** Shorten text for a notification preview or an email subject line. */
export function toPreview(text: string, maxLength = 160): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= maxLength) return flat
  return `${flat.slice(0, maxLength - 1).trimEnd()}…`
}

/** An empty document, for a fresh composer. */
export function emptyDoc(): CommentDoc {
  return { type: "doc", content: [{ type: "paragraph" }] }
}
