import path from 'path';
import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

const REL = 'node_modules/noobs/dist/Frameworks/ffmpeg';

/**
 * macOS ffmpeg path. noobs ships ffmpeg linked against the same libav*
 * dylibs as libobs, mirroring ffmpeg.exe on Windows.
 */
export default class MacFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    // The main bundle is in release/app/dist/main in both dev and prod.
    return fixPathWhenPackaged(path.resolve(__dirname, '../../', REL));
  }
}
