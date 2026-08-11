import { marked } from "marked";
import DOMPurify from "dompurify";
import "./styles.css";

/** Reference to the Markdown editor textarea element in the DOM. */
const editor = document.getElementById("editor") as HTMLTextAreaElement;

/** Reference to the HTML preview div where rendered Markdown is displayed. */
const preview = document.getElementById("preview") as HTMLDivElement;

/** Available theme identifiers for the theme picker. */
const THEMES: string[] = [
  "light",
  "dark",
  "sepia",
  "high-contrast",
  "magenta",
  "blue-ocean",
  "orange",
  "pink",
];

/** The currently active theme name. Defaults to "light". */
let currentTheme: string = "light";

/** Reference to the theme modal overlay element. */
const themeModal = document.getElementById("theme-modal") as HTMLDivElement;

/** Reference to the modal close button. */
const themeCloseBtn = document.getElementById(
  "theme-close-btn",
) as HTMLButtonElement;

/**
 * Renders the current Markdown text from the editor into HTML and updates the preview pane.
 *
 * Reads the value of the editor textarea, parses it with the `marked` library,
 * sanitizes the resulting HTML with DOMPurify to prevent XSS attacks,
 * and sets the sanitized HTML as the innerHTML of the preview element.
 *
 * @returns void
 */
async function updatePreview(): Promise<void> {
  // Parse the Markdown content
  // marked v15 parse() can return string | Promise<string>, so we await it
  const rawHtml: string = await marked.parse(editor.value || "");

  // Sanitize the HTML to remove any malicious scripts or event handlers
  // This prevents XSS attacks from crafted Markdown content
  const sanitizedHtml: string = DOMPurify.sanitize(rawHtml, {
    WHOLE_DOCUMENT: false,
    ADD_ATTR: ["target"], // Allow target="_blank" on links
  });

  preview.innerHTML = sanitizedHtml;
}

// Listen for input events on the editor to trigger live preview updates
editor.addEventListener("input", () => {
  // Sync current editor content back to the active tab and mark as dirty
  if (activeTabId) {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      activeTab.content = editor.value;
      activeTab.dirty = true;
    }
  }
  updatePreview();
});

// Render the preview on initial page load
updatePreview();

/**
 * Logic to toggle the preview pane visibility.
 * Listens for clicks on the preview-toggle button and toggles the 'collapsed' class
 * on both the button (to rotate the chevron) and the preview pane (to show/hide it).
 */
const previewToggle = document.getElementById(
  "preview-toggle",
) as HTMLButtonElement;
const previewPane = document.querySelector(".preview-pane") as HTMLDivElement;

previewToggle.addEventListener("click", () => {
  previewPane.classList.toggle("collapsed");
  previewToggle.classList.toggle("collapsed");
});

// --- Menu IPC handlers ---

/**
 * State management for the tab system.
 */
let tabs: Array<{
  id: string;
  title: string;
  contentId: string;
  content: string;
  dirty: boolean;
  error: boolean; // true if file could not be loaded on startup
}> = [];
let activeTabId: string | null = null;

/** Counter for generating unique untitled tab IDs. */
let untitledCounter = 0;

/** Regex to detect untitled tab sentinel contentIds. */
const UNTITLED_ID_RE = /^:untitled-\d+:$/;

/**
 * Creates a new untitled tab with a sentinel contentId like ':untitled-N:'.
 * The tab is empty, not dirty, and immediately selected.
 */
function createUntitledTab(): void {
  // If there are no tabs (we're replacing the last untitled tab),
  // reuse the current counter so the name doesn't increment.
  if (tabs.length === 0) {
    untitledCounter = Math.max(untitledCounter, 1);
  } else {
    untitledCounter += 1;
  }

  const id = `untitled-${untitledCounter}`;
  const title = `Untitled-${untitledCounter}`;
  const contentId = `:untitled-${untitledCounter}:`;

  tabs.push({
    id,
    title,
    contentId,
    content: "",
    dirty: false,
    error: false,
  });

  switchTab(id);
}

/**
 * Renders the tab bar UI.
 *
 * Clears the current tab bar content and builds new buttons based on the `tabs` array.
 * Also applies the 'active' class to the current tab.
 *
 * @returns void
 */
