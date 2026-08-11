/**
 * Pure tab state management logic (no DOM dependencies).
 * Used by renderer.ts for the tab system.
 */

export interface Tab {
  id: string;
  title: string;
  contentId: string;
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

/**
 * Create an empty tab state.
 */
export function createTabState(): TabState {
  return {
    tabs: [],
    activeTabId: null,
  };
}

/**
 * Add a new tab or update an existing one by ID.
 * The added/updated tab becomes active.
 */
export function addTab(
  state: TabState,
  id: string,
  title: string,
  contentId: string,
): TabState {
  const existingIndex = state.tabs.findIndex((t) => t.id === id);
  let newTabs = [...state.tabs];

  if (existingIndex !== -1) {
    newTabs[existingIndex] = { id, title, contentId };
  } else {
    newTabs.push({ id, title, contentId });
  }

  return {
    ...state,
    tabs: newTabs,
    activeTabId: id,
  };
}

/**
 * Close a tab by ID.
 * If the closed tab was active, switch to the nearest neighbor (previous preferred),
 * or null if no tabs remain.
 */
export function closeTab(state: TabState, id: string): TabState {
  const tabIndex = state.tabs.findIndex((t) => t.id === id);
  if (tabIndex === -1) {
    return state; // Tab not found, no change
  }

  const newTabs = state.tabs.filter((t) => t.id !== id);
  let newActiveId = state.activeTabId;

  if (state.activeTabId === id) {
    if (newTabs.length === 0) {
      newActiveId = null;
    } else if (tabIndex > 0) {
      newActiveId = newTabs[tabIndex - 1].id;
    } else {
      newActiveId = newTabs[0].id;
    }
  }

  return {
    ...state,
    tabs: newTabs,
    activeTabId: newActiveId,
  };
}

/**
 * Switch the active tab to the given ID.
 * Returns unchanged state if the tab doesn't exist.
 */
export function switchTab(state: TabState, id: string): TabState {
  const exists = state.tabs.some((t) => t.id === id);
  if (!exists) {
    return state;
  }
  return {
    ...state,
    activeTabId: id,
  };
}

/**
 * Get the active tab, or null if no tab is active.
 */
export function getActiveTab(state: TabState): Tab | null {
  if (!state.activeTabId) return null;
  return state.tabs.find((t) => t.id === state.activeTabId) ?? null;
}

/**
 * Get a tab by ID, or null if not found.
 */
export function getTabById(state: TabState, id: string): Tab | null {
  return state.tabs.find((t) => t.id === id) ?? null;
}

/**
 * Clear all tabs and reset active tab.
 */
export function clearTabs(_state: TabState): TabState {
  return {
    tabs: [],
    activeTabId: null,
  };
}

/**
 * Update the title of a tab by ID.
 * Returns unchanged state if the tab doesn't exist.
 */
export function updateTabTitle(
  state: TabState,
  id: string,
  newTitle: string,
): TabState {
  const tabIndex = state.tabs.findIndex((t) => t.id === id);
  if (tabIndex === -1) {
    return state;
  }

  const newTabs = [...state.tabs];
  newTabs[tabIndex] = { ...newTabs[tabIndex], title: newTitle };

  return {
    ...state,
    tabs: newTabs,
  };
}
