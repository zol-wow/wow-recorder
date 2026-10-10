import fs from 'fs';
import os from 'os';
import path from 'path';

// Lets a test act while a directory scan is in progress.
const scan = { during: () => {} };

jest.mock('../../main/util', () => {
  const nodeFs = jest.requireActual('fs');
  const nodePath = jest.requireActual('path');

  const getFileInfo = async (name: string) => {
    const stats = await nodeFs.promises.stat(name);
    return { name, size: stats.size, mtime: stats.mtime.getTime() };
  };

  return {
    getFileInfo,
    getSortedFiles: async (dir: string, pattern: string) => {
      const files = nodeFs
        .readdirSync(dir)
        .filter((f: string) => f.match(new RegExp(pattern)))
        .map((f: string) => nodePath.join(dir, f));
      const infos = await Promise.all(files.map(getFileInfo));
      scan.during();
      return infos.sort((a, b) => b.mtime - a.mtime);
    },
  };
});

import CombatLogWatcher from '../../parsing/CombatLogWatcher';

describe('mac combat log poll', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wcr-logs-'));
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    scan.during = () => {};
    fs.rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  // The watcher is driven through its private poll, as the timer would.
  const poll = (watcher: CombatLogWatcher) =>
    (watcher as unknown as { macPollOnce: () => Promise<void> }).macPollOnce();
  const state = (watcher: CombatLogWatcher) =>
    watcher as unknown as { current: string; macRescan: boolean };

  it('picks up the newest log', async () => {
    fs.writeFileSync(path.join(dir, 'WoWCombatLog-100926_200000.txt'), '');
    const watcher = new CombatLogWatcher(dir);

    await poll(watcher);

    expect(state(watcher).current).toBe('WoWCombatLog-100926_200000.txt');
    expect(state(watcher).macRescan).toBe(false);
  });

  it('forgets a deleted log and keeps looking', async () => {
    const log = path.join(dir, 'WoWCombatLog-100926_200000.txt');
    fs.writeFileSync(log, '');
    const watcher = new CombatLogWatcher(dir);
    await poll(watcher);

    fs.rmSync(log);
    state(watcher).macRescan = true; // As the rename event does.
    await poll(watcher);

    expect(state(watcher).current).toBe('');
    expect(state(watcher).macRescan).toBe(true);

    fs.writeFileSync(path.join(dir, 'WoWCombatLog-100926_210000.txt'), '');
    await poll(watcher);

    expect(state(watcher).current).toBe('WoWCombatLog-100926_210000.txt');
  });

  it('rescans if a log changes during a scan', async () => {
    fs.writeFileSync(path.join(dir, 'WoWCombatLog-100926_200000.txt'), '');
    const watcher = new CombatLogWatcher(dir);
    scan.during = () => {
      state(watcher).macRescan = true; // As the rename event does.
    };

    await poll(watcher);

    expect(state(watcher).macRescan).toBe(true);
  });

  it('retries the scan if it fails', async () => {
    const watcher = new CombatLogWatcher(path.join(dir, 'missing'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await poll(watcher);

    expect(state(watcher).macRescan).toBe(true);
  });
});
