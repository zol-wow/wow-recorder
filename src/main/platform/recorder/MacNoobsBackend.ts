// Native module via raw require — bypass esModuleInterop's
// __importDefault wrapper, which turns `noobs.Init` into
// `noobs.default.Init` at runtime.
const noobs: typeof import('noobs').default = require('noobs');
import { ESupportedEncoders } from 'main/obsEnums';
import type {
  FileExtension,
  ObsData,
  ObsProperty,
  SceneItemPosition,
  SourceDimensions,
} from './types';
import { CaptureModeCapability } from './IRecorderBackend';
import type {
  BackendInitOptions,
  IRecorderBackend,
  RecorderCapabilities,
} from './IRecorderBackend';

/**
 * macOS recorder backend. Same shape as NoobsBackend (Win) — both
 * sit on top of the same `noobs` native module — but advertises the
 * Mac-specific capture mode + encoder set.
 *
 * The Mac differences inside noobs (NSView preview, .plugin bundle
 * paths, CoreAudio source ids, VideoToolbox encoders, etc.) live in
 * the C++; the JS side calls the same exports the Windows path does.
 *
 * Game capture is unavailable on macOS (no DirectX/Vulkan hook
 * injection equivalent), so only WINDOW + MONITOR are listed.
 * NVENC / QSV / AMD encoders are similarly Win-only.
 */
export default class MacNoobsBackend implements IRecorderBackend {
  public readonly capabilities: RecorderCapabilities = {
    captureModes: [CaptureModeCapability.WINDOW, CaptureModeCapability.MONITOR],
    encoders: [
      ESupportedEncoders.OBS_X264,
      ESupportedEncoders.VT_H264,
      ESupportedEncoders.VT_HEVC,
    ],
  };

  // Lifecycle
  init(options: BackendInitOptions): void {
    noobs.Init(options.noobsDistPath, options.logPath, options.signalCallback);
  }
  initPreview(handle: Buffer): void {
    noobs.InitPreview(handle);
  }
  shutdown(): void {
    noobs.Shutdown();
  }
  setBuffering(enabled: boolean): void {
    noobs.SetBuffering(enabled);
  }
  setFragmentation(enabled: boolean): void {
    noobs.SetFragmentation(enabled);
  }
  setDrawSourceOutline(enabled: boolean): void {
    noobs.SetDrawSourceOutline(enabled);
  }

  // Video context
  resetVideoContext(fps: number, width: number, height: number): void {
    noobs.ResetVideoContext(fps, width, height);
  }
  getPreviewInfo(): {
    canvasWidth: number;
    canvasHeight: number;
    previewWidth: number;
    previewHeight: number;
  } {
    return noobs.GetPreviewInfo();
  }

  // Preview window
  configurePreview(x: number, y: number, width: number, height: number): void {
    noobs.ConfigurePreview(x, y, width, height);
  }
  showPreview(): void {
    noobs.ShowPreview();
  }
  hidePreview(): void {
    noobs.HidePreview();
  }
  disablePreview(): void {
    noobs.DisablePreview();
  }

  // Recording output
  setRecordingCfg(outputPath: string, container: FileExtension): void {
    noobs.SetRecordingCfg(outputPath, container);
  }
  setVideoEncoder(encoder: string, settings: ObsData): void {
    noobs.SetVideoEncoder(this.mapEncoderId(encoder), settings);
  }
  listVideoEncoders(): string[] {
    // Vanilla libobs reports native ids like
    // 'com.apple.videotoolbox.videoencoder.ave.avc'. The shared
    // ESupportedEncoders enum uses opaque keys ('VT_H264', 'VT_HEVC').
    // Collapse the multiple Apple H264/HEVC variants into the enum
    // keys so the renderer's encoderFilter matches.
    const native: string[] = noobs.ListVideoEncoders();
    const out: string[] = [];
    if (native.includes('obs_x264')) out.push('obs_x264');
    if (native.some((e) => MacNoobsBackend.VT_H264_NATIVE.includes(e))) {
      out.push('VT_H264');
    }
    if (native.some((e) => MacNoobsBackend.VT_HEVC_NATIVE.includes(e))) {
      out.push('VT_HEVC');
    }
    return out;
  }

  // OBS Mac registers two H264 + two HEVC VT encoders. Prefer
  // `.ave.*` (Apple's encoder framework) which is what OBS Studio's
  // own UI defaults to; fall back to the alternates if absent.
  private static readonly VT_H264_NATIVE = [
    'com.apple.videotoolbox.videoencoder.ave.avc',
    'com.apple.videotoolbox.videoencoder.h264',
  ];
  private static readonly VT_HEVC_NATIVE = [
    'com.apple.videotoolbox.videoencoder.ave.hevc',
    'com.apple.videotoolbox.videoencoder.hevc.vcp',
  ];

