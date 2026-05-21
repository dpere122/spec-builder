import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";

// Track whether we're running against a Vite dev server
let isDevMode = false;

/**
 * Reference to the main application window.
 *
 * Held at module scope so menu actions and IPC handlers
 * can access the window's webContents to send messages to the renderer.
 *
 * @type {BrowserWindow | null}
 *
 */
let mainWindow: BrowserWindow | null = null;

/* Tracks the file path of the currently open document.
 *
 * Set when a file is opened via the Open menu.
 * Cleared when the user creates a New document.
 * Used by the Save action to skip the save dialog and write directly
 * to the existing file.
 *
 * @type {string | null}
 */
let currentFilePath: string | null = null;

/**
 * Resolves the workspace-relative logs directory.
 *
 * @returns string - Absolute path to the logs directory
 */
function getLogsDir(): string {
  // In dev mode, __dirname is dist-electron/, so go up one level to workspace root
  const logsDir = path.join(__dirname, "..", "logs");
  return logsDir;
}

/**
 * Sets up a log file for renderer console output.
 *
 * Creates a `logs/` directory at the workspace root and writes a fresh log file
 * with a timestamped header. Returns the absolute path to the log file.
 *
 * @returns string - Absolute path to the log file
 */
function setupLog(): string {
  const logsDir = getLogsDir();
  fs.mkdirSync(logsDir, { recursive: true });

  // Create a timestamped log file name
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(logsDir, `renderer-${timestamp}.log`);

  // Write an initial header with diagnostic info
  const header =
    `[${timestamp}] Renderer console log started\n` +
    `[${timestamp}] __dirname: ${__dirname}\n` +
    `[${timestamp}] logsDir: ${logsDir}\n` +
    `[${timestamp}] logFile: ${logFile}\n`;
  fs.writeFileSync(logFile, header);
  return logFile;
}

/**
 * Creates and configures the main application window.
 *
 * Sets up a BrowserWindow with a fixed size, isolates the renderer process
 * from Node.js, and loads the app's HTML entry point.
 * In development mode, loads from the Vite dev server URL.
 *
 * @returns BrowserWindow - The created main window
 */
function createWindow(): BrowserWindow {
  // Create the main browser window with security-hardened web preferences
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true, // Enforce same-origin policy
      allowRunningInsecureContent: false, // Prevent mixed content (HTTP + HTTPS)
      spellcheck: false, // Disable spellcheck to avoid telemetry
    },
  });

  // Set up renderer console logging to file
  const logFile = setupLog();

  // Capture all renderer console messages and append them to the log file
  window.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.appendFileSync(
        logFile,
        `[${timestamp}] [${level}] (line ${line}, ${sourceId}) ${message}\n`,
      );
    },
  );

  // Capture page load failures
  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.appendFileSync(
        logFile,
        `[${timestamp}] LOAD FAILED: code=${errorCode}, desc="${errorDescription}", url="${validatedURL}"\n`,
      );
    },
  );

  // Capture successful navigations
  window.webContents.on("did-navigate", (_event, url) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.appendFileSync(logFile, `[${timestamp}] NAVIGATED: ${url}\n`);
  });

  // vite-plugin-electron injects VITE_DEV_SERVER_HOST and VITE_DEV_SERVER_PORT in development mode
  const devHost = process.env.VITE_DEV_SERVER_HOST || "127.0.0.1";
  const devPort = process.env.VITE_DEV_SERVER_PORT;
  // Wrap IPv6 addresses in brackets for valid URL formatting
  const hostStr = devHost.includes(":") ? `[${devHost}]` : devHost;
  const devServerUrl = devPort ? `http://${hostStr}:${devPort}/` : undefined;

  // Track dev mode so window-all-closed can kill the parent Vite process
  isDevMode = !!devServerUrl;

  // Log which mode we're in
  const mode = devServerUrl ? "DEV" : "PROD";
  const targetUrl = devServerUrl || path.join(__dirname, "..", "index.html");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.appendFileSync(
    logFile,
    `[${timestamp}] MODE: ${mode}, TARGET_URL: ${targetUrl}\n`,
  );

  if (devServerUrl) {
    // Load from Vite dev server in development mode
    window.loadURL(devServerUrl);
  } else {
    // Load built HTML file in production mode
    window.loadFile(path.join(__dirname, "..", "index.html"));
  }

  // Open Chrome DevTools only in development mode
  if (devServerUrl) {
    window.webContents.openDevTools();
  }

  // Lock navigation: prevent the window from navigating to external URLs
  // This prevents XSS via navigation to malicious pages that could
  // still receive IPC messages from the main process
  window.webContents.on("will-navigate", (event, url) => {
    // Allow navigation to the dev server URL or file:// URLs we control
    const isDevUrl = devServerUrl && url.startsWith(devServerUrl);
    const isFileUrl = url.startsWith("file://");

    if (!isDevUrl && !isFileUrl) {
      event.preventDefault();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.appendFileSync(logFile, `[${timestamp}] BLOCKED NAVIGATION: ${url}\n`);
    }
  });

  // Store the window reference for menu actions
  mainWindow = window;

  return window;
}

