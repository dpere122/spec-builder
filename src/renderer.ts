import { marked } from "marked";
import DOMPurify from "dompurify";
import "./styles.css";

/** Reference to the Markdown editor textarea element in the DOM. */
const editor = document.getElementById("editor") as HTMLTextAreaElement;

/** Reference to the HTML preview div where rendered Markdown is displayed. */
const preview = document.getElementById("preview") as HTMLDivElement;

/** Available theme identifiers for the theme picker. */
const THEMES: string[] = ["light", "dark", "sepia", "high-contrast"];

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
function applyTheme(theme: string): void {
  // Remove all existing theme classes from the body
  THEMES.forEach((t) => {
    document.body.classList.remove(`theme-${t}`);
  });

  // Add the new theme class
  document.body.classList.add(`theme-${theme}`);
  currentTheme = theme;

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

  // Send theme selection to main process for potential persistence
  window.electronAPI.selectTheme(theme);
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

// --- Preview Pane Toggle ---

/** Reference to the preview pane container. */
const previewPane = document.querySelector(".preview-pane") as HTMLDivElement;

/** Reference to the toggle button for the preview pane. */
const previewToggle = document.getElementById(
  "preview-toggle",
) as HTMLButtonElement;

/** Whether the preview pane is currently collapsed. */
let previewCollapsed: boolean = true;

/**
 * Toggle the visibility of the preview pane.
 *
 * When collapsed, the preview pane disappears and the editor fills the full width.
 * When expanded, the split-pane layout is restored.
 */
function togglePreviewPane(): void {
  previewCollapsed = !previewCollapsed;

  if (previewCollapsed) {
    previewPane.classList.add("collapsed");
    previewToggle.classList.add("collapsed");
    previewToggle.textContent = "▶";
  } else {
    previewPane.classList.remove("collapsed");
    previewToggle.classList.remove("collapsed");
    previewToggle.textContent = "◀";
  }
}

// Wire up the preview toggle button
previewToggle.addEventListener("click", togglePreviewPane);

// Apply the default theme on initial load
applyTheme("light");
