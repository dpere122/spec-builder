# Spec Builder

A split-pane Markdown specification builder application. Write Markdown on the left, see a live rendered preview on the right. Features a native application menu bar with file management (New, Open, Save) and an About dialog.
## Application Structure

```
spec-builder/
├── src/
│   ├── main.ts            # Electron main process entry point
│   ├── app.ts             # Application lifecycle and composition
│   ├── app_menu.ts        # Application menu (File, Help)
│   ├── app_logger.ts      # Renderer console logging to file
│   ├── ipc_manager.ts     # IPC handlers (themes, clipboard)
│   ├── main_window.ts     # BrowserWindow creation and config
│   ├── preload.ts         # Secure context bridge (exposes IPC to renderer)
│   ├── renderer.ts        # Renderer process (preview, themes, context menu, find & replace)
│   ├── global.d.ts        # TypeScript declarations for window.electronAPI
│   ├── styles.css         # Main stylesheet (imports)
│   └── styles/
│       ├── base.css       # Base reset and layout styles
│       ├── context-menu.css   # Context menu styles
│       ├── find-replace.css   # Find & Replace bar styles
│       ├── theme-picker.css   # Theme picker modal styles
│       └── themes/        # Per-theme CSS files
├── index.html             # Split-pane layout (editor + preview)
├── dist-electron/         # Compiled Electron main/preload output (generated)
├── dist/                  # Vite build output (generated)
├── logs/                  # Renderer console log files
├── package.json           # Project metadata and dependencies
├── tsconfig.json          # TypeScript compiler configuration
├── vite.config.ts         # Vite build configuration
└── README.md              # This file
```

## Architecture

- **Entry Point** (`src/main.ts`): Minimal bootstrap that instantiates the `App` class and calls `start()`.
- **App** (`src/app.ts`): Top-level class owning the Electron lifecycle. Composes `MainWindow`, `AppMenu`, `IPCManager`, and `AppLogger`; sets up `whenReady`, `activate` (macOS dock), and `window-all-closed` hooks.
- **MainWindow** (`src/main_window.ts`): Creates a 1920×1080 `BrowserWindow` with security-hardened web preferences (context isolation, no Node integration). Handles dev vs. prod URL loading (Vite dev server or built files), renderer console/log capture to file, and startup theme restoration from `config.json`.
- **AppMenu** (`src/app_menu.ts`): Builds the application menu (File, View, Help) and wires menu-item click handlers to IPC channels.
- **IPCManager** (`src/ipc_manager.ts`): Registers main-process IPC handlers for theme persistence (`select-theme`), file saving (`save-content`), and clipboard access (`clipboard-read`, `clipboard-write`, `clipboard-clear`).
- **Preload Script** (`src/preload.ts`): Secure `contextBridge` exposing `window.electronAPI` to the renderer — listeners for menu actions (`onNew`, `onOpen`, `onSavePrompt`, `onSaveError`, `onSaveDone`, `onThemes`, `onLoadTheme`) and active calls (`saveContent`, `selectTheme`, `readClipboard`, `writeClipboard`, `clearClipboard`).
- **AppLogger** (`src/app_logger.ts`): Creates timestamped log files in a `logs/` directory for renderer console output and navigation events.
- **Type Declarations** (`src/global.d.ts`): Global TypeScript augmentation so `window.electronAPI` is recognized in the renderer.
- **Renderer** (`src/renderer.ts`): Wires up `marked` for live Markdown preview, handles editor interaction, context menus, find/replace, and theme switching.
- **UI** (`index.html` + `src/styles.css` + `src/styles/`): Flexbox split-pane layout with a theme system (`dark`, `sepia`, `blue-ocean`, `magenta`, `pink`, `orange`, `high-contrast`) and dedicated stylesheets for context menus, find/replace, and the theme picker.

## Application Menu

| Menu | Items | Accelerators |
|---|---|---|
| **File** | New — clear the editor | `Ctrl+N` / `Cmd+N` |
| | Open... — open a Markdown file | `Ctrl+O` / `Cmd+O` |
| | Save... — save current content (saves to the open file directly, or prompts for a new path if unsaved) | `Ctrl+S` / `Cmd+S` |
| | Quit — close the application | `Ctrl+Q` / `Cmd+Q` |
| **Help** | About — show app info dialog | — |

### IPC Flow

- **New**: Main process sends `menu:new` → renderer clears editor and preview.
- **Open**: Main process shows file dialog → reads file → sends `menu:open` with `{ filePath, content }` → renderer loads content.
- **Save**: If a file is currently open, saves directly to that path; otherwise shows a save dialog → sends `menu:save-prompt` with `filePath` → renderer sends `save-content` with editor text → main process writes file → sends `menu:save-done`.

## Find & Replace

Press `Ctrl+F` / `Cmd+F` to open the Find & Replace bar in the top-right corner.

| Feature | Shortcut |
|---|---|
| Open Find & Replace | `Ctrl+F` / `Cmd+F` |
| Navigate to next match | `Enter` |
| Navigate to previous match | `Shift+Enter` |
| Replace current match | `Enter` (in Replace input) |
| Replace all matches | Click **All** button |
| Toggle case-sensitive search | Click **Aa** checkbox |
| Close Find & Replace | `Escape` or ✕ button |

- Pre-fills the find box with selected text if text is highlighted when opening
- Live search — results update as you type
- Match counter shows current position (e.g., `3/12`)
- Navigation wraps around the document
## Themes

Accessed via **Help → Themes...** in the application menu, the theme picker opens a modal dialog with eight built-in themes:

| Theme | Description |
|---|---|
| **Light** | Clean white background with dark text |
| **Dark** | Dark background with light text for low-light environments |
| **Sepia** | Warm, paper-like tones to reduce eye strain |
| **High Contrast** | Maximum contrast (black background, bright text) for accessibility |
| **Magenta** | Deep purple-dark background with vibrant magenta accents |
| **Blue Ocean** | Deep navy background with cool blue accents |
| **Orange** | Warm light background with rich orange accents |
| **Pink** | Soft light background with delicate pink accents |

Each theme applies CSS custom properties to the editor, preview pane, and UI chrome. Selections are persisted via `localStorage` so the chosen theme is restored on startup.

### Theme IPC Flow

- **Open Picker**: Main process sends `menu:themes` → renderer shows the theme modal.
- **Select Theme**: Renderer calls `selectTheme(themeName)` → sends `menu:select-theme` with the theme name → main process acknowledges → renderer applies CSS variables and persists the choice.

## Tech Stack

| Component | Library |
|---|---|
| Framework | Electron |
| Language | TypeScript |
| Markdown Rendering | marked |
| Types | @types/node |

## Quick Start

```bash
# Install dependencies
npm install

# Compile TypeScript and launch Electron
npm run dev

# Or build only
npm run build
```

## Development

This application was developed using **Clara Coder**, a custom agentic-powered editor created by **Daniel Perez**.

### Model Information

- **Model:** Qwen3.6-27B/Gemma-4-31B
- **Runtime:** Running locally via llama.cpp
- **Quantization:** Q8

---

_Built with Clara Coder by Daniel Perez_
