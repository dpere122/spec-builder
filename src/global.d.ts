/**
 * Type declaration for the electronAPI exposed by preload.ts via contextBridge.
 *
 * Augments the global Window interface so TypeScript recognizes the
 * IPC methods available to the renderer process.
 */
declare global {
  interface Window {
    electronAPI: {
      onNew: (callback: () => void) => void;
      onOpen: (
        callback: (data: { filePath: string; content: string }) => void,
      ) => void;
      onSavePrompt: (callback: (filePath: string) => void) => void;
      onSaveDone: (callback: (data: { filePath: string }) => void) => void;
      saveContent: (content: string, filePath: string) => void;
      onThemes: (callback: () => void) => void;
      selectTheme: (theme: string) => void;
    };
  }
}

export {};