function renderTabs(): void {
  const tabBar = document.getElementById("tab-bar");
  if (!tabBar) return;

  tabBar.innerHTML = "";
  tabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.className = "tab-button";
    btn.id = `tab-btn-${tab.id}`;

    // Show error icon and red color for missing files
    if (tab.error) {
      btn.textContent = `⚠ ${tab.title}`;
      btn.classList.add("tab-error");
      btn.onclick = () => {
        // Can't open a missing file — just notify the user
        window.alert(`File not found:\n${tab.contentId}`);
      };
    } else {
      btn.textContent = tab.title;
      btn.onclick = () => switchTab(tab.id);
    }

    btn.oncontextmenu = (e) => showTabContextMenu(e, tab.id);
    tabBar.appendChild(btn);
  });

  if (activeTabId) {
    const activeBtn = document.getElementById(`tab-btn-${activeTabId}`);
    if (activeBtn) activeBtn.classList.add("active");
  }
}

/**
 * Shows a context menu for a tab with a "Close" option.
 * If the tab has unsaved changes, prompts the user to confirm closing.
 *
 * @param e - The context menu event.
 * @param tabId - The ID of the tab being right-clicked.
 */
function showTabContextMenu(e: MouseEvent, tabId: string): void {
  e.preventDefault();

  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;

  const hasUnsavedChanges = tab.dirty;

  if (contextMenu) {
    contextMenu.innerHTML = "";

    const closeItem = document.createElement("div");
    closeItem.className = "context-menu-item";
    closeItem.textContent = "Close";

    closeItem.onclick = () => {
      hideContextMenu();

      if (hasUnsavedChanges) {
        // Defer confirm slightly to avoid Linux GLib signal handler race
        // when closing context menu and showing dialog in quick succession.
        setTimeout(() => {
          const confirmed = window.confirm(
            `"${tab.title}" has unsaved changes. Close anyway?`,
          );
          if (confirmed) {
            closeTab(tabId);
          }
        }, 50);
      } else {
        closeTab(tabId);
      }
    };

    contextMenu.appendChild(closeItem);
    showContextMenu(e.clientX, e.clientY);
  }
}

/**
 * Closes a tab by ID.
 * If the closed tab was active, switches to another available tab.
 *
 * @param tabId - The ID of the tab to close.
 */
function closeTab(tabId: string): void {
  const tabIndex = tabs.findIndex((t) => t.id === tabId);
  if (tabIndex === -1) return;

  tabs.splice(tabIndex, 1);

  if (activeTabId === tabId) {
    if (tabs.length === 0) {
      // Never allow zero tabs: silently create a new untitled tab (VS Code style)
      // createUntitledTab already renders and switches, so don't double-render here.
      createUntitledTab();
      // Persist the updated list (closed file removed, untitled not saved)
      scheduleSessionSave();
      return;
    } else {
      // Switch to the previous tab, or the first one if closing the first tab
      const newActiveIndex = Math.max(0, tabIndex - 1);
      switchTab(tabs[newActiveIndex].id);
    }
  }

  renderTabs();

  // Schedule saving the updated session
  scheduleSessionSave();
}

/**
 * Switches the active tab and updates the editor/preview content.
 *
 * @param tabId - The ID of the tab to switch to.
 * @returns void
 */
function switchTab(tabId: string): void {
  activeTabId = tabId;

  // Update UI
  renderTabs();

  // Find tab data
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    // Restore this tab's content into the editor and preview
    editor.value = tab.content;
    updatePreview();
  }
}

/**
 * Adds a new tab to the system.
 *
 * @param id - Unique identifier for the tab.
 * @param title - The display title of the tab.
 * @param contentId - Reference to the content ID.
 * @param content - The file content for this tab.
 * @returns void
 */
function addTab(
  id: string,
  title: string,
  contentId: string,
  content: string = "",
): void {
  // If a tab with this ID exists, update it; otherwise, push a new one.
  const existingIndex = tabs.findIndex((t) => t.id === id);
  if (existingIndex !== -1) {
    tabs[existingIndex] = {
      id,
      title,
      contentId,
      content,
      dirty: false,
      error: false,
    };
  } else {
    tabs.push({
      id,
      title,
      contentId,
      content,
      dirty: false,
      error: false,
    });
  }

  renderTabs();

  // Auto-switch to the newly added/updated tab
  switchTab(id);

  // Schedule saving the updated session
  scheduleSessionSave();
}

