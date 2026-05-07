import EventEmitter from 'events';
import path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { app } from 'electron';
import ConfigService from 'config/ConfigService';
import { Flavour, WowProcessEvent } from 'main/types';
import type { IProcessPoller } from './IProcessPoller';

/**
 * Windows process poller. Spawns the `rust-ps.exe` binary shipped with
 * the app, which periodically emits `{"Retail":bool,"Classic":bool,
 * "Forever":bool}` JSON on stdout.
 */
export default class WinRustPsPoller
  extends EventEmitter
  implements IProcessPoller
{
  private cfg = ConfigService.getInstance();
  private wowRunning = false;
  private child: ChildProcessWithoutNullStreams | undefined;

  /**
   * Tracks what is currently running for each flavour of WoW.
   */
  private state = {
    Retail: false,
    Classic: false,
    Forever: false,
  };

  private readonly binary = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries', 'rust-ps.exe')
    : path.join(app.getAppPath(), 'binaries', 'rust-ps.exe');

  isWowRunning(): boolean {
    return this.wowRunning;
  }

  /**
   * A reminder we don't support multiboxing games (nor does Blizzard on the
   * same account), which is why it's OK this is in order of preference.
   */
  getFlavor(): Flavour | null {
    const { recordRetail, recordClassic, recordForever } =
      this.coalesceRecordingConfig();

    if (this.state.Retail && recordRetail) {
      return Flavour.Retail;
    }

    if (this.state.Classic && recordClassic) {
      return Flavour.Classic;
    }

    if (this.state.Forever && recordForever) {
      return Flavour.Forever;
    }

    return null;
  }

  start(): void {
    this.stop();
    console.info('[WinRustPsPoller] Start');
    this.child = spawn(this.binary);
    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
  }

  stop(): void {
    console.info('[WinRustPsPoller] Stop');
    this.wowRunning = false;
    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
  }

  /**
   * We don't care to do anything better in the scenario of multiple processes
   * running. We don't support users multi-boxing.
   */
  private handleStdout = (data: string | Buffer) => {
    let parsed;

    try {
      parsed = JSON.parse(data.toString());
    } catch {
      // We can hit this on sleeping/resuming from sleep. Or anything
      // else that blocks the event loop long enough to cause us to end up
      // with more than one JSON entry.
      return;
    }

    const { recordRetail, recordClassic, recordForever } =
      this.coalesceRecordingConfig();

    const { Retail, Classic, Forever } = parsed;

    if (
      this.state.Retail !== Retail ||
      this.state.Classic !== Classic ||
      this.state.Forever !== Forever
    ) {
      this.state = { Retail, Classic, Forever };
      console.info('[WinRustPsPoller] State changed', this.state);

      const count = [
        this.state.Retail && recordRetail,
        this.state.Classic && recordClassic,
        this.state.Forever && recordForever,
      ].filter(Boolean).length;

      if (count > 1) {
        // Not a disaster, but not a state we claim to support.
        console.warn('[WinRustPsPoller] Multiple WoW processes', this.state);
      }
    }

    const running =
      (recordRetail && Retail) ||
      (recordClassic && Classic) ||
      (recordForever && Forever);

    if (this.wowRunning === running) return;

    this.wowRunning = running;

    if (running) this.emit(WowProcessEvent.STARTED);
    else this.emit(WowProcessEvent.STOPPED);
  };

  private handleStderr = (data: string | Buffer) => {
    console.warn('[WinRustPsPoller] stderr:', data.toString());
  };

  /**
   * Coalesce the recording configuration from the various flags in the config.
   * PTR shares a process name with its live client, as does Era with Classic.
   */
  private coalesceRecordingConfig = () => {
    return {
      recordRetail:
        this.cfg.get<boolean>('recordRetail') ||
        this.cfg.get<boolean>('recordRetailPtr'),
      recordClassic:
        this.cfg.get<boolean>('recordClassic') ||
        this.cfg.get<boolean>('recordClassicPtr') ||
        this.cfg.get<boolean>('recordEra'),
      recordForever: this.cfg.get<boolean>('recordForever'),
    };
  };
}
