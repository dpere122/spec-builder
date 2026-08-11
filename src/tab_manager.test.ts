import {
  createTabState,
  addTab,
  closeTab,
  switchTab,
  getActiveTab,
  getTabById,
  clearTabs,
  updateTabTitle,
} from "../src/tab_manager";

describe("Tab Manager", () => {
  describe("createTabState", () => {
    it("should create an empty state", () => {
      const state = createTabState();
      expect(state.tabs).toEqual([]);
      expect(state.activeTabId).toBeNull();
    });
  });

  describe("addTab", () => {
    it("should add a new tab and set it as active", () => {
      const state = createTabState();
      const newState = addTab(state, "tab-1", "File 1", "/path/to/file1.md");

      expect(newState.tabs).toHaveLength(1);
      expect(newState.tabs[0]).toEqual({
        id: "tab-1",
        title: "File 1",
        contentId: "/path/to/file1.md",
      });
      expect(newState.activeTabId).toBe("tab-1");
    });

    it("should add multiple tabs", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path/to/file1.md");
      state = addTab(state, "tab-2", "File 2", "/path/to/file2.md");

      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe("tab-2");
    });

    it("should update an existing tab when ID matches", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "Old Title", "/old/path.md");
      state = addTab(state, "tab-1", "New Title", "/new/path.md");

      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].title).toBe("New Title");
      expect(state.tabs[0].contentId).toBe("/new/path.md");
      expect(state.activeTabId).toBe("tab-1");
    });

    it("should not mutate the original state", () => {
      const state = createTabState();
      const newState = addTab(state, "tab-1", "File 1", "/path.md");

      expect(state.tabs).toHaveLength(0);
      expect(newState.tabs).toHaveLength(1);
    });
  });

  describe("closeTab", () => {
    it("should remove a tab by ID", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      state = addTab(state, "tab-2", "File 2", "/path2.md");
      const newState = closeTab(state, "tab-1");

      expect(newState.tabs).toHaveLength(1);
      expect(newState.tabs[0].id).toBe("tab-2");
    });

    it("should switch to previous tab when closing active tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      state = addTab(state, "tab-2", "File 2", "/path2.md");
      state = addTab(state, "tab-3", "File 3", "/path3.md");

      // Make tab-2 active before closing it
      state = switchTab(state, "tab-2");
      const newState = closeTab(state, "tab-2");

      expect(newState.activeTabId).toBe("tab-1");
    });

    it("should switch to next tab when closing first active tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      state = addTab(state, "tab-2", "File 2", "/path2.md");

      const newState = closeTab(state, "tab-1");

      expect(newState.activeTabId).toBe("tab-2");
    });

    it("should set activeTabId to null when closing the last tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      const newState = closeTab(state, "tab-1");

      expect(newState.tabs).toHaveLength(0);
      expect(newState.activeTabId).toBeNull();
    });

    it("should not change state when closing non-existent tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      const newState = closeTab(state, "tab-999");

      expect(newState.tabs).toHaveLength(1);
      expect(newState.activeTabId).toBe("tab-1");
    });

    it("should keep active tab when closing a different tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      state = addTab(state, "tab-2", "File 2", "/path2.md");
      // Switch back to tab-1
      state = switchTab(state, "tab-1");

      const newState = closeTab(state, "tab-2");

      expect(newState.activeTabId).toBe("tab-1");
    });
  });

  describe("switchTab", () => {
    it("should switch to the given tab ID", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      state = addTab(state, "tab-2", "File 2", "/path2.md");

      const newState = switchTab(state, "tab-1");

      expect(newState.activeTabId).toBe("tab-1");
    });

    it("should not change state when switching to non-existent tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");

      const newState = switchTab(state, "tab-999");

      expect(newState.activeTabId).toBe("tab-1");
    });
  });

  describe("getActiveTab", () => {
    it("should return the active tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");

      const active = getActiveTab(state);

      expect(active).toEqual({
        id: "tab-1",
        title: "File 1",
        contentId: "/path1.md",
      });
    });

    it("should return null when no tab is active", () => {
      const state = createTabState();
      expect(getActiveTab(state)).toBeNull();
    });
  });

  describe("getTabById", () => {
    it("should return the tab with the given ID", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      state = addTab(state, "tab-2", "File 2", "/path2.md");

      const tab = getTabById(state, "tab-2");

      expect(tab).toEqual({
        id: "tab-2",
        title: "File 2",
        contentId: "/path2.md",
      });
    });

    it("should return null when tab not found", () => {
      const state = createTabState();
      expect(getTabById(state, "tab-999")).toBeNull();
    });
  });

  describe("clearTabs", () => {
    it("should remove all tabs and reset active tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");
      state = addTab(state, "tab-2", "File 2", "/path2.md");

      const newState = clearTabs(state);

      expect(newState.tabs).toHaveLength(0);
      expect(newState.activeTabId).toBeNull();
    });
  });

  describe("updateTabTitle", () => {
    it("should update the title of an existing tab", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "Old Title", "/path1.md");

      const newState = updateTabTitle(state, "tab-1", "New Title");

      expect(newState.tabs[0].title).toBe("New Title");
      expect(newState.tabs[0].id).toBe("tab-1");
      expect(newState.tabs[0].contentId).toBe("/path1.md");
    });

    it("should not change state when tab not found", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "File 1", "/path1.md");

      const newState = updateTabTitle(state, "tab-999", "New Title");

      expect(newState.tabs).toHaveLength(1);
      expect(newState.tabs[0].title).toBe("File 1");
    });

    it("should not mutate the original state", () => {
      let state = createTabState();
      state = addTab(state, "tab-1", "Old Title", "/path1.md");

      const newState = updateTabTitle(state, "tab-1", "New Title");

      expect(state.tabs[0].title).toBe("Old Title");
      expect(newState.tabs[0].title).toBe("New Title");
    });
  });
});
