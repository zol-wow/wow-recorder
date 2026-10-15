/**
 * Electron's APIs only exist inside a running app. Jest uses this
 * stand-in instead, with just enough for modules to load.
 */
export const app = {
  isPackaged: false,
  getPath: () => '',
  getVersion: () => '0.0.0',
};

export const ipcMain = {
  on: () => {},
  handle: () => {},
};
