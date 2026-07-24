import { BrowserWindow, clipboard, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";

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
  }
}