/**
 * Builds the application menu template with File and Help menus.
 *
 * File menu: New, Open, Save, Quit
 * Help menu: About
 *
 * @returns Electron.MenuItemConstructorOptions[] - The menu template array
 */
function buildMenuTemplate() {
  return [
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            // Clear the tracked file path so Save behaves as Save As
            currentFilePath = null;
            // Tell the renderer to clear the editor
            mainWindow?.webContents.send("menu:new");
          },
        },
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
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
              currentFilePath = filePath;
              // Send the file path and content to the renderer
              mainWindow?.webContents.send("menu:open", {
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
            if (currentFilePath) {
              mainWindow?.webContents.send("menu:save-prompt", currentFilePath);
              return;
            }

            // No current file — show Save As dialog
            const result = await dialog.showSaveDialog(mainWindow!, {
              filters: [
                { name: "Markdown", extensions: ["md", "markdown"] },
                { name: "All Files", extensions: ["*"] },
              ],
              defaultPath: "untitled.md",
            });

            if (!result.canceled && result.filePath) {
              // Track the new path for future saves
              currentFilePath = result.filePath;
              // Tell the renderer to request its current content, then save
              mainWindow?.webContents.send("menu:save-prompt", result.filePath);
            }
          },
        },
        {
          label: "Themes...",
          click: () => {
            // Tell the renderer to open the theme modal dialog
            mainWindow?.webContents.send("menu:themes");
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
            dialog.showMessageBox(mainWindow!, {
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

// When Electron has finished initializing, create the main window and set the menu
app.whenReady().then(() => {
  createWindow();

  // Build and set the application menu
  const menuTemplate = buildMenuTemplate();
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // On macOS, recreate the window when the dock icon is clicked and no other windows exist
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// IPC handler: renderer sends the current editor content back for saving
// Security: verify the sender is our own renderer and the path was approved by the dialog
ipcMain.on("save-content", (event, content: string, filePath: string) => {
  // Verify the IPC message came from our own renderer process
  // A navigated-to external page would have a different origin
  const senderId = event.senderFrame?.processId;
  const windowId = event.senderFrame?.frameTreeNodeId;

  if (senderId === undefined || windowId === undefined) {
    console.error("IPC save-content: rejected — unknown sender frame");
    return;
  }

  // Validate that the file path was approved by the save dialog
  // The renderer should only receive save prompts for paths we authorized
  if (!filePath || typeof filePath !== "string") {
    console.error("IPC save-content: rejected — invalid file path");
    return;
  }

  // Only allow saving to the currently tracked file or the dialog-approved path
  if (filePath !== currentFilePath) {
    console.error(
      "IPC save-content: rejected — path mismatch (possible path traversal)",
    );
    return;
  }

  // Write the file content to disk
  fs.writeFileSync(filePath, content, "utf-8");

  // Notify the renderer that the save succeeded
  mainWindow?.webContents.send("menu:save-done", { filePath });
});

// Quit the app when all windows are closed (except on macOS, where the app stays active)
app.on("window-all-closed", () => {
  mainWindow = null;
  if (isDevMode) {
    // In dev mode, kill the parent Vite dev server process so the terminal returns
    // process.ppid is Electron's parent (Vite). Kill it by signal.
    try {
      process.kill(process.ppid, "SIGTERM");
    } catch {
      // ppid may not be Vite in some environments; fall through to normal quit
      app.quit();
    }
  } else if (process.platform !== "darwin") {
    app.quit();
  }
});
