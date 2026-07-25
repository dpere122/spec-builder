import { app, BrowserWindow } from "electron";
import * as path from "path";
import * as fs from "fs";
import { AppLogger } from "./app_logger";

/**
 * Encapsulates BrowserWindow creation, console/log capture,
 * dev vs prod URL loading, and startup theme load.
 */
export class MainWindow {
  private window: BrowserWindow;
  private logger: AppLogger;
  private logFile: string;

  constructor(logger: AppLogger) {
    this.logger = logger;
    this.logFile = "";
    this.window = this.createWindow();
  }

  /** Get the underlying BrowserWindow instance. */
  getWindow(): BrowserWindow {
    return this.window;
  }

  /** Whether the window was loaded from a Vite dev server. */
  isDevMode(): boolean {
    return this.devMode;
  }

  private devMode = false;

  private createWindow(): BrowserWindow {
    // Create the main browser window with security-hardened web preferences
    const window = new BrowserWindow({
      width: 1920,
      height: 1080,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true, // Enforce same-origin policy
        allowRunningInsecureContent: false, // Prevent mixed content (LCP)
        spellcheck: false, // Disable spellcheck to avoid telemetry
      },
    });

    // Set up renderer console logging to file
    this.logFile = this.logger.setupLog();

    // Capture all renderer console messages and append them to the log file
    window.webContents.on(
      "console-message",
      (_event, level, message, line, sourceId) => {
        const timestamp = this.logger.timestamp();
        fs.appendFileSync(
          this.logFile,
          `[${timestamp}] [${level}] (line ${line}, ${sourceId}) ${message}\n`,
        );
      },
    );

    // Capture page load failures
    window.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        const timestamp = this.logger.timestamp();
        fs.appendFileSync(
          this.logFile,
          `[${timestamp}] LOAD FAILED: code=${errorCode}, desc="${errorDescription}", url="${validatedURL}"\n`,
        );
      },
    );

    // Capture successful navigations
    window.webContents.on("did-navigate", (_event, url) => {
      const timestamp = this.logger.timestamp();
      fs.appendFileSync(this.logFile, `[${timestamp}] NAVIGATED: ${url}\n`);
    });

    // Block navigation to external domains — only allow local/dev-server URLs
    const allowedHosts = this.getAllowedHosts();
    const blockExternalNavigation = (_event: Event, url: string) => {
      try {
        const parsed = new URL(url);
        // Allow file://, localhost, and dev server hosts
        if (parsed.protocol === "file:" || allowedHosts.has(parsed.hostname)) {
          return; // allowed
        }
        _event.preventDefault();
        const timestamp = this.logger.timestamp();
        fs.appendFileSync(
          this.logFile,
          `[${timestamp}] BLOCKED NAVIGATION: ${url}\n`,
        );
      } catch {
        _event.preventDefault();
      }
    };
    window.webContents.on("will-navigate", blockExternalNavigation);
    window.webContents.on("will-redirect", blockExternalNavigation);

    // Block attempts to open links in a new window (e.g. target="_blank", window.open, Ctrl+click)
    window.webContents.setWindowOpenHandler(({ url }) => {
      const timestamp = this.logger.timestamp();
      fs.appendFileSync(
        this.logFile,
        `[${timestamp}] BLOCKED NEW-WINDOW: ${url}\n`,
      );
      return { action: "deny" };
    });

    // vite-plugin-electron injects VITE_DEV_SERVER_HOST and VITE_DEV_SERVER_PORT in development mode
    const devHost = process.env.VITE_DEV_SERVER_HOST || "127.0.0.1";
    const devPort = process.env.VITE_DEV_SERVER_PORT;
    // Wrap IPv6 addresses in brackets for valid URL formatting
    const hostStr = devHost.includes(":") ? `[${devHost}]` : devHost;
    const devServerUrl = devPort ? `http://${hostStr}:${devPort}/` : undefined;

    // Track dev mode so window-all-closed can kill the parent Vite process
    this.devMode = !!devServerUrl;

    // Log which mode we're in
    const mode = devServerUrl ? "DEV" : "PROD";
    const targetUrl = devServerUrl || path.join(__dirname, "..", "index.html");
    const timestamp = this.logger.timestamp();
    fs.appendFileSync(
      this.logFile,
      `[${timestamp}] MODE: ${mode}, TARGET_URL: ${targetUrl}\n`,
    );

    if (devServerUrl) {
      // Load from Vite dev server in development mode
      window.loadURL(devServerUrl);
    } else {
      // Load built HTML file in production mode
      window.loadFile(path.join(__dirname, "..", "index.html"));
    }

    // Load persisted theme if it exists (after load to ensure renderer is ready)
    this.loadStartupTheme(window);

    return window;
  }

  private loadStartupTheme(window: BrowserWindow): void {
    const configPath = path.join(app.getPath("userData"), "config.json");
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config.theme) {
          window.webContents.once("did-finish-load", () => {
            window.webContents.send("menu:load-theme", config.theme);
          });
        }
      }
    } catch (err) {
      console.error("Failed to load config on startup:", err);
    }
  }

  /**
   * Returns a Set of hostnames that are allowed to navigate.
   * Includes localhost, 127.0.0.1, ::1, and the Vite dev server host (if any).
   */
  private getAllowedHosts(): Set<string> {
    const hosts = new Set<string>();
    hosts.add("localhost");
    hosts.add("127.0.0.1");
    hosts.add("::1");

    const devHost = process.env.VITE_DEV_SERVER_HOST;
    if (devHost) {
      hosts.add(devHost);
    }

    return hosts;
  }
}
