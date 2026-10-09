import { Menu, MenuItemConstructorOptions } from 'electron';

export default class MenuBuilder {
  constructor() {}

  buildMenu(): Menu {
    const template =
      process.platform === 'darwin'
        ? this.buildMacTemplate()
        : this.buildDefaultTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    return menu;
  }

  private buildDefaultTemplate(): MenuItemConstructorOptions[] {
    const developSubmenu: MenuItemConstructorOptions[] = [
      {
        label: 'Reload',
        accelerator: 'CommandOrControl+R',
        role: 'reload',
      },
      {
        label: 'Toggle Developer Tools',
        role: 'toggleDevTools',
        accelerator: 'CommandOrControl+Shift+I',
      },
      {
        label: 'Zoom In',
        accelerator: 'CommandOrControl+Plus',
        role: 'zoomIn',
        visible: false,
        enabled: true,
      },
      {
        label: 'Zoom In Fix',
        accelerator: 'CommandOrControl+=',
        role: 'zoomIn',
        visible: false,
        enabled: true,
      },
      {
        label: 'Zoom Out',
        accelerator: 'CommandOrControl+-',
        role: 'zoomOut',
        visible: false,
        enabled: true,
      },
      {
        label: 'Zoom Out',
        accelerator: 'CommandOrControl+0',
        role: 'resetZoom',
        visible: false,
        enabled: true,
      },
    ];
    return [
      { label: 'View', submenu: developSubmenu, visible: false, enabled: true },
    ];
  }

  private buildMacTemplate(): MenuItemConstructorOptions[] {
    // The standard macOS menus, with labels from Electron. Edit is needed
    // for copy and paste shortcuts to work.
    return [
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'windowMenu' },
      ...this.buildDefaultTemplate(),
    ];
  }
}
