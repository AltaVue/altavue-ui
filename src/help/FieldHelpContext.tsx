"use client"

import * as React from "react"

/**
 * One entry in a module's tooltip glossary (its data/tooltip-glossary.json).
 * The glossary is the single source of help text for field-level tooltips, and
 * lives in each app (the text differs per module) — only the components are
 * shared. The app supplies its glossary through <FieldHelpProvider>.
 */
export type FieldHelpEntry = {
  module: string
  entity: string
  field: string
  label: string
  screens: string[]
  tooltip: string
}

type HelpLookup = (fieldId: string) => string | undefined

const FieldHelpContext = React.createContext<HelpLookup>(() => undefined)

/**
 * Provides the module's glossary to all <FieldHelp> / <FieldLabel> descendants.
 * Mount it once high in the app (e.g. the root layout) and pass the module's
 * own glossary array:
 *
 *   import glossary from "@/data/tooltip-glossary.json"
 *   <FieldHelpProvider glossary={glossary as FieldHelpEntry[]}>...</FieldHelpProvider>
 */
export function FieldHelpProvider({
  glossary,
  children,
}: {
  glossary: FieldHelpEntry[]
  children: React.ReactNode
}) {
  const lookup = React.useMemo<HelpLookup>(() => {
    const byField = new Map<string, string>()
    for (const entry of glossary) byField.set(entry.field, entry.tooltip)
    return (fieldId: string) => byField.get(fieldId)
  }, [glossary])

  return (
    <FieldHelpContext.Provider value={lookup}>
      {children}
    </FieldHelpContext.Provider>
  )
}

/**
 * Returns the plain-language help text for a field id, or undefined if the
 * field has no glossary entry (callers render nothing extra so unmapped fields
 * degrade gracefully).
 */
export function useFieldHelp(fieldId: string): string | undefined {
  return React.useContext(FieldHelpContext)(fieldId)
}