// --- Update existing IPC handlers ---

window.electronAPI.onNew(() => {
  if (editor.value.trim().length > 0) {
    const confirmed = confirm(
      "The editor contains unsaved changes. Create a new document anyway?",
    );
    if (!confirmed) return;
  }
  editor.value = "";
  preview.innerHTML = "";

  // Clear tabs or handle new file appropriately
  tabs = [];
  activeTabId = null;
  renderTabs();
});

window.electronAPI.onOpen((data: { filePath: string; content: string }) => {
  const tabId = `tab-${data.filePath.split("/").pop()}`; // Simple unique ID from filename
  const title = data.filePath.split("/").pop() || "Untitled";

  addTab(tabId, title, data.filePath, data.content);

  editor.value = data.content;
  updatePreview();
});

// Save: main process sends filePath; renderer sends content back.
// For untitled tabs, we request a Save-As dialog instead.
window.electronAPI.onSavePrompt((filePath: string | null) => {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab) return;

  // If no path given, request Save-As
  if (!filePath) {
    window.electronAPI.saveAsRequest();
    return;
  }

  // A path was provided (either existing tab or from Save-As).
  // If this is an untitled tab, promote it to the chosen path first.
  if (UNTITLED_ID_RE.test(activeTab.contentId)) {
    activeTab.contentId = filePath;
    activeTab.title = filePath.split("/").pop() || "Untitled";
    renderTabs();
  }

  window.electronAPI.saveContent(editor.value, filePath);
});

// Success: main process confirms save.
window.electronAPI.onSaveDone(({ filePath }: { filePath: string }) => {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab) {
    // Sync tab content with what was saved and mark as clean
    activeTab.content = editor.value;
    activeTab.dirty = false;
    // If the tab's contentId differs from the saved path, update it
    if (activeTab.contentId !== filePath) {
      activeTab.contentId = filePath;
      activeTab.title = filePath.split("/").pop() || "Untitled";
      renderTabs();
    }
  }
  // Schedule saving the updated session after a file save
  scheduleSessionSave();
});

// Error: main process reports a save failure.
window.electronAPI.onSaveError(
  ({ filePath, error }: { filePath: string; error: string }) => {
    console.error(`Failed to save "${filePath}":`, error);
  },
);

/**
 * Saves the current list of open files to config via IPC.
 * Untitled tabs are excluded from session persistence.
 */
function saveSession(): void {
  const persistentTabs = tabs.filter((t) => !UNTITLED_ID_RE.test(t.contentId));
  window.electronAPI.saveSessionFiles(persistentTabs, activeTabId);
}

/**
 * Loads the session from config on startup.
 * For each saved file, tries to restore it; if not found, creates an error tab.
 */
async function loadSession(): Promise<void> {
  const { files, activeTabId: savedActiveTabId } =
    await window.electronAPI.loadSessionFiles();

  if (!files || files.length === 0) {
    // No saved files — create a single untitled tab on startup
    createUntitledTab();
    return;
  }

  for (const entry of files) {
    const result = await window.electronAPI.openFileSilent(entry.contentId);
    if (!result.success) {
      // File not found or read error — create an error tab
      console.warn(
        `[Session] Could not load "${entry.contentId}":`,
        result.error,
      );
      tabs.push({
        id: entry.id,
        title: entry.title,
        contentId: entry.contentId,
        content: "",
        dirty: false,
        error: true,
      });
    }
    // If successful, onOpen handler will create/update the tab
  }

  renderTabs();

  // Restore the previously active tab if it still exists
  if (savedActiveTabId && tabs.some((t) => t.id === savedActiveTabId)) {
    activeTabId = savedActiveTabId;
    const activeTab = tabs.find((t) => t.id === savedActiveTabId);
    if (activeTab && !activeTab.error) {
      editor.value = activeTab.content;
      updatePreview();
    }
    renderTabs();
  } else if (tabs.length > 0) {
    // Activate the first non-error tab
    const firstValid = tabs.find((t) => !t.error);
    if (firstValid) {
      switchTab(firstValid.id);
    }
  }
}

// Save session whenever tabs change (add, close, save)
let sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSessionSave(): void {
  // Debounce: save after 500ms of inactivity
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(saveSession, 500);
}

