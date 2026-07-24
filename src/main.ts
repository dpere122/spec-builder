import { App } from "./app";

/**
 * Bootstrap entry point for the Electron main process.
 *
 * Instantiates the `App` class which composes the window,
 * menu, IPC, and logging subsystems and wires up the
 * Electron app lifecycle hooks.
 */
const application = new App();
application.start();
