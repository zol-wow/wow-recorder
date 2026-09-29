jest.mock('main/util', () => ({
  fixPathWhenPackaged: (p: string) => p,
}));

import path from 'path';
import MacFfmpegPathProvider from 'main/platform/ffmpeg/MacFfmpegPathProvider';

describe('MacFfmpegPathProvider', () => {
  it('returns a path ending in noobs/dist/Frameworks/ffmpeg', () => {
    const p = new MacFfmpegPathProvider().getPath();
    expect(p).toContain('noobs/dist/Frameworks/ffmpeg');
    expect(path.isAbsolute(p)).toBe(true);
  });
});
