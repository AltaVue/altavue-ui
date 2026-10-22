// @comet/ui/help — the field-level tooltip help system on its own (v0.3.1, AO-2005).
//
// Import the tooltip components from here rather than from the root
// '@comet/ui' entry. The root entry also re-exports the comment editor
// (TipTap), and a webpack build of a module that imports the root entry from a
// client component ships the whole editor to every page, even when the module
// never shows a comment box. Found in Agile during AO-2005: roughly 430 KB of
// browser JavaScript on every page, including login. Importing from here ships
// only what the tooltips need.

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../ui/tooltip"
export { Label } from "../ui/label"
export { FieldHelp, FieldLabel } from "./FieldHelp"
export { FieldHelpProvider, useFieldHelp } from "./FieldHelpContext"
export type { FieldHelpEntry } from "./FieldHelpContext"
