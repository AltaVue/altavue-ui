'use client'
// @comet/ui/topbar — a fixed icon set. The old reports menus did
// `import * as LucideIcons`, which pulls every icon in the library into the
// page; a name the registry gives that is not listed here falls back to FileText.
import {
  Activity, BookOpen, Building2, Calculator, Calendar, CalendarClock, ChartColumn, Clock, ExternalLink, FileCheck,
  FileText, Gauge, HeartPulse, House, LayoutDashboard, ListChecks, Lock, Search, ShieldAlert, SquareKanban,
  TrendingUp, TriangleAlert, Users,
} from 'lucide-react'
import type { SwitcherIcon } from './modules'

type IconC = React.ComponentType<{ size?: number; color?: string; 'aria-hidden'?: boolean }>

export const SWITCHER_ICONS: Record<SwitcherIcon, IconC> = {
  home: House,
  scope: FileCheck,
  estimation: Calculator,
  vantage: ListChecks,
  agile: SquareKanban,
  scheduler: Calendar,
  time: Clock,
  stakeholders: Building2,
  library: BookOpen,
  portal: Users,
}

const REPORT_ICONS: Record<string, IconC> = {
  LayoutDashboard, CalendarClock, AlertTriangle: TriangleAlert, TriangleAlert, Users, Activity, ShieldAlert,
  TrendingUp, HeartPulse, Gauge, ListChecks, FileText,
}

export function reportIcon(name: string | null): IconC {
  return (name && Object.prototype.hasOwnProperty.call(REPORT_ICONS, name) ? REPORT_ICONS[name] : FileText) as IconC
}

export { ChartColumn as ReportsIcon, ExternalLink as ExternalLinkIcon, Search as SearchIcon, Lock as LockIcon }
