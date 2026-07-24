# Build Plan: Right-click context menu with Cut / Copy / Paste / Select All

## Task
Add a custom right-click context menu to the editor textarea and preview div, providing Cut, Copy, Paste, and Select All (editor) or Copy and Select All (preview) via Electron IPC clipboard access.

## Current Implementation
The app uses contextIsolation: true with no clipboard IPC channels or context-menu handling. The editor is a <textarea id="editor"> and the preview is a <div id="preview"> in index.html. Native keyboard shortcuts (Ctrl+C/V) work via the browser, but right-click uses the default browser context menu. The app menu (main.ts) only has File and Help sections.

## Files to Change
- src/main.ts — Add IPC handlers (clipboard-read, clipboard-write, clipboard-clear) using Electron's clipboard module
- src/preload.ts — Expose copyText(), pasteText(), cutText() via contextBridge
- src/global.d.ts — Add TypeScript declarations for the new electronAPI clipboard methods
- src/renderer.ts — Add contextmenu listener on #editor and #preview, render a custom menu, wire menu items to IPC calls
- src/styles.css — Add CSS for the custom context menu overlay

## Assumptions
- Electron's clipboard API (clipboard.readText, clipboard.writeText, clipboard.clear) is available in the main process without extra permissions.
- The custom context menu will be a simple absolutely-positioned <div> overlay in the renderer, not electron's BrowserWindow.setMenuBarVisibility or Menu.buildFromTemplate (since contextIsolation blocks that in the renderer).
- The preview div's text selection works via standard browser selection (window.getSelection).
- No additional dependencies are needed.
- The editor textarea's value and selection can be read/written via standard DOM properties (textarea.value, textarea.setSelectionRange).

## Rollback Notes
Revert by restoring the original contents of src/main.ts, src/preload.ts, src/global.d.ts, src/renderer.ts, and src/styles.css from the last git commit (git checkout HEAD -- src/main.ts src/preload.ts src/global.d.ts src/renderer.ts src/styles.css).

## Definition of Done
- Right-clicking the editor textarea shows a custom context menu with Cut, Copy, Paste, and Select All options.
- Right-clicking the preview div shows a custom context menu with Copy and Select All options only.
- Cut, Copy, and Paste correctly interact with the system clipboard via Electron IPC.
- Select All selects all text in the editor or preview.
- The context menu closes after an action or when clicking elsewhere.
- The app builds and runs without TypeScript errors or runtime crashes.
- npm run build succeeds with no type errors.

## Action Steps
<!-- step-id: step-1 -->
- [x] Add clipboard IPC handlers to the main process
  - **Files:** src/main.ts
  - **Approach:** Add three IPC handlers using electron's clipboard module:
- clipboard-read: returns clipboard.readText()
- clipboard-write: calls clipboard.writeText(event.args[0])
- clipboard-clear: calls clipboard.clear() (for cut operations)
These will be registered via ipcMain.handle.
  - **Acceptance criteria:**
    - ipcMain.handle('clipboard-read', ...) is registered and returns clipboard text
    - ipcMain.handle('clipboard-write', ...) is registered and writes text
    - ipcMain.handle('clipboard-clear', ...) is registered and clears clipboard
    - No TypeScript errors in main.ts
  - **Verification:** Run `npm run build` and confirm no TypeScript compilation errors. Inspect src/main.ts to confirm the three ipcMain.handle registrations.
  - **Risks:**
    - If clipboard.clear() is not available on all platforms, the cut operation may leave stale clipboard content. Mitigation: use clipboard.writeText('') as fallback if needed.
<!-- step-id: step-2 -->
- [x] Expose clipboard methods via contextBridge and update type declarations
  - **Files:** src/preload.ts, src/global.d.ts
  - **Approach:** In preload.ts, add to the contextBridge.exposeInMainWorld object:
