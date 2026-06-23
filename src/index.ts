// @comet/ui — shared internal UI for the COMET platform.
// Field-level tooltip help system (piloted in Tracker, packaged from Agile).

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
