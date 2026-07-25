# Build Plan: Refactor monolithic styles.css into per-theme files

## Task
Split the 1439-line src/styles.css into separate files per theme (dark, sepia, high-contrast, magenta, blue-ocean, orange, pink), a base reset file, theme-picker modal styles, and a consolidated context-menu file. Re-link everything via @import so the Electron renderer continues to work unchanged.

## Current Implementation
src/styles.css is a single 1439-line file containing: base/reset styles (lines 1–163), theme-picker modal (165–602), context menu (604–744), and per-theme blocks for dark, sepia, high-contrast, magenta, blue-ocean, orange, and pink (746–1439). The light theme has no dedicated body.theme-light block — base styles serve as default. Context-menu per-theme overrides are scattered in the shared section and inside orange/pink blocks. src/renderer.ts line 3 imports ./styles.css. Vite handles native CSS @import.

## File Changes
- [create] src/styles/base.css — Extracts base/reset styles (*.container, .pane, .editor, .preview) from lines 1–163 of src/styles.css.
- [create] src/styles/theme-picker.css — Extracts theme-picker modal dialog styles (.modal-overlay, .theme-grid, swatches, preview panels) from lines 165–602.
- [create] src/styles/context-menu.css — Extracts all context-menu styles (#context-menu, .context-menu-item, separators) from lines 604–744, consolidated with per-theme overrides from dark, sepia, high-contrast, magenta, blue-ocean, orange, and pink blocks as requested.
- [create] src/styles/themes/dark.css — Extracts body.theme-dark block from lines 746–838.
- [create] src/styles/themes/sepia.css — Extracts body.theme-sepia block from lines 840–932.
- [create] src/styles/themes/high-contrast.css — Extracts body.theme-high-contrast block from lines 934–1027.
- [create] src/styles/themes/magenta.css — Extracts body.theme-magenta block from lines 1029–1121.
- [create] src/styles/themes/blue-ocean.css — Extracts body.theme-blue-ocean block from lines 1123–1215.
- [create] src/styles/themes/orange.css — Extracts body.theme-orange block from lines 1217–1327, minus context-menu overrides (moved to context-menu.css).
- [create] src/styles/themes/pink.css — Extracts body.theme-pink block from lines 1329–1439, minus context-menu overrides (moved to context-menu.css).
- [modify] src/styles.css — Replaces the monolithic content with @import statements that pull in base.css, theme-picker.css, context-menu.css, and all theme files. This is the single entry point imported by renderer.ts.

## Assumptions
- Vite's native CSS @import support works for relative paths under src/styles/ — no PostCSS or plugin config needed.
- The light theme requires no dedicated file since base styles (in base.css) serve as the default.
- Context-menu per-theme overrides currently embedded inside orange and pink theme blocks will be extracted and consolidated into context-menu.css alongside the shared overrides.
- No CSS custom properties or variables are used, so no migration of var() references is needed.
- The Electron app's preload/main process code is unaffected by CSS changes.

## Rollback Notes
All changes are additive new files plus a rewrite of src/styles.css. To rollback: (1) restore src/styles.css from git (`git checkout src/styles.css`), (2) delete the src/styles/ directory. The git working tree before this change is the authoritative rollback point.

## Definition of Done
- src/styles.css contains only @import statements pointing to the new split files.
- Each theme has its own file under src/styles/themes/ with the correct body.theme-{name} selectors.
- All context-menu styles (including per-theme overrides) are consolidated in src/styles/context-menu.css.
- The Electron app builds successfully (`npm run build` or `npx vite build`).
- Theme switching works correctly at runtime — toggling between all 8 themes applies the expected styles.
- The theme-picker modal and context menu render correctly in all themes.

## Action Steps
<!-- step-id: step-1 -->
- [x] Extract base styles, theme-picker, and context-menu into separate files
  - **Files:** src/styles/base.css, src/styles/theme-picker.css, src/styles/context-menu.css
  - **Approach:** Read src/styles.css to get exact content for lines 1–163 (base), 165–602 (theme-picker), and 604–744 (context-menu shared). Also scan the per-theme blocks (746–1439) for any context-menu selectors (e.g., body.theme-orange #context-menu, body.theme-pink .context-menu-item) and consolidate all of them into context-menu.css. Create the three new files.
  - **Acceptance criteria:**
    - src/styles/base.css contains all reset/base selectors (*, html, body, .container, .pane, .editor, .preview).
    - src/styles/theme-picker.css contains all modal, grid, swatch, and preview-panel styles.
    - src/styles/context-menu.css contains the shared context-menu styles plus all per-theme context-menu overrides (dark, sepia, high-contrast, magenta, blue-ocean, orange, pink).
  - **Verification:** Verify file existence and content by reading back each file; confirm no context-menu selectors remain in the theme blocks that will be extracted next.
  - **Risks:**
    - Missing a context-menu override hidden inside a theme block — mitigated by grepping for #context-menu and .context-menu-item across the file before splitting.
<!-- step-id: step-2 -->
- [x] Extract each theme into its own file under src/styles/themes/
  - **Files:** src/styles/themes/dark.css, src/styles/themes/sepia.css, src/styles/themes/high-contrast.css, src/styles/themes/magenta.css, src/styles/themes/blue-ocean.css, src/styles/themes/orange.css, src/styles/themes/pink.css
  - **Approach:** Read the remaining theme blocks from src/styles.css. For each theme, extract the body.theme-{name} {...} block, stripping out any context-menu overrides (already moved in step 1). Create each file under src/styles/themes/. The light theme needs no file since base styles are the default.
  - **Acceptance criteria:**
    - Each theme file contains only the body.theme-{name} selector and its non-context-menu rules.
    - No context-menu selectors remain in any theme file.
    - All 7 theme files exist and are non-empty.
  - **Verification:** Grep each new theme file for #context-menu or .context-menu to confirm no context-menu rules leaked in. Read back each file to verify the body.theme-{name} block is complete.
  - **Risks:**
    - Accidentally stripping non-context-menu rules that share a parent selector with context-menu rules — mitigated by carefully identifying which rule blocks are context-menu vs general theme styling.
<!-- step-id: step-3 -->
- [x] Rewrite src/styles.css as an import barrel
  - **Files:** src/styles.css
  - **Approach:** Replace the entire content of src/styles.css with @import statements in dependency order: base.css → theme-picker.css → context-menu.css → each theme file. This preserves the single import point in renderer.ts (line 3: import "./styles.css").
  - **Acceptance criteria:**
    - src/styles.css contains only @import lines.
    - Import order ensures base styles load first, then UI chrome, then themes.
    - All 10 split files are imported.
  - **Verification:** Read back src/styles.css to confirm it contains only @import statements. Run `npx vite build` to verify Vite resolves all imports without errors.
  - **Risks:**
    - Vite @import path resolution — mitigated by using relative paths (./styles/base.css, etc.) from the location of styles.css.
<!-- step-id: step-4 -->
- [x] Build and smoke-test the Electron app
  - **Approach:** Run `npx vite build` to confirm the project builds. Then run the dev server (`npx vite`) briefly and verify the app launches. Visually confirm that: (a) the app renders with default (light) theme, (b) theme switching works for all 8 themes, (c) the context menu appears correctly in each theme, (d) the theme-picker modal works.
  - **Acceptance criteria:**
    - `npx vite build` completes without CSS-related errors.
    - The Electron app launches and renders correctly.
    - All 8 themes apply correctly when toggled.
    - Context menu renders correctly in each theme.
    - Theme-picker modal opens and functions.
  - **Verification:** `npx vite build` exit code 0. Launch the app and manually verify theme switching and context menu rendering.
  - **Risks:**
    - Vite CSS bundling edge case with @import — if build fails, fall back to explicit relative paths or check Vite config for CSS import resolution settings.