- copyText(): invoker('clipboard-read')
- pasteText(): invoker('clipboard-read') (same as copy, returns text for the renderer to insert)
- cutText(): invoker('clipboard-read') then invoker('clipboard-write') + invoker('clipboard-clear')
Actually, simpler: expose copyText() -> returns clipboard text, pasteText() -> returns clipboard text, cutText() -> writes to clipboard (returns nothing needed, renderer handles deletion). Let me refine: expose readClipboard() -> ipcRenderer.invoke('clipboard-read'), writeClipboard(text) -> ipcRenderer.invoke('clipboard-write', text), clearClipboard() -> ipcRenderer.invoke('clipboard-clear').
In global.d.ts, add these methods to the ElectronAPI interface.
  - **Acceptance criteria:**
    - contextBridge exposes readClipboard(), writeClipboard(text), clearClipboard()
    - global.d.ts declares these methods on window.electronAPI
    - No TypeScript errors in preload.ts or global.d.ts
  - **Verification:** Run `npm run build` and confirm no TypeScript errors. Inspect preload.ts and global.d.ts for correct bridge exposure and type declarations.
  - **Risks:**
    - contextBridge invoker calls are async — the renderer must handle Promises. This is acceptable since we'll use async/await in the renderer.
<!-- step-id: step-3 -->
- [x] Implement the custom context menu in the renderer with styling
  - **Files:** src/renderer.ts, src/styles.css
  - **Approach:** In renderer.ts:
1. Create a hidden <div id="context-menu"> element with menu items (Cut, Copy, Paste, Select All) as <div class="context-menu-item"> elements.
2. Add a 'contextmenu' event listener on #editor that:
   - Prevents default context menu
   - Builds menu items: Cut, Copy, Paste, Select All
   - Positions the menu at event coordinates
   - Shows the menu
3. Add a 'contextmenu' event listener on #preview that:
   - Prevents default context menu
   - Builds menu items: Copy, Select All (no Cut/Paste)
   - Positions and shows the menu
4. Wire each menu item to perform the action:
   - Cut: get selected text, write to clipboard via IPC, delete selection from textarea
   - Copy: get selected text, write to clipboard via IPC
   - Paste: read clipboard via IPC, insert at cursor position in textarea
   - Select All: select all text in the target element
5. Hide the menu on click outside or after an action.
6. In styles.css, add styling for #context-menu (position: fixed, background, border, shadow, z-index) and .context-menu-item (padding, hover effect, cursor).
  - **Acceptance criteria:**
    - Right-clicking the editor shows a custom menu with Cut, Copy, Paste, Select All
    - Right-clicking the preview shows a custom menu with Copy and Select All only
    - Cut copies selected text to clipboard and removes it from the editor
    - Copy copies selected text to clipboard
    - Paste inserts clipboard text at the cursor position in the editor
    - Select All selects all text in the respective element
    - Menu closes after an action or when clicking elsewhere
    - Menu is styled and visually distinct from the page content
    - No TypeScript or runtime errors
  - **Verification:** Run `npm run build` to confirm no build errors. Run `npm run dev` (or the equivalent start script) and manually test right-click on the editor and preview, verifying each menu item works correctly.
  - **Risks:**
    - Menu positioning near screen edges may clip — mitigation: clamp coordinates to viewport bounds.
    - Pasting into a textarea requires managing selection ranges correctly — use textarea.setSelectionRange and slice replacement.
    - The preview div may not be user-selectable by default — ensure CSS user-select is enabled or use window.getSelection().
<!-- step-id: step-4 -->
- [x] End-to-end validation: build, run, and smoke-test the full feature
  - **Approach:** Run `npm run build` to ensure the project compiles cleanly. Then run the Electron app via `npm run dev` (or the start script from package.json) and perform manual verification:
1. Type text in the editor, select a portion, right-click → Cut → verify clipboard and editor state
2. Type text, select, right-click → Copy → paste externally to verify
3. Copy text externally, right-click in editor → Paste → verify insertion
4. Right-click in editor → Select All → verify full selection
5. Right-click in preview → verify only Copy and Select All appear
6. Click outside menu → verify it closes
  - **Acceptance criteria:**
    - npm run build succeeds with zero errors
    - All context menu items function correctly in the running app
    - No console errors in the renderer or main process
  - **Verification:** `npm run build` exits with code 0. Manual smoke test of the running Electron app confirms all menu behaviors.
