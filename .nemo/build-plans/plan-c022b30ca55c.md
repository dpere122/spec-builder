# Build Plan: Add Pink Theme

## Task
Add a new "Pink" theme option to the spec-builder app, following the existing theme pattern established by the orange theme.

## Current Implementation
Themes are handled via three files:
- `src/renderer.ts` (line20) — `THEMES` array lists available theme IDs (currently ends with `"orange"`)
- `index.html` (around line73) — `.theme-grid` contains `<button class="theme-btn" data-theme="...">` elements, one per theme
- `src/styles.css` (lines908–1018) — Orange theme section defines all CSS overrides for that theme (context menu, body, editor, preview, code, blockquote, tables, editor-pane, preview-toggle, modal, theme-btn, theme-label, modal-close-btn)

The existing `applyTheme()` flow in `renderer.ts` automatically handles any theme ID in `THEMES`, so no IPC or main-process changes are needed.

## Files to Change
- `src/renderer.ts` — Add `"pink"` to the `THEMES` array
- `index.html` — Add a pink theme button to the `.theme-grid`
- `src/styles.css` — Append a pink theme CSS section mirroring the orange theme structure

## Assumptions
- The pink theme will use a light color scheme with the palette: `#fff0f5` (bg), `#5a0020` (text), `#e91e8f` (accent), `#ffe0eb` (secondary bg), `#e0b0c8` (borders)
- The CSS structure should exactly mirror the orange theme block (lines908–1018 in `styles.css`)
- The `.pink-swatch` class in HTML should use a representative pink gradient or solid color

## Rollback Notes
- Revert the three files: remove `"pink"` from `THEMES` in `renderer.ts`, remove the pink `<button>` from `index.html`, and delete the appended pink theme CSS block from `styles.css`. A single `git checkout -- src/renderer.ts index.html src/styles.css` suffices.

## Definition of Done
- Selecting "Pink" from the theme picker applies a fully styled pink theme across all UI surfaces (context menu, editor, preview, modals, buttons)
- The app builds without errors (`npm run build`)
- The pink theme persists across reloads via the existing `localStorage` mechanism

## Action Steps
<!-- step-id: step-1 -->
- [x] Add `"pink"` to the `THEMES` array and the pink theme button to the UI
 - **Files:** `src/renderer.ts`, `index.html`
 - **Approach:** In `src/renderer.ts`, append `"pink"` to the `THEMES` array at line20. In `index.html`, insert a new `<button class="theme-btn" data-theme="pink">` with a `.pink-swatch` div before the closing `</div>` of `.theme-grid`.
 - **Acceptance criteria:**
 - `THEMES` array includes `"pink"`
 - A pink theme button renders in the theme picker grid
 - **Verification:** `npm run build` succeeds; visually confirm the button appears in the dev build
 - **Risks:**
 - None significant; this is a data-only addition

<!-- step-id: step-2 -->
- [x] Append pink theme CSS overrides to `styles.css`
 - **Files:** `src/styles.css`
 - **Approach:** After line1018 (end of orange theme block), add a new `[data-theme="pink"]` section replicating every selector from the orange theme but with pink palette colors (`#fff0f5`, `#5a0020`, `#e91e8f`, `#ffe0eb`, `#e0b0c8`). Also add a `.pink-swatch` rule for the theme picker swatch.
 - **Acceptance criteria:**
 - All orange-theme selectors have pink equivalents
 - Pink theme applies consistently to context menus, editor, preview, code blocks, tables, modals, and buttons
 - **Verification:** `npm run build` succeeds; run the dev app, select Pink, and verify all UI surfaces reflect pink colors
 - **Risks:**
 - Missing a selector from the orange block could leave some UI elements unstyled under pink; cross-check selector count against the orange block

<!-- step-id: step-3 -->
- [x] Validate the full build and theme persistence
 - **Files:** (all three files)
 - **Approach:** Run the production build, then launch the app and cycle through themes including Pink. Reload the window and confirm the pink theme persists via `localStorage`.
 - **Acceptance criteria:**
 - `npm run build` completes with no errors
 - Pink theme survives a window reload
 - **Verification:** `npm run build && npm run dev` (or equivalent launch command); manual smoke test of theme selection and persistence
 - **Risks:**
 - None; the existing `applyTheme()` and persistence logic is shared and already proven with other themes