/**
 * Apply a theme by setting the corresponding CSS class on the body element.
 *
 * Removes all existing theme classes first, then adds the new one.
 * Updates the active state of theme buttons in the modal.
 *
 * @param theme - The theme identifier to apply (e.g., "dark", "sepia")
 */
function applyTheme(theme: string, persist: boolean = true): void {
  // Remove all existing theme classes from the body
  THEMES.forEach((t) => {
    document.body.classList.remove(`theme-${t}`);
  });

  // Add the new theme class
  document.body.classList.add(`theme-${theme}`);
  if (persist) {
    // Only send selectTheme once per theme change
    if (currentTheme !== theme) {
      window.electronAPI.selectTheme(theme);
    }
  }

  // Update active state on theme buttons
  const buttons = document.querySelectorAll(".theme-btn");
  buttons.forEach((btn) => {
    const button = btn as HTMLButtonElement;
    if (button.dataset.theme === theme) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });

  currentTheme = theme;
}

/**
 * Open the theme picker modal dialog.
 *
 * Shows the modal and sets focus to the close button for accessibility.
 */
function openThemeModal(): void {
  themeModal.style.display = "flex";
  themeCloseBtn.focus();
}

/**
 * Close the theme picker modal dialog.
 *
 * Hides the modal overlay from view.
 */
function closeThemeModal(): void {
  themeModal.style.display = "none";
}

// Handle the "Themes" menu action: open the modal
window.electronAPI.onThemes(() => {
  openThemeModal();
});

// Wire up theme selection buttons inside the modal
const themeButtons = document.querySelectorAll(".theme-btn");
themeButtons.forEach((btn) => {
  const button = btn as HTMLButtonElement;
  button.addEventListener("click", () => {
    const theme = button.dataset.theme || "light";
    applyTheme(theme);
  });
});

// Close button handler
themeCloseBtn.addEventListener("click", closeThemeModal);

// Close modal when clicking outside the content area
themeModal.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains("modal-overlay")) {
    closeThemeModal();
  }
});

// Listen for theme changes from the main process (for persistence)
window.electronAPI.onLoadTheme((theme) => {
  applyTheme(theme);
});

// --- Context Menu ---

/** Reference to the custom context menu element. */
const contextMenu = document.getElementById(
  "context-menu",
) as HTMLDivElement | null;

/**
 * Hide the context menu.
 */
function hideContextMenu(): void {
  if (contextMenu) {
    contextMenu.classList.remove("visible");
  }
}

/**
 * Show the context menu at the given position, clamped to viewport bounds.
 */
function showContextMenu(x: number, y: number): void {
  if (!contextMenu) return;

  // Clamp to viewport
  const menuWidth = contextMenu.offsetWidth || 160;
  const menuHeight = contextMenu.offsetHeight || 100;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 4);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 4);

  contextMenu.style.left = `${Math.max(4, clampedX)}px`;
  contextMenu.style.top = `${Math.max(4, clampedY)}px`;
  contextMenu.classList.add("visible");
}

/**
 * Get the selected text from the editor textarea.
 */
function getEditorSelection(): {
  text: string;
  start: number;
  end: number;
} {
  const start = editor.selectionStart ?? 0;
  const end = editor.selectionEnd ?? 0;
  return {
    text: editor.value.slice(start, end),
    start,
    end,
  };
}

/**
 * Get the selected text from the preview div.
 */
function getPreviewSelection(): string {
  const selection = window.getSelection();
  if (!selection) return "";
  const range = selection.getRangeAt(0);
  // Only return text if the selection is inside the preview
  if (!preview.contains(range.commonAncestorContainer)) return "";
  return selection.toString();
}

/**
 * Build the context menu items for the given target.
 */
