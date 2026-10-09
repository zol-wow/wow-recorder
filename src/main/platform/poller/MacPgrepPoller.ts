import EventEmitter from 'events';
import { spawn } from 'child_process';
import ConfigService from 'config/ConfigService';
import { Flavour, WowProcessEvent } from 'main/types';
import type { IProcessPoller } from './IProcessPoller';

const POLL_INTERVAL_MS = 2000;
const RETAIL_PROCESS = 'World of Warcraft';
const CLASSIC_PROCESS = 'World of Warcraft Classic';

/**
 * macOS process poller. Spawns `pgrep -x <name>` for retail and
 * classic process names every 2 seconds; exit code 0 = running,
 * 1 = not running. Config gates (recordRetail/Classic/Era) are
 * applied before emitting. Era shares the Classic binary on mac,
 * mirroring the Windows behaviour.
 */
export default class MacPgrepPoller
  extends EventEmitter
  implements IProcessPoller
{
  private cfg = ConfigService.getInstance();
  private wowRunning = false;
  private timer: NodeJS.Timeout | undefined;
  private retail = false;
  private classic = false;

  /**
   * Bumped on stop so results from polls still in flight are ignored.
   */
  private generation = 0;

  isWowRunning(): boolean {
    return this.wowRunning;
  }

  /**
   * WoW Forever has no macOS client, so it's never reported.
   */
  getFlavor(): Flavour | null {
    const { recordRetail, recordClassic } = this.recordingConfig();
    if (this.retail && recordRetail) return Flavour.Retail;
    if (this.classic && recordClassic) return Flavour.Classic;
    return null;
  }

  start(): void {
    this.stop();
    console.info('[MacPgrepPoller] Start');
    this.timer = setInterval(this.poll, POLL_INTERVAL_MS);
  }

  stop(): void {
    console.info('[MacPgrepPoller] Stop');
    this.generation++;
    this.wowRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private poll = () => {
    const { generation } = this;

    Promise.all([this.pgrep(RETAIL_PROCESS), this.pgrep(CLASSIC_PROCESS)]).then(
      ([retail, classic]) => {
        if (generation === this.generation) this.apply(retail, classic);
      },
    );
  };

  private pgrep(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('pgrep', ['-x', name]);
      child.on('exit', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  private apply(retail: boolean, classic: boolean): void {
    this.retail = retail;
    this.classic = classic;

    const { recordRetail, recordClassic } = this.recordingConfig();
    const running = (recordRetail && retail) || (recordClassic && classic);

    if (this.wowRunning === running) return;
    this.wowRunning = running;
    if (running) this.emit(WowProcessEvent.STARTED);
    else this.emit(WowProcessEvent.STOPPED);
  }

  /**
   * PTR shares a process name with its live client, as does Era with Classic.
   */
  private recordingConfig() {
    return {
      recordRetail:
        this.cfg.get<boolean>('recordRetail') ||
        this.cfg.get<boolean>('recordRetailPtr'),
      recordClassic:
        this.cfg.get<boolean>('recordClassic') ||
        this.cfg.get<boolean>('recordClassicPtr') ||
        this.cfg.get<boolean>('recordEra'),
    };
  }
}
