# Build Plan: Restore File Menu by Rebuilding Missing Preload Script

## Task
The file menu is broken because `dist-electron/preload.js` is missing, causing `window.electronAPI` to be `undefined` in the renderer and crashing IPC communication.

## Current Implementation
- `vite.config.ts` (lines33–39) already configures the preload build correctly, targeting `src/preload.ts` → `dist-electron/preload.js`.
- `dist-electron/` currently only contains `main.js` and `main.js.map` — `preload.js` was never emitted.
- Renderer crashes at `src/renderer.ts:86` with `TypeError: Cannot read properties of undefined (reading 'onNew')` because `window.electronAPI` is undefined.
- Without the preload bridge, no IPC listeners (`menu:new`, `menu:open`, `menu:save-prompt`) are wired up.

## Assumptions
- `src/preload.ts` compiles without TypeScript errors.
- `npm run build` or `npm run dev` will successfully regenerate `preload.js` alongside `main.js`.
- The `vite-plugin-electron` configuration is functional and was simply not triggered for the preload target.

## Rollback Notes
- No source files are modified. Reverting is as simple as restoring the previous `dist-electron/` contents from git: `git checkout dist-electron/`.

## Definition of Done
- `dist-electron/preload.js` exists after rebuild.
- `window.electronAPI` is defined in the renderer (no console `TypeError`).
- File menu items (New, Open, Save) trigger their IPC handlers without crashing.

## Action Steps
<!-- step-id: step-1 -->
- [x] Rebuild the Electron bundles to regenerate `preload.js`
 - **Files:** `vite.config.ts` (read-only reference), `src/preload.ts` (input), `dist-electron/preload.js` (output)
 - **Approach:** Run `npm run build` (or `npm run dev` for a hot rebuild). The existing vite config already declares the preload entry; this step simply forces the bundler to emit it.
 - **Acceptance criteria:**
 - `dist-electron/preload.js` is present on disk.
 - No build errors are reported by Vite.
 - **Verification:** `ls -l dist-electron/preload.js` and `npm run build` exits with code0.
 - **Risks:**
 - If `src/preload.ts` has a TypeScript compile error, the build will fail and the root cause shifts to a code fix. In that case, inspect the build output for the specific error and fix it in `src/preload.ts`.

<!-- step-id: step-2 -->
- [x] Validate the file menu works end-to-end
 - **Files:** `src/renderer.ts`, `src/preload.ts`, `src/app_menu.ts`
 - **Approach:** Start the dev server (`npm run dev`), open the File menu, and click New / Open / Save. Confirm no `TypeError` appears in the renderer log and that IPC handlers fire.
 - **Acceptance criteria:**
 - No `Cannot read properties of undefined` error in the renderer console or `logs/renderer-*.log`.
 - File menu commands execute without crashing.
 - **Verification:** Run `npm run dev`, inspect the Electron renderer console, and verify the latest `logs/renderer-*.log` shows no preload-related errors.
 - **Risks:**
 - If the dev server caches stale state, stop it (`Ctrl+C`) and run `rm -rf dist-electron/ && npm run build` before retrying.
