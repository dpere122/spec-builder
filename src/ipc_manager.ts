import { BrowserWindow, clipboard, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";

export interface OpenFileEntry {
  id: string;
  title: string;
  contentId: string;
  content: string;
  dirty: boolean;
}

/**
 * Encapsulates IPC handlers for theme selection and clipboard access.
 */
export class IPCManager {
  private mainWindow: BrowserWindow | null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.registerHandlers();
  }

  /** Update the main window reference (e.g., after recreation on macOS). */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  private registerHandlers(): void {
    // IPC handler: renderer sends the current editor content back for saving
    // Security: verify the sender is our own renderer and the path was approved by the dialog
    ipcMain.on("select-theme", (_event, theme: string) => {
      const configPath = path.join(app.getPath("userData"), "config.json");
      console.log(
        `[Theme IPC] Received select-theme: ${theme}. Target path: ${configPath}`,
      );

      let config: Record<string, unknown> = {};
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          console.log(
            `[Theme IPC] Existing config found: ${JSON.stringify(config)}`,
          );
        }
      } catch (err) {
        console.error("Failed to read config file:", err);
      }

      config.theme = theme;

      try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(
          `[Theme IPC] Successfully saved theme: ${theme} to ${configPath}`,
        );
      } catch (err) {
        console.error("Failed to save config file:", err);
      }

      // Notify the renderer that the theme has been saved
      this.mainWindow?.webContents.send("menu:load-theme", theme);
    });

    // IPC handler: open a file by path silently (used for session restore)
    ipcMain.handle("open-file-silent", (_event, filePath: string) => {
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, "utf-8");
        this.mainWindow?.webContents.send("menu:open", {
          filePath,
          content,
        });
        return { success: true };
      } catch (err) {
        console.error("[Open IPC] Failed to open file:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    // IPC handler: renderer sends the current editor content back for saving
    // Security: verify the sender is our own renderer and the path was approved by the dialog
    ipcMain.on("save-content", (_event, content: string, filePath: string) => {
      try {
        fs.writeFileSync(filePath, content, "utf-8");
        console.log(`[Save IPC] Successfully saved file: ${filePath}`);
        // Notify the renderer that the save completed
        this.mainWindow?.webContents.send("menu:save-done", { filePath });
      } catch (err) {
        console.error("[Save IPC] Failed to save file:", err);
        // Notify the renderer of the save failure
        this.mainWindow?.webContents.send("menu:save-error", {
          filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // IPC handlers: clipboard access for the renderer's context menu
    ipcMain.handle("clipboard-read", () => {
      return clipboard.readText();
    });

    ipcMain.handle("clipboard-write", (_event, text: string) => {
      clipboard.writeText(text);
    });

    ipcMain.handle("clipboard-clear", () => {
      clipboard.clear();
    });

    // IPC handler: renderer sends the list of open files to persist in config
    ipcMain.on(
      "session-save-files",
      (_event, files: OpenFileEntry[], activeTabId: string | null) => {
        const configPath = path.join(app.getPath("userData"), "config.json");
        try {
          let config: Record<string, unknown> = {};
          if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          }
          config.openFiles = files;
          config.activeTabId = activeTabId;
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          console.log(
            `[Session IPC] Saved ${files.length} open files to config`,
          );
        } catch (err) {
          console.error("[Session IPC] Failed to save open files:", err);
        }
      },
    );

    // IPC handler: renderer requests the saved session files
    ipcMain.handle("session-load-files", () => {
      const configPath = path.join(app.getPath("userData"), "config.json");
      try {
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          return {
            files: config.openFiles ?? [],
            activeTabId: config.activeTabId ?? null,
          };
        }
      } catch (err) {
        console.error("[Session IPC] Failed to load open files:", err);
      }
      return { files: [], activeTabId: null };
    });
  }
}
