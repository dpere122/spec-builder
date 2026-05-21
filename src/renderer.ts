import { marked } from "marked";
import "./styles.css";

/** Reference to the Markdown editor textarea element in the DOM. */
const editor = document.getElementById("editor") as HTMLTextAreaElement;

/** Reference to the HTML preview div where rendered Markdown is displayed. */
const preview = document.getElementById("preview") as HTMLDivElement;

/**
 * Renders the current Markdown text from the editor into HTML and updates the preview pane.
 *
 * Reads the value of the editor textarea, parses it with the `marked` library,
 * and sets the resulting HTML as the innerHTML of the preview element.
 *
 * @returns void
 */
async function updatePreview(): Promise<void> {
  // Parse the Markdown content and inject the resulting HTML into the preview div
  // marked v15 parse() can return string | Promise<string>, so we await it
  const html: string = await marked.parse(editor.value || "");
  preview.innerHTML = html;
}

// Listen for input events on the editor to trigger live preview updates
editor.addEventListener("input", updatePreview);

// Render the preview on initial page load
updatePreview();

// --- Menu IPC handlers ---

/**
 * Handle the "New" menu action: clear the editor and reset the preview.
 */
window.electronAPI.onNew(() => {
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
