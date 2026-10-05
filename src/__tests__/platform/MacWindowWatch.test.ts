jest.mock('noobs', () => ({}), { virtual: true });
jest.mock('uiohook-napi', () => ({ uIOhook: {}, EventType: {} }));
jest.mock('electron', () => ({ app: { isPackaged: false }, ipcMain: {} }));
jest.mock('config/ConfigService', () => ({
  __esModule: true,
  default: { getInstance: () => ({ get: () => undefined }) },
}));
jest.mock('main/main', () => ({ send: jest.fn() }));
jest.mock('main/util', () => ({}));
jest.mock('main/EditorService', () => ({}));
jest.mock('main/platform', () => ({ getRecorderBackend: () => ({}) }));
jest.mock('utils/Poller', () => ({}));
jest.mock('main/logging', () => ({}));
jest.mock('renderer/rendererutils', () => ({}));

import Recorder from 'main/Recorder';

/**
 * Builds a Recorder without running its constructor (which starts OBS),
 * attached to a fake backend whose WoW window list can be changed.
 */
const makeRecorder = (initialWindow: number) => {
  let windowId = initialWindow;
  let settings: Record<string, unknown> = { type: 1 };

  const backend = {
    getSourceProperties: () => [
      {
        name: 'window',
        type: 'list',
        items: windowId
          ? [
              { name: '[Finder] Desktop', value: 7, disabled: false },
              {
                name: '[Wow] World of Warcraft',
                value: windowId,
                disabled: false,
              },
            ]
          : [],
      },
    ],
    getSourceSettings: () => settings,
    setSourceSettings: jest.fn((_: string, s: Record<string, unknown>) => {
      settings = s;
    }),
  };

  const recorder = Object.create(Recorder.prototype);
  Object.assign(recorder, {
    backend,
    captureSource: 'WCR Window Capture',
    captureMode: 0, // CaptureMode.WINDOW
    findWindowAttempts: 0,
    findWindowAttemptLimit: 10,
    findWindowIntervalDuration: 5000,
  });

  return {
    recorder,
    backend,
    setWindow: (id: number) => {
      windowId = id;
    },
  };
};

describe('mac window capture follows a replaced WoW window', () => {
  const realPlatform = process.platform;

  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('re-attaches when WoW replaces its window', () => {
    const { recorder, backend, setWindow } = makeRecorder(1634);

    recorder.attachCaptureSource();
    expect(backend.setSourceSettings).toHaveBeenCalledTimes(1);
    expect(backend.getSourceSettings().window).toBe(1634);

    setWindow(2015);
    jest.advanceTimersByTime(5000);

    expect(backend.setSourceSettings).toHaveBeenCalledTimes(2);
    expect(backend.getSourceSettings().window).toBe(2015);
    recorder.clearFindWindowInterval();
  });

  it('leaves the stream alone while the window is unchanged', () => {
    const { recorder, backend } = makeRecorder(1634);

    recorder.attachCaptureSource();
    jest.advanceTimersByTime(60000);

    expect(backend.setSourceSettings).toHaveBeenCalledTimes(1);
    recorder.clearFindWindowInterval();
  });

  it('keeps the old window while WoW has none on screen', () => {
    const { recorder, backend, setWindow } = makeRecorder(1634);

    recorder.attachCaptureSource();
    setWindow(0);
    jest.advanceTimersByTime(60000);

    expect(backend.getSourceSettings().window).toBe(1634);

    setWindow(2015);
    jest.advanceTimersByTime(5000);

    expect(backend.getSourceSettings().window).toBe(2015);
    recorder.clearFindWindowInterval();
  });

  it('stops watching once cleared', () => {
    const { recorder, backend, setWindow } = makeRecorder(1634);

    recorder.attachCaptureSource();
    recorder.clearFindWindowInterval();
    setWindow(2015);
    jest.advanceTimersByTime(60000);

    expect(backend.setSourceSettings).toHaveBeenCalledTimes(1);
  });
});
