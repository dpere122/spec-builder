import { BrowserWindow, Menu, app, dialog, ipcMain } from "electron";
import * as fs from "fs";
import type { MenuItemConstructorOptions } from "electron";

/**
 * Encapsulates menu template building, File/Help actions,
 * `currentFilePath` state, and menu click handlers.
 */
export class AppMenu {
  private mainWindow: BrowserWindow | null = null;
  private currentFilePath: string | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /** Update the reference to the main window (e.g., after recreation). */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /** Get the currently tracked file path. */
  getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  /**
   * Build and set the application menu.
   */
  buildAndSetMenu(): void {
    const menuTemplate = this.buildMenuTemplate();
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
  }

  private buildMenuTemplate(): MenuItemConstructorOptions[] {
    return [
      {
        label: "File",
        submenu: [
          {
            label: "New",
            accelerator: "CmdOrCtrl+N",
            click: () => {
              // Clear the tracked file path so Save behaves as Save As
              this.currentFilePath = null;
              // Tell the renderer to clear the editor
              this.mainWindow?.webContents.send("menu:new");
            },
          },
          {
            label: "Open...",
            accelerator: "CmdOrCtrl+O",
            click: async () => {
              const result = await dialog.showOpenDialog(this.mainWindow!, {
                properties: ["openFile"],
                filters: [
                  { name: "Markdown", extensions: ["md", "markdown", "txt"] },
                  { name: "All Files", extensions: ["*"] },
                ],
              });

              if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const content = fs.readFileSync(filePath, "utf-8");
                // Track the opened file path for subsequent Save actions
                this.currentFilePath = filePath;
                // Send the file path and content to the renderer
                this.mainWindow?.webContents.send("menu:open", {
                  filePath,
                  content,
                });
              }
            },
          },
          {
            label: "Save...",
            accelerator: "CmdOrCtrl+S",
            click: async () => {
              // If a file is already open, save directly to that path
              if (this.currentFilePath) {
                this.mainWindow?.webContents.send(
                  "menu:save-prompt",
                  this.currentFilePath,
                );
                return;
              }

              // No current file — show Save As dialog
              const result = await dialog.showSaveDialog(this.mainWindow!, {
                filters: [
                  { name: "Markdown", extensions: ["md", "markdown"] },
                  { name: "All Files", extensions: ["*"] },
                ],
                defaultPath: "untitled.md",
              });

              if (!result.canceled && result.filePath) {
                // Track the new path for future saves
                this.currentFilePath = result.filePath;
                // Tell the renderer to request its current content, then save
                this.mainWindow?.webContents.send(
                  "menu:save-prompt",
                  result.filePath,
                );
              }
            },
          },
          {
            label: "Themes...",
            click: () => {
              // Tell the renderer to open the theme modal dialog
              this.mainWindow?.webContents.send("menu:themes");
            },
          },
          { type: "separator" },
          {
            label: "Quit",
            accelerator: "CmdOrCtrl+Q",
            click: () => {
              app.quit();
            },
          },
        ],
      },
      {
        label: "Help",
        submenu: [
          {
            label: "About",
            click: () => {
              dialog.showMessageBox(this.mainWindow!, {
                type: "info",
                title: "About Spec Builder",
                message: "Spec Builder",
                detail:
                  "A Markdown editor with live preview.\n\nBuilt with Electron, TypeScript, and Vite.",
                buttons: ["OK"],
              });
            },
          },
        ],
      },
    ];
  }

  /**
   * Register IPC handlers that belong to the menu (e.g., save-as-request).
   */
  registerIPCHandlers(): void {
    ipcMain.handle(
      "save-as-request",
      async (_event): Promise<{ filePath: string | null }> => {
        const result = await dialog.showSaveDialog(this.mainWindow!, {
          filters: [
            { name: "Markdown", extensions: ["md", "markdown"] },
            { name: "All Files", extensions: ["*"] },
          ],
          defaultPath: "untitled.md",
        });

        if (!result.canceled && result.filePath) {
          this.currentFilePath = result.filePath;
          this.mainWindow?.webContents.send(
            "menu:save-prompt",
            result.filePath,
          );
        }

        return { filePath: result.filePath || null };
      },
    );
  }
}
