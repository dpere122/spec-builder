# Build Plan: Refactor Electron main process into class-based architecture

## Task
Split the monolithic `src/main.ts` (363 lines) into a set of focused, exported classes across separate files, preserving all existing behavior (logging, window management, menu, IPC, app lifecycle).

## Current Implementation
Single procedural `src/main.ts` with mutable globals (`isDevMode`, `mainWindow`, `currentFilePath`), free functions for logging (`getLogsDir`, `setupLog`), window creation (`createWindow`), menu building (`buildMenuTemplate`), IPC handlers, and app lifecycle hooks. All tightly coupled through closures over globals.

## File Changes
- [modify] src/main.ts — Reduce to a thin bootstrap that instantiates the `App` class and starts it. All current logic moves out.
- [create] src/app.ts — New `App` class owns lifecycle (`whenReady`, `activate`, `window-all-closed`), composes `MainWindow`, `AppMenu`, `IPCManager`, `AppLogger`, and `isDevMode` state. Grounded by discovery's natural class boundary #5.
- [create] src/main_window.ts — New `MainWindow` class encapsulates BrowserWindow creation, console/log capture, dev vs prod URL loading, and startup theme load. Grounded by discovery lines 76-167.
- [create] src/app_menu.ts — New `AppMenu` class encapsulates menu template building, File/Help actions, `currentFilePath` state, and menu click handlers that reference `mainWindow`. Grounded by discovery lines 177-280.
- [create] src/ipc_manager.ts — New `IPCManager` class encapsulates `select-theme` and clipboard IPC handlers, with access to `mainWindow` for replies. Grounded by discovery lines 301-345.
- [create] src/app_logger.ts — New `AppLogger` class encapsulates `getLogsDir()`, `setupLog()`, timestamp utility, and append/log methods. Grounded by discovery lines 35-65.

## Assumptions
- All new `.ts` files use the same TypeScript config (`ES2022`, `commonjs`, `strict: true`, `rootDir: ./src`) — no tsconfig changes needed.
- The Vite config already resolves `src/main.ts` as the Electron entry; no config changes needed since `main.ts` still exists as the bootstrap.
- `src/preload.ts` and `src/renderer.ts` remain unchanged — they interact through IPC/contextBridge only.
- The `config.json` IPC path (`app.getPath('userData')`) and log directory behavior are preserved exactly.
- Exported public constructors and key interfaces (e.g., `LoggerConfig`, `MenuAction`, `IPCConfig`) per the resolved clarifying question.
- No new npm dependencies are required — only `electron` types already in `devDependencies`.
- The Vite dev-server parent-process kill logic in dev mode is preserved verbatim.

## Rollback Notes
Revert by restoring the original `src/main.ts` from git (`git checkout HEAD -- src/main.ts`) and deleting the new files (`src/app.ts`, `src/main_window.ts`, `src/app_menu.ts`, `src/ipc_manager.ts`, `src/app_logger.ts`). Since all changes are additive plus a rewrite of `main.ts`, a single `git reset --hard HEAD` restores everything.

## Definition of Done
- `npm run build` completes without TypeScript errors or warnings.
- `npx electron .` (or `npm start`) launches the app with identical behavior: window opens, menus work, theme selection persists, clipboard IPC works, logs are written, dev-mode Vite kill works.
- All exported classes and interfaces are importable from their respective files (verified by LSP diagnostics).
- No runtime errors in main process or renderer.

## Action Steps
<!-- step-id: step-1 -->
- [x] Create `AppLogger` class in `src/app_logger.ts`
  - **Files:** src/app_logger.ts
  - **Approach:** Extract `getLogsDir()` and `setupLog()` into a class `AppLogger` with a public constructor `constructor(config?: LoggerConfig)` and exported `interface LoggerConfig { logsDir?: string; prefix?: string }`. Methods: `getLogsDir(): string`, `setupLog(): void`, `log(message: string): void`, `append(line: string): void`, `timestamp(): string`. The class owns the `WriteStream` (fs.WriteStream). Read the current logging code from `src/main.ts` lines 35-65 to get exact implementation.
  - **Acceptance criteria:**
    - `AppLogger` class exports `LoggerConfig` interface and public constructor.
    - All logging functionality (dir creation, file creation, timestamp format, write stream) is preserved.
    - LSP diagnostics show no errors in `src/app_logger.ts`.
  - **Verification:** `lsp_get_diagnostics` on `src/app_logger.ts` — zero errors.
  - **Risks:**
    - Low — logging is isolated with no external dependencies beyond `fs`, `path`, `electron`.
