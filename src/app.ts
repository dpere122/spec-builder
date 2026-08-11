import { app, BrowserWindow } from "electron";
import { AppLogger } from "./app_logger";
import { MainWindow } from "./main_window";
import { AppMenu } from "./app_menu";
import { IPCManager } from "./ipc_manager";

/**
 * Top-level application class that owns the Electron lifecycle
 * and composes the MainWindow, AppMenu, IPCManager, and AppLogger.
 */
export class App {
  private logger: AppLogger;
  private mainWindow: MainWindow | null = null;
  private appMenu: AppMenu | null = null;
  private ipcManager: IPCManager | null = null;
  private isDevMode = false;

  constructor() {
    this.logger = new AppLogger();
    this.setupLifecycle();
  }

  /** Start the application (calls app.whenReady internally). */
  start(): void {
    // Lifecycle hooks are registered in the constructor;
    // app.whenReady() will trigger createWindow when ready.
  }

  private setupLifecycle(): void {
    app.whenReady().then(() => {
      this.createWindow();
      this.setupMenu();
      this.setupIPC();

      // On macOS, recreate the window when the dock icon is clicked
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
          this.setupMenu();
          this.setupIPC();
        }
      });
    });

    // Quit the app when all windows are closed
    app.on("window-all-closed", () => {
      this.mainWindow = null;
      this.appMenu = null;
      this.ipcManager = null;

      if (this.isDevMode) {
        // In dev mode, kill the parent Vite dev server process so the terminal returns
        try {
          process.kill(process.ppid, "SIGTERM");
        } catch (err) {
          console.error("Failed to kill parent process:", err);
        }
      }

      // Quit the app when all windows are closed (except on macOS, where the app stays active)
      if (process.platform !== "darwin") {
        app.quit();
      }
    });
  }

  private createWindow(): void {
    this.mainWindow = new MainWindow(this.logger);
    this.isDevMode = this.mainWindow.isDevMode();
  }

  private setupMenu(): void {
    if (this.mainWindow) {
      this.appMenu = new AppMenu(this.mainWindow.getWindow());
      this.appMenu.buildAndSetMenu();
      this.appMenu.registerIPCHandlers();
    }
  }

  private setupIPC(): void {
    if (this.mainWindow) {
      this.ipcManager = new IPCManager(this.mainWindow.getWindow());
    }
  }
}
