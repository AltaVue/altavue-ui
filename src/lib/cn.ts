import { clsx, type ClassValue } from "clsx"

/**
 * Join class names conditionally. Mirrors the per-module `cn` helper so the
 * shared components style identically without depending on each app's copy.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
