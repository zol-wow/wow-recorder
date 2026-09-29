import type { IPermissionsGate, PermissionsSnapshot } from './IPermissionsGate';

/**
 * Windows no-op permissions gate. DirectX hook (game capture), window
 * enumeration, and uiohook work on Windows without user-facing TCC
 * consent, so every category reports 'granted'.
 */
export default class WinPermissionsGate implements IPermissionsGate {
  snapshot(): PermissionsSnapshot {
    return {
      screen: 'granted',
      microphone: 'granted',
      accessibility: 'granted',
    };
  }
  canRecord(): boolean {
    return true;
  }
  canUseGlobalHotkeys(): boolean {
    return true;
  }
  requestScreenRecording(): void {
    // no-op
  }
  openSettingsFor(): void {
    // no-op
  }
}
