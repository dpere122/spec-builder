import * as path from "path";
import * as fs from "fs";

/**
 * Configuration options for the application logger.
 */
export interface LoggerConfig {
  /** Override the default logs directory (defaults to `<workspace>/logs`). */
  logsDir?: string;
  /** Optional prefix prepended to every log line. */
  prefix?: string;
}

/**
 * Manages renderer console log output to timestamped files.
 *
 * Extracted from the monolithic main process to isolate file I/O
 * and log lifecycle concerns.
 */
export class AppLogger {
  private logsDirValue: string;
  private logFile: string | null = null;
  private writeStream: fs.WriteStream | null = null;
  private prefix: string;

  constructor(config?: LoggerConfig) {
    this.logsDirValue = config?.logsDir ?? this.resolveLogsDir();
    this.prefix = config?.prefix ?? "";
  }

  /**
   * Resolves the workspace-relative logs directory.
   * In dev mode, __dirname is dist-electron/, so go up one level to workspace root.
   */
  getLogsDir(): string {
    return this.logsDirValue;
  }

  /**
   * Creates the logs directory and a fresh timestamped log file.
   * Returns the absolute path to the log file.
   */
  setupLog(): string {
    fs.mkdirSync(this.logsDirValue, { recursive: true });

    const timestamp = this.timestamp();
    this.logFile = path.join(this.logsDirValue, `renderer-${timestamp}.log`);

    // Write an initial header with diagnostic info
    const header =
      `[${timestamp}] Renderer console log started\n` +
      `[${timestamp}] __dirname: ${__dirname}\n` +
      `[${timestamp}] logsDir: ${this.logsDirValue}\n` +
      `[${timestamp}] logFile: ${this.logFile}\n`;
    fs.writeFileSync(this.logFile, header);

    this.writeStream = fs.createWriteStream(this.logFile, { flags: "a" });

    return this.logFile;
  }

  /**
   * Append a raw line to the current log file.
   * If the log file hasn't been set up yet, creates it first.
   */
  append(line: string): void {
    if (!this.logFile) {
      this.setupLog();
    }
    fs.appendFileSync(this.logFile!, line);
  }

  /**
   * Log a message with an optional prefix and automatic timestamp.
   */
  log(message: string): void {
    const fullMessage = this.prefix ? `${this.prefix}: ${message}` : message;
    const timestamp = this.timestamp();
    this.append(`[${timestamp}] ${fullMessage}\n`);
  }

  /**
   * Return an ISO timestamp suitable for log file names and headers.
   * Colons and dots are replaced with hyphens to avoid filename issues.
   */
  timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  /**
   * Close the write stream if it's open.
   */
  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  /**
   * Get the path of the current log file (if set up).
   */
  getLogFile(): string | null {
    return this.logFile;
  }

  private resolveLogsDir(): string {
    return path.join(__dirname, "..", "logs");
  }
}
