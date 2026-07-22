import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes a safe, limited API to the renderer process via contextBridge.
 *
 * This ensures the renderer cannot access Node.js APIs directly while still
 * allowing controlled IPC communication through the `electronAPI` object.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Listen for the "New" menu action — clears the editor.
   *
   * @param callback - Function called when the New menu item is clicked
   */
  onNew: (callback: () => void) => {
    ipcRenderer.on("menu:new", () => callback());
  },

  /**
   * Listen for the "Open" menu action — loads file content into the editor.
   *
   * @param callback - Function called with `{ filePath, content }` when a file is opened
   */
  onOpen: (callback: (data: { filePath: string; content: string }) => void) => {
    ipcRenderer.on("menu:open", (_event, data) => callback(data));
  },

  /**
   * Listen for the "Save" prompt — triggers the renderer to send its content back.
   *
   * @param callback - Function called with the target file path when Save is clicked
   */
  onSavePrompt: (callback: (filePath: string) => void) => {
    ipcRenderer.on("menu:save-prompt", (_event, filePath) =>
      callback(filePath),
    );
  },

  /**
   * Listen for confirmation that the save completed on the main process.
   *
   * @param callback - Function called with `{ filePath }` when the save finishes
   */
  onSaveDone: (callback: (data: { filePath: string }) => void) => {
    ipcRenderer.on("menu:save-done", (_event, data) => callback(data));
  },

  /**
   * Send the current editor content to the main process for saving.
   *
   * @param content - The Markdown text to save
   * @param filePath - The target file path from the save dialog
   */
  saveContent: (content: string, filePath: string) => {
    ipcRenderer.send("save-content", content, filePath);
  },

  /**
   * Listen for the "Themes" menu action — opens the theme picker modal.
   *
   * @param callback - Function called when the Themes menu item is clicked
   */
  onThemes: (callback: () => void) => {
    ipcRenderer.on("menu:themes", () => callback());
  },

  /**
   * Send a theme selection to the main process for persistence.
   *
   * @param theme - The selected theme name
   */
  selectTheme: (theme: string) => {
    ipcRenderer.send("select-theme", theme);
  },

  /**
   * Listen for the saved theme on startup.
   *
   * @param callback - Function called with the saved theme name
   */
  onLoadTheme: (callback: (theme: string) => void) => {
    ipcRenderer.on("menu:load-theme", (_event, theme) => callback(theme));
  },
});
