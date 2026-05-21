# Spec Builder

A split-pane Markdown specification builder application. Write Markdown on the left, see a live rendered preview on the right. Features a native application menu bar with file management (New, Open, Save) and an About dialog.
## Application Structure

```
spec-builder/
├── src/
│   ├── main.ts        # Electron main process (window, menus, IPC, file dialogs)
│   ├── preload.ts     # Secure context bridge (exposes menu IPC to renderer)
│   ├── renderer.ts    # Renderer process (live Markdown preview + menu handlers)
│   ├── global.d.ts    # TypeScript declarations for window.electronAPI
│   ├── index.html     # Split-pane layout (editor + preview)
│   └── styles.css     # Pane styling and Markdown preview styles
├── dist-electron/     # Compiled Electron main/preload output (generated)
├── package.json       # Project metadata and dependencies
├── tsconfig.json      # TypeScript compiler configuration
└── README.md          # This file
```

## Architecture

- **Main Process** (`src/main.ts`): Electron entry point. Creates a 1200x800 BrowserWindow with context isolation, builds the application menu (File, Help), and handles file dialogs (Open/Save) and disk I/O via IPC.
- **Preload Script** (`src/preload.ts`): Secure bridge between main and renderer processes using `contextBridge`. Exposes IPC channels for menu actions: `onNew`, `onOpen`, `onSavePrompt`, `onSaveDone`, `saveContent`.
- **Renderer Process** (`src/renderer.ts`): Wires up `marked` to render Markdown from the editor textarea into the preview pane in real-time. Listens for menu IPC events to handle New (clear editor), Open (load file content), and Save (send content to main process).
- **Type Declarations** (`src/global.d.ts`): Global TypeScript augmentation so `window.electronAPI` is recognized in the renderer.
- **UI** (`src/index.html` + `src/styles.css`): Flexbox split-pane layout with styled Markdown preview output.

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

- **Model:** Qwen3.6-27B
- **Runtime:** Running locally via llama.cpp
- **Quantization:** Q4_K_M

---

_Built with Clara Coder by Daniel Perez_
