jest.mock('noobs', () => ({}), { virtual: true });
jest.mock('uiohook-napi', () => ({ uIOhook: {}, EventType: {} }), {
  virtual: true,
});
jest.mock('electron', () => ({ app: { isPackaged: false }, ipcMain: {} }));
jest.mock('config/ConfigService', () => ({
  __esModule: true,
  default: { getInstance: () => ({ get: () => undefined }) },
}));
jest.mock('main/main', () => ({ send: jest.fn() }));
jest.mock('main/util', () => ({}));
jest.mock('main/EditorService', () => ({}));
jest.mock('main/platform', () => ({ getRecorderBackend: () => ({}) }));
const poller = { wowRunning: true };
jest.mock('utils/Poller', () => ({
  __esModule: true,
  default: { getInstance: () => ({ isWowRunning: () => poller.wowRunning }) },
}));
jest.mock('main/logging', () => ({}));
jest.mock('renderer/rendererutils', () => ({}));

import Recorder from 'main/Recorder';

const SOURCE = 'WCR Window Capture';

/**
 * Builds a Recorder without running its constructor (which starts OBS),
 * attached to a fake backend whose on screen WoW windows can be changed.
 */
const makeRecorder = (initialWindows: number[]) => {
  let windows = initialWindows;
  let settings: Record<string, unknown> = { type: 1 };

  const backend = {
    getSourceProperties: jest.fn(() => [
      {
        name: 'window',
        type: 'list',
        items: [
          { name: '[Finder] Desktop', value: 7, disabled: false },
          ...windows.map((value) => ({
            name: '[Wow] World of Warcraft',
            value,
            disabled: false,
          })),
        ],
      },
    ]),
    isWindowOnScreen: jest.fn((id: number) => windows.includes(id)),
    getSourceSettings: () => settings,
    setSourceSettings: jest.fn((_: string, s: Record<string, unknown>) => {
      settings = s;
    }),
  };

  const recorder = Object.create(Recorder.prototype);
  Object.assign(recorder, {
    backend,
    captureSource: SOURCE,
    captureMode: 0, // CaptureMode.WINDOW
    findWindowAttempts: 0,
    findWindowAttemptLimit: 10,
    findWindowIntervalDuration: 5000,
  });

  return {
    recorder,
    backend,
    attachedTo: () => settings.window,
    setWindows: (ids: number[]) => {
      windows = ids;
    },
  };
};

describe('mac window capture follows the WoW window', () => {
  const realPlatform = process.platform;

  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  beforeEach(() => {
    poller.wowRunning = true;
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('only lists windows while the attached one is off screen', () => {
    const { recorder, backend, attachedTo } = makeRecorder([1634]);

    recorder.attachCaptureSource();
    jest.advanceTimersByTime(60000);

    expect(attachedTo()).toBe(1634);
    expect(backend.getSourceProperties).toHaveBeenCalledTimes(1);
    expect(backend.isWindowOnScreen).toHaveBeenCalledTimes(12);
    recorder.clearFindWindowInterval();
  });

  it('re-attaches when WoW replaces its window', () => {
    const { recorder, attachedTo, setWindows } = makeRecorder([1634]);

    recorder.attachCaptureSource();
    setWindows([2015]);
    jest.advanceTimersByTime(5000);

    expect(attachedTo()).toBe(2015);
    recorder.clearFindWindowInterval();
  });

  it('keeps the window while WoW is minimised', () => {
    const { recorder, backend, attachedTo, setWindows } = makeRecorder([1634]);

    recorder.attachCaptureSource();
    setWindows([]);
    jest.advanceTimersByTime(60000);
    setWindows([1634]);
    jest.advanceTimersByTime(5000);

    expect(attachedTo()).toBe(1634);
    expect(backend.setSourceSettings).toHaveBeenCalledTimes(1);
    recorder.clearFindWindowInterval();
  });

  it('keeps looking past the retry limit until WoW is on screen', () => {
    const { recorder, attachedTo, setWindows } = makeRecorder([]);

    recorder.attachCaptureSource();
    jest.advanceTimersByTime(5000 * 20);
    expect(attachedTo()).toBeUndefined();

    setWindows([2015]);
    jest.advanceTimersByTime(5000);
    expect(attachedTo()).toBe(2015);
    recorder.clearFindWindowInterval();
  });

  it('runs one check loop when attached twice', () => {
    const { recorder, backend } = makeRecorder([1634]);

    recorder.attachCaptureSource();
    recorder.attachCaptureSource();
    jest.advanceTimersByTime(50000);

    expect(backend.isWindowOnScreen).toHaveBeenCalledTimes(10);
    recorder.clearFindWindowInterval();
  });

  it('stops checking once WoW is not running', () => {
    const { recorder, backend } = makeRecorder([1634]);

    recorder.attachCaptureSource();
    poller.wowRunning = false;
    jest.advanceTimersByTime(60000);

    expect(backend.isWindowOnScreen).not.toHaveBeenCalled();
  });

  it('stops checking once cleared', () => {
    const { recorder, backend } = makeRecorder([1634]);

    recorder.attachCaptureSource();
    recorder.clearFindWindowInterval();
    jest.advanceTimersByTime(60000);

    expect(backend.isWindowOnScreen).not.toHaveBeenCalled();
  });
});