function buildContextMenuItems(
  target: "editor" | "preview",
): Array<{ label: string; action: () => void; shortcut?: string }> {
  const items: Array<{ label: string; action: () => void; shortcut?: string }> =
    [];

  if (target === "editor") {
    items.push({
      label: "Cut",
      shortcut: "Ctrl+X",
      action: async () => {
        const sel = getEditorSelection();
        if (sel.text.length > 0) {
          await window.electronAPI.writeClipboard(sel.text);
          // Delete the selected text
          editor.setRangeText("", sel.start, sel.end, "select");
        }
        hideContextMenu();
      },
    });
  }

  items.push({
    label: "Copy",
    shortcut: "Ctrl+C",
    action: async () => {
      const text =
        target === "editor" ? getEditorSelection().text : getPreviewSelection();
      if (text.length > 0) {
        await window.electronAPI.writeClipboard(text);
      }
      hideContextMenu();
    },
  });

  if (target === "editor") {
    items.push({
      label: "Paste",
      shortcut: "Ctrl+V",
      action: async () => {
        const clipText = await window.electronAPI.readClipboard();
        if (clipText.length > 0) {
          const start = editor.selectionStart ?? editor.value.length;
          const end = editor.selectionEnd ?? editor.value.length;
          editor.setRangeText(clipText, start, end, "end");
          // Trigger input event to update preview
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        }
        hideContextMenu();
      },
    });
  }

  items.push({
    label: "Select All",
    shortcut: "Ctrl+A",
    action: () => {
      if (target === "editor") {
        editor.select();
        editor.focus();
      } else {
        // Select all text in the preview div
        const range = document.createRange();
        range.selectNodeContents(preview);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
      hideContextMenu();
    },
  });

  return items;
}

/**
 * Populate and show the context menu for the given target.
 */
function renderContextMenu(
  target: "editor" | "preview",
  x: number,
  y: number,
): void {
  if (!contextMenu) return;

  const items = buildContextMenuItems(target);
  contextMenu.innerHTML = "";

  items.forEach((item, index) => {
    // Add separator before Select All
    if (index > 0 && item.label === "Select All") {
      const sep = document.createElement("div");
      sep.className = "context-menu-separator";
      contextMenu.appendChild(sep);
    }

    const menuItem = document.createElement("div");
    menuItem.className = "context-menu-item";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = item.label;
    menuItem.appendChild(labelSpan);

    if (item.shortcut) {
      const shortcutSpan = document.createElement("span");
      shortcutSpan.className = "shortcut";
      shortcutSpan.textContent = item.shortcut;
      menuItem.appendChild(shortcutSpan);
    }

    menuItem.addEventListener("click", () => {
      item.action();
    });

    contextMenu.appendChild(menuItem);
  });

  showContextMenu(x, y);
}

// Hide context menu when clicking anywhere else
document.addEventListener("click", (e) => {
  if (contextMenu && contextMenu.classList.contains("visible")) {
    if (
      !contextMenu.contains(e.target as Node) &&
      !(e.target as HTMLElement).classList.contains("context-menu-item")
    ) {
      hideContextMenu();
    }
  }
});

// Context menu on the editor textarea
editor.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  renderContextMenu("editor", e.clientX, e.clientY);
});

// Context menu on the preview div
preview.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  renderContextMenu("preview", e.clientX, e.clientY);
}); // end preview context menu
// --- Find & Replace ---

const findReplaceBar = document.getElementById(
  "find-replace-bar",
) as HTMLDivElement | null;
const findInput = document.getElementById(
  "find-input",
) as HTMLInputElement | null;
const replaceInput = document.getElementById(
  "replace-input",
) as HTMLInputElement | null;
const findCount = document.getElementById(
  "find-count",
) as HTMLSpanElement | null;
const findCaseSensitive = document.getElementById(
  "find-case-sensitive",
) as HTMLInputElement | null;

let currentMatchIndex = -1; // index of currently highlighted match
let allMatches: Array<{ start: number; end: number }> = [];

/**
 * Escape special regex characters in a literal string.
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Search the editor content for all occurrences of the find query.
 * Returns an array of { start, end } ranges.
 */
function findMatches(query: string): Array<{ start: number; end: number }> {
  if (!query) return [];

  const text = editor.value;
  const flags = findCaseSensitive?.checked ? "g" : "gi";
  const regex = new RegExp(escapeRegex(query), flags);

  const matches: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length });
    // Prevent zero-length match infinite loops
    if (match[0].length === 0) regex.lastIndex++;
  }

  return matches;
}

/**
 * Highlight the current match in the editor by selecting it.
 */
