// Types for @comet/ui/verify (AO-2063). Without this file an app's
// next.config.ts fails its own type-check ("could not find a declaration file").
// Keep in step with bin/verify.mjs; bin/verify.test.mjs checks the export list.

/** Module keys an app may declare in lib/platformModule.ts. */
export declare const MODULE_KEYS: readonly string[]
/** Per module: the only pages allowed to show no top bar (route paths, groups removed). */
export declare const PUBLIC_PAGES: Readonly<Record<string, readonly string[]>>
/** Local file names that must never exist in an app again. */
export declare const FORBIDDEN_FILES: readonly string[]
/** The canonical connector text (line endings normalised). */
export declare function canonicalConnector(): string
/** The version of @comet/ui this checker came from. */
export declare function installedVersion(): string
/** Every top-bar problem in the app at appRoot; empty when clean. Never throws. */
export declare function checkPlatformTopBar(appRoot: string): string[]
/** Throws (failing the build) when checkPlatformTopBar finds anything. */
export declare function verifyPlatformTopBar(appRoot?: string): void
