"use client"

import * as React from "react"

import { Label } from "../ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import { useFieldHelp } from "./FieldHelpContext"
import { cn } from "../lib/cn"

/**
 * Wraps any label or column-header text. When the glossary (supplied via
 * <FieldHelpProvider>) has help for `fieldId`, the text gains a subtle dotted
 * underline on hover/focus and shows the help in a tooltip; the tooltip hides
 * when the pointer leaves or focus moves away. When there is no glossary entry,
 * the children render unchanged so nothing breaks.
 */
export function FieldHelp({
  fieldId,
  children,
  className,
}: {
  fieldId: string
  children: React.ReactNode
  className?: string
}) {
  const help = useFieldHelp(fieldId)
  if (!help) return <>{children}</>

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn(
              "cursor-help rounded-sm underline decoration-dotted decoration-transparent underline-offset-4 outline-none transition-colors",
              "hover:decoration-[var(--color-text-subtle)] focus-visible:decoration-[var(--color-text-subtle)]",
              "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
              className
            )}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{help}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Drop-in replacement for <Label> that adds hover/focus help from the glossary.
 * Pass the glossary `fieldId`; everything else behaves like the normal Label.
 */
export function FieldLabel({
  fieldId,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Label> & { fieldId: string }) {
  return (
    <Label className={className} {...props}>
      <FieldHelp fieldId={fieldId}>{children}</FieldHelp>
    </Label>
  )
}
