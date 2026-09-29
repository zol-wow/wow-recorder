import path from 'path';
import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

const devMode = process.env.NODE_ENV === 'development';
const REL = 'node_modules/noobs/dist/Frameworks/ffmpeg';

/**
 * macOS ffmpeg path. noobs ships ffmpeg linked against the same libav*
 * dylibs as libobs, mirroring ffmpeg.exe on Windows.
 */
export default class MacFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    const abs = devMode
      ? path.resolve(__dirname, '../../release/app/', REL)
      : path.resolve(__dirname, '../../', REL);
    return fixPathWhenPackaged(abs);
  }
}
