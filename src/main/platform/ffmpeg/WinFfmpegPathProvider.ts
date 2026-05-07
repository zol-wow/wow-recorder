import path from 'path';
import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

const REL = 'node_modules/noobs/dist/bin/ffmpeg.exe';

/**
 * Windows ffmpeg path. Reuses the ffmpeg.exe dynamically linked by the
 * noobs bundle so we don't ship a duplicate ~60 MB binary.
 */
export default class WinFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    // The main bundle is in release/app/dist/main in both dev and prod.
    return fixPathWhenPackaged(path.resolve(__dirname, '../../', REL));
  }
}
