// @comet/ui/units — the AltaVue unit list as plain logic (AO-993). React-free: safe in a server component,
// a server action or a test. The dropdown and the hover label live in @comet/ui/units/select.
export {
  ALIAS_COLUMNS,
  QUANTITY_KINDS,
  UNIT_COLUMNS,
  cleanAliasRows,
  cleanUnitRows,
  extendedCount,
  groupUnits,
  resolveUnit,
  searchUnits,
  spellingKey,
  unitHover,
  unitShort,
  unitsForMenu,
} from './units'
export type {
  AliasRow,
  MenuOptions,
  UnitAvailability,
  UnitGroup,
  UnitResolution,
  UnitRow,
  UnitUseKind,
} from './units'
