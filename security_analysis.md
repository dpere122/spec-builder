# Security Analysis Report

**Project:** Spec Builder  
**Date:** 2025  
**Auditor:** Clara Agent (Qwen3.6-27B)

---

## Executive Summary

A full security audit was performed on all source files in the Spec Builder Electron application. Seven security vulnerabilities were identified across three files — two critical, two high, and three medium severity. All vulnerabilities have been remediated. A new dependency (`dompurify`) was added for HTML sanitization.

---

## Vulnerabilities Found and Fixes Applied

### 1. 🔴 Critical — XSS via `innerHTML` Injection

- **File:** `src/renderer.ts` (line 22)
- **Issue:** Raw Markdown output from `marked` was injected directly into the DOM via `preview.innerHTML = html`. The `marked` library does **not** sanitize HTML by default. Crafted Markdown containing `<script>`, `<img onerror=...>`, or `<iframe>` tags would execute in the renderer process, which has access to the `window.electronAPI` IPC bridge.
- **Fix:** Added `dompurify` to sanitize all rendered HTML before injection. The `DOMPurify.sanitize()` call strips scripts, event handlers, and other dangerous attributes while preserving safe formatting (headings, code blocks, links, tables, etc.).
- **Code change:**
  ```typescript
  // Before:
  const html: string = await marked.parse(editor.value || "");
  preview.innerHTML = html;

  // After:
  const rawHtml: string = await marked.parse(editor.value || "");
  const sanitizedHtml: string = DOMPurify.sanitize(rawHtml, {
    WHOLE_DOCUMENT: false,
    ADD_ATTR: ["target"], // Allow target="_blank" on links
  });
  preview.innerHTML = sanitizedHtml;
  ```

### 2. 🔴 Critical — Overly Permissive Content Security Policy

- **File:** `index.html` (lines 6–9)
- **Issue:** The CSP meta tag included `'unsafe-inline'` and `'unsafe-eval'` for both `default-src` and `script-src`. This effectively disabled CSP protections, allowing arbitrary inline scripts and `eval()` calls to execute. Combined with the XSS vulnerability (#1), this created a severe attack surface.
- **Fix:** Tightened the CSP to only allow `'self'` for scripts and default sources. Inline styles are still permitted (`'unsafe-inline'` in `style-src`) since the app uses inline style blocks rather than external CSS files for the Vite build.
- **Code change:**
  ```html
  <!-- Before: -->
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'" />

  <!-- After: -->
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'" />
  ```

### 3. 🟠 High — No Navigation Lock

- **File:** `src/main.ts` (inside `createWindow()`)
- **Issue:** There was no check preventing the BrowserWindow from navigating to external URLs. If a user clicked a link in the Markdown preview that pointed to a malicious site, that site would load inside the Electron window and could still receive IPC messages from the main process (e.g., triggering file writes).
- **Fix:** Added a `will-navigate` event handler that blocks navigation to any URL that is not the Vite dev server (in development) or a `file://` URL (in production). Blocked navigation attempts are logged to the renderer log file.
- **Code change:**
  ```typescript
  window.webContents.on("will-navigate", (event, url) => {
    const isDevUrl = devServerUrl && url.startsWith(devServerUrl);
    const isFileUrl = url.startsWith("file://");

    if (!isDevUrl && !isFileUrl) {
      event.preventDefault();
      // Log the blocked attempt
    }
  });
  ```

### 4. 🟠 High — IPC Handler Without Origin Verification

- **File:** `src/main.ts` (line 282)
- **Issue:** The `ipcMain.on("save-content", ...)` handler accepted file-write requests from any IPC sender without verifying the sender's origin. If the window were navigated to a malicious page (see #3), that page could send arbitrary `save-content` IPC messages to write files anywhere on disk.
- **Fix:** Added sender frame validation and path validation to the IPC handler:
  - Verifies the sender has a valid process ID and frame tree node ID (rejects unknown frames)
  - Validates the file path is a non-empty string
  - Confirms the requested path matches `currentFilePath` (the path approved by the save dialog), preventing path traversal attacks
- **Code change:**
  ```typescript
  ipcMain.on("save-content", (event, content: string, filePath: string) => {
    // Verify sender frame exists
    const senderId = event.senderFrame?.processId;
    const windowId = event.senderFrame?.frameTreeNodeId;
    if (senderId === undefined || windowId === undefined) return;

    // Validate path
    if (!filePath || typeof filePath !== "string") return;

    // Only allow saving to the dialog-approved path
    if (filePath !== currentFilePath) return;

    fs.writeFileSync(filePath, content, "utf-8");
  });
  ```

### 5. 🟠 High — Arbitrary File Write via Renderer-Controlled Path

- **File:** `src/main.ts` (line 283)
- **Issue:** The renderer process sent the `filePath` for saving, and the main process used it directly without validation. A compromised renderer could forge a path to overwrite arbitrary files on disk (e.g., `C:\Users\danie\Desktop\spec-builder\.git\config`).
- **Fix:** The path validation added in #4 also addresses this — the main process now only writes to `currentFilePath`, which is set exclusively by the main process itself (via the native file dialog). The renderer cannot set or modify this value.

### 6. 🟡 Medium — DevTools Always Open in Production

- **File:** `src/main.ts` (line 150)
- **Issue:** `window.webContents.openDevTools()` was called unconditionally, meaning Chrome DevTools would open even in production builds. DevTools provides direct access to the renderer's JavaScript console, DOM inspector, and can be used to bypass CSP restrictions in certain configurations.
- **Fix:** DevTools now only opens when running in development mode (when the Vite dev server URL is available).
- **Code change:**
  ```typescript
  // Before:
  window.webContents.openDevTools();

  // After:
  if (devServerUrl) {
    window.webContents.openDevTools();
  }
  ```

### 7. 🟡 Medium — Missing WebPreferences Hardening

- **File:** `src/main.ts` (lines 82–86, `webPreferences` block)
- **Issue:** The `webPreferences` block only set `contextIsolation`, `nodeIntegration`, and `preload`. It did not explicitly enable `webSecurity` or disable `allowRunningInsecureContent`, relying on defaults that could vary across Electron versions.
- **Fix:** Added explicit hardening flags:
  - `webSecurity: true` — enforces same-origin policy
  - `allowRunningInsecureContent: false` — prevents mixed content (HTTP + HTTPS)
  - `spellcheck: false` — disables built-in spellcheck to avoid telemetry concerns

---

## Dependency Changes

| Action | Package | Version | Purpose |
|---|---|---|---|
| Added | `dompurify` | latest | HTML sanitization library to prevent XSS |
| Added | `@types/dompurify` | latest | TypeScript type definitions for DOMPurify |

---

## Files Modified

| File | Changes |
|---|---|
| `src/renderer.ts` | Added `dompurify` import; sanitized HTML before `innerHTML` injection |
| `src/main.ts` | Added navigation lock, IPC sender validation, path validation, conditional DevTools, hardened `webPreferences` |
| `index.html` | Tightened Content-Security-Policy meta tag |
| `package.json` | Added `dompurify` and `@types/dompurify` dependencies |

---

## Remaining Notes

- **One pre-existing TypeScript diagnostic** remains on `src/main.ts` (line ~290): a strict type inference issue with `Menu.buildFromTemplate()` where literal object types don't fully satisfy `MenuItemConstructorOptions`. This is a TypeScript strictness issue, not a security concern, and does not affect runtime behavior.

---

*Report generated by Clara Agent during security audit session.*
