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
editor.addEventListener("input", updatePreview);

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
// --- Menu IPC handlers ---

/**
 * Handle the "New" menu action: clear the editor and reset the preview.
 * Shows a confirmation dialog if there is existing content in the editor.
 */
window.electronAPI.onNew(() => {
  if (editor.value.trim().length > 0) {
    const confirmed = confirm(
      "The editor contains unsaved changes. Create a new document anyway?",
    );
    if (!confirmed) return;
  }
  editor.value = "";
  preview.innerHTML = "";
});

/**
 * Handle the "Open" menu action: load file content into the editor and update the preview.
 *
 * @param data - Object containing filePath and content from the main process
 */
window.electronAPI.onOpen((data: { filePath: string; content: string }) => {
  editor.value = data.content;
  updatePreview();
});

/**
 * Handle the "Save" prompt: send the current editor content to the main process for saving.
 *
 * @param filePath - Target file path from the save dialog
 */
window.electronAPI.onSavePrompt((filePath: string) => {
  window.electronAPI.saveContent(editor.value, filePath);
});

/**
 * Handle the "Save Done" confirmation from the main process.
 *
 * @param data - Object containing the saved file path
 */
window.electronAPI.onSaveDone((data: { filePath: string }) => {
  console.log(`Saved file: ${data.filePath}`);
});

// --- Theme Modal Logic ---

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
});