  private mapEncoderId(encoder: string): string {
    if (encoder === 'VT_H264') {
      const native = noobs.ListVideoEncoders();
      return (
        MacNoobsBackend.VT_H264_NATIVE.find((id: string) =>
          native.includes(id),
        ) ?? encoder
      );
    }
    if (encoder === 'VT_HEVC') {
      const native = noobs.ListVideoEncoders();
      return (
        MacNoobsBackend.VT_HEVC_NATIVE.find((id: string) =>
          native.includes(id),
        ) ?? encoder
      );
    }
    return encoder;
  }

  // Sources
  createSource(id: string, type: string): string {
    return noobs.CreateSource(id, this.mapSourceType(type));
  }

  // Win source ids → Mac equivalents. Shared callers (Recorder,
  // types.ts) keep the Win strings; we translate at the boundary.
  // - wasapi_* → coreaudio_* (mac-capture audio)
  // - monitor_capture → screen_capture (ScreenCaptureKit)
  // - game_capture has no Mac equivalent (no DX/Vulkan hook); we
  //   already filter it out via capabilities, but guard anyway.
  // wasapi_process_output_capture has no Mac equivalent — fall
  // back to system audio out.
  private mapSourceType(type: string): string {
    switch (type) {
      case 'wasapi_output_capture':
        // System loopback. CoreAudio has no built-in loopback;
        // ScreenCaptureKit-based source ships with mac-capture and
        // works without third-party drivers.
        return 'sck_audio_capture';
      case 'wasapi_input_capture':
        return 'coreaudio_input_capture';
      case 'wasapi_process_output_capture':
        // Per-app capture also via SCK. type=2 + bundle id, set in
        // Recorder.configureAudioSources.
        return 'sck_audio_capture';
      case 'monitor_capture':
        return 'screen_capture';
      default:
        return type;
    }
  }
  deleteSource(id: string): void {
    noobs.DeleteSource(id);
  }
  addSourceToScene(name: string): void {
    noobs.AddSourceToScene(name);
  }
  removeSourceFromScene(name: string): void {
    noobs.RemoveSourceFromScene(name);
  }
  getSourceSettings(id: string): ObsData {
    return noobs.GetSourceSettings(id);
  }
  setSourceSettings(id: string, settings: ObsData): void {
    noobs.SetSourceSettings(id, settings);
  }
  getSourceProperties(id: string): ObsProperty[] {
    return noobs.GetSourceProperties(id);
  }
  getSourcePos(id: string): SceneItemPosition & SourceDimensions {
    return noobs.GetSourcePos(id);
  }
  setSourcePos(id: string, pos: SceneItemPosition): void {
    noobs.SetSourcePos(id, pos);
  }
  setSourceVolume(id: string, volume: number): void {
    noobs.SetSourceVolume(id, volume);
  }
  setSourceAudioTracks(id: string, tracks: number): void {
    noobs.SetSourceAudioTracks(id, tracks);
  }

  // libobs's `selected` flag drives standard OBS UI selection
  // rendering. Our draw_callback already paints orange outlines +
  // corner handles for every scene item via setDrawSourceOutline,
  // so we don't need to track selection in libobs — EditorService
  // tracks `selectedName` JS-side and uses it for handle hit-tests.
  // Leaving these as no-ops avoids a round-trip to native on every
  // mousedown.
  setSceneItemSelected(_id: string, _selected: boolean): void {}
  clearSceneItemSelection(): void {}

  listSceneItems(): string[] {
    return noobs.ListSceneItems();
  }

  // Audio
  setVolmeterEnabled(enabled: boolean): void {
    noobs.SetVolmeterEnabled(enabled);
  }
  setForceMono(enabled: boolean): void {
    noobs.SetForceMono(enabled);
  }
  setAudioSuppression(enabled: boolean): void {
    noobs.SetAudioSuppression(enabled);
  }
  setMuteAudioInputs(muted: boolean): void {
    noobs.SetMuteAudioInputs(muted);
  }

  // Recording lifecycle
  startBuffer(): void {
    noobs.StartBuffer();
  }
  startRecording(offsetSeconds: number): void {
    noobs.StartRecording(offsetSeconds);
  }
  stopRecording(): void {
    noobs.StopRecording();
  }
  forceStopRecording(): void {
    noobs.ForceStopRecording();
  }
  getLastRecording(): string {
    return noobs.GetLastRecording();
  }
}