function highlightMatch(index: number): void {
  if (allMatches.length === 0 || index < 0 || index >= allMatches.length) {
    currentMatchIndex = -1;
    return;
  }

  currentMatchIndex = index;
  const match = allMatches[index];

  // Set cursor/selection to the match
  editor.setSelectionRange(match.start, match.end);
  editor.focus();

  // Scroll editor to show the match
  const textBefore = editor.value.substring(0, match.start);
  const newlineCount = (textBefore.match(/\n/g) || []).length;
  editor.scrollTop = Math.max(0, (newlineCount - 5) * 20); // rough estimate

  // Update count display
  if (findCount) {
    findCount.textContent = `${index + 1}/${allMatches.length}`;
  }
}

/**
 * Perform a search and navigate to the given direction.
 */
function navigateFind(direction: "next" | "prev"): void {
  const query = findInput?.value;
  if (!query) return;

  allMatches = findMatches(query);

  if (allMatches.length === 0) {
    currentMatchIndex = -1;
    if (findCount) findCount.textContent = "0 results";
    return;
  }

  if (currentMatchIndex === -1) {
    currentMatchIndex = direction === "next" ? 0 : allMatches.length - 1;
  } else {
    currentMatchIndex =
      direction === "next"
        ? (currentMatchIndex + 1) % allMatches.length
        : (currentMatchIndex - 1 + allMatches.length) % allMatches.length;
  }

  highlightMatch(currentMatchIndex);
}

/**
 * Replace the current match with the replacement text.
 */
function replaceCurrent(): void {
  if (currentMatchIndex === -1 || allMatches.length === 0) return;

  const match = allMatches[currentMatchIndex];
  const replacement = replaceInput?.value ?? "";

  // Replace in editor text
  const before = editor.value.substring(0, match.start);
  const after = editor.value.substring(match.end);
  editor.value = before + replacement + after;

  // Re-search and jump to next match
  navigateFind("next");
  updatePreview();
}

/**
 * Replace all matches at once.
 */
function replaceAll(): void {
  const query = findInput?.value;
  if (!query || allMatches.length === 0) return;

  const replacement = replaceInput?.value ?? "";
  const flags = findCaseSensitive?.checked ? "g" : "gi";
  const regex = new RegExp(escapeRegex(query), flags);

  editor.value = editor.value.replace(regex, replacement);
  allMatches = [];
  currentMatchIndex = -1;
  if (findCount) findCount.textContent = "";

  updatePreview();
}

/**
 * Open the Find & Replace bar.
 */
function openFindReplace(): void {
  if (!findReplaceBar || !findInput) return;

  findReplaceBar.style.display = "block";
  findInput.value = "";
  if (replaceInput) replaceInput.value = "";
  if (findCount) findCount.textContent = "";
  allMatches = [];
  currentMatchIndex = -1;

  // Pre-fill find box with selected text
  const sel = editor.value.substring(
    editor.selectionStart ?? 0,
    editor.selectionEnd ?? 0,
  );
  if (sel && !sel.includes("\n")) {
    findInput.value = sel;
    navigateFind("next");
  }

  findInput.focus();
}

/**
 * Close the Find & Replace bar.
 */
function closeFindReplace(): void {
  if (!findReplaceBar) return;

  findReplaceBar.style.display = "none";
  allMatches = [];
  currentMatchIndex = -1;
  editor.focus();
}

// Wire up Find & Replace controls
document
  .getElementById("find-close")
  ?.addEventListener("click", closeFindReplace);
document
  .getElementById("find-prev")
  ?.addEventListener("click", () => navigateFind("prev"));
document
  .getElementById("find-next")
  ?.addEventListener("click", () => navigateFind("next"));
document
  .getElementById("replace-btn")
  ?.addEventListener("click", replaceCurrent);
document
  .getElementById("replace-all-btn")
  ?.addEventListener("click", replaceAll);

// Live search as the user types in the find box
findInput?.addEventListener("input", () => {
  currentMatchIndex = -1;
  if (findInput?.value) navigateFind("next");
  else {
    allMatches = [];
    if (findCount) findCount.textContent = "";
  }
});

// Keyboard shortcut: Ctrl+F to open Find & Replace
editor.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    openFindReplace();
  }
});

// Enter in replace box triggers replace
replaceInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    replaceCurrent();
  }
});

// Enter in find box navigates to next match
findInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    navigateFind(e.shiftKey ? "prev" : "next");
  }
  if (e.key === "Escape") closeFindReplace();
});

// Load the previous session's open files on startup
loadSession();
