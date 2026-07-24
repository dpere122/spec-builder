# Build Plan: Add Orange Theme

## Task
Add a new "orange" color theme to the spec-builder application, making it selectable alongside the existing six themes (light, dark, sepia, high-contrast, magenta, blue-ocean).

## Current Implementation
- `src/renderer.ts` (line12) defines `THEMES` as a string array of theme identifiers.
- `index.html` (lines37–69) renders a `.theme-grid` with one `<button class="theme-btn">` per theme, each with a `data-theme` attribute and a `.theme-swatch` div.
- `src/styles.css` defines per-theme CSS rules at the end of the file (~90 lines per theme) covering body, editor, preview, modal, and theme-button styles. Context menu overrides live around lines314–406.
- Theme persistence is automatic via `applyTheme()` → `window.electronAPI.selectTheme()` → main process saves to `config.json`.

## Files to Change
- `src/renderer.ts` — add `"orange"` to the `THEMES` array
- `index.html` — add an orange theme button to the `.theme-grid`
- `src/styles.css` — add ~90 lines of orange-themed CSS rules and context menu overrides

## Assumptions
- The orange swatch inherits background color from `.theme-btn` (consistent with all existing swatches — no explicit per-swatch color rules exist).
- The display name for the theme in the picker will be "Orange".
- Orange theme palette: warm orange/amber tones on a light-to-medium background, following the same CSS selector pattern as existing themes.

## Rollback Notes
- Revert the three files via `git checkout HEAD -- src/renderer.ts index.html src/styles.css` or by dropping the commit that introduced the orange theme.

## Definition of Done
- `"orange"` appears in the `THEMES` array in `src/renderer.ts`.
- A new theme button with `data-theme="orange"` renders in the theme picker grid in `index.html`.
- Selecting the orange theme applies distinct orange-styled CSS across editor, preview, modal, and context menu surfaces.
- `npm run build` succeeds with no TypeScript or build errors.

## Action Steps
<!-- step-id: step-1 -->
- [x] Add `"orange"` to the `THEMES` array and theme button
 - **Files:** `src/renderer.ts`, `index.html`
 - **Approach:**
 - In `src/renderer.ts` line12, append `"orange"` to the `THEMES` array: `["light", "dark", "sepia", "high-contrast", "magenta", "blue-ocean", "orange"]`.
 - In `index.html` within `.theme-grid` (after the `blue-ocean` button around line69), add:
 ```html
 <button class="theme-btn" data-theme="orange" title="Orange theme">
 <div class="theme-swatch orange-swatch"></div>
 <span>Orange</span>
 </button>
 ```
 - **Acceptance criteria:**
 - `THEMES` array contains exactly7 entries including `"orange"`.
 - HTML contains a `<button class="theme-btn" data-theme="orange">` inside `.theme-grid`.
 - **Verification:** `grep -n 'orange' src/renderer.ts index.html` confirms both additions.
 - **Risks:**
 - None — purely additive changes.

<!-- step-id: step-2 -->
- [x] Add orange theme CSS rules
 - **Files:** `src/styles.css`
 - **Approach:**
 - Append ~90 lines of CSS at the end of the file following the exact selector pattern used by existing themes (`body.theme-orange ...`).
 - Cover: `body`, `.editor`, `.preview`, `.preview code, pre`, `.preview blockquote`, `.preview th`, `.preview td, th`, `.editor-pane`, `.preview-toggle` (base + hover + active), `.modal-content`, `.modal-content h2`, `.theme-btn` (base + hover + active), `.theme-label`, `.modal-close-btn` (base + hover).
 - Add context menu overrides: `body.theme-orange #context-menu`, `.context-menu-item`, `.context-menu-item:hover`, `.context-menu-separator`.
 - Use a warm orange palette (e.g., background `#fff8f0`, text `#5a2e00`, editor bg `#fff1e0`, accent `#e67e22`, preview code bg `#fdebd0`, blockquote border `#e67e22`, table header bg `#fdebd0`, borders `#e0c8a8`).
 - **Acceptance criteria:**
 - `grep -c 'theme-orange' src/styles.css` returns a count matching the number of selectors defined (~35+ rules).
 - No CSS syntax errors (confirmed by successful build).
 - **Verification:** `npm run build` completes without errors.
 - **Risks:**
 - Color contrast: ensure text remains readable on orange-tinted backgrounds.

<!-- step-id: step-3 -->
- [x] Validate the full build
 - **Files:** (none — verification step)
 - **Approach:** Run the project build to confirm TypeScript compiles and Vite bundles successfully with the new theme wired through.
 - **Acceptance criteria:**
 - `npm run build` exits with code0.
 - `dist/assets/` contains updated JS/CSS bundles.
 - **Verification:** `npm run build && echo "Build OK"`
 - **Risks:**
 - If the build fails, check `src/renderer.ts` for TypeScript errors and `src/styles.css` for CSS syntax issues.
