// @comet/ui — shared internal UI for the AltaVue platform.

// ── Field-level tooltip help system ─────────────────────────────────────────
// (piloted in Tracker, packaged from Agile)

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./ui/tooltip"
export { Label } from "./ui/label"
export { FieldHelp, FieldLabel } from "./help/FieldHelp"
export { FieldHelpProvider, useFieldHelp } from "./help/FieldHelpContext"
export type { FieldHelpEntry } from "./help/FieldHelpContext"

// ── Comments and @mentions ──────────────────────────────────────────────────
// Added in v0.2.0. The thread and composer are presentational: the consuming
// module supplies the data and the save handlers, so this package stays free of
// any database or authentication dependency.

export { CommentThread } from "./comments/CommentThread"
export type { CommentThreadProps } from "./comments/CommentThread"
export { CommentComposer } from "./comments/CommentComposer"
export type { CommentComposerProps } from "./comments/CommentComposer"
export { CommentBody } from "./comments/CommentBody"
export { MentionList } from "./comments/MentionList"
export type { MentionListHandle } from "./comments/MentionList"

// The validation walker is the security boundary for comments. Import it in a
// SERVER action and run it on anything that arrives from a browser before it is
// stored. It has no React and no browser dependency, so it runs in Node.
export {
  validateCommentDoc,
  docToPlainText,
  extractMentionIds,
  toPreview,
  emptyDoc,
  COMMENT_LIMITS,
} from "./comments/doc"
export type {
  CommentDoc,
  CommentNode,
  CommentMark,
  CommentRecord,
  MentionCandidate,
  ValidationResult,
} from "./comments/doc"

// ── Helpers ─────────────────────────────────────────────────────────────────

export { relativeTime, absoluteTime } from "./lib/relativeTime"
export { cn } from "./lib/cn"
