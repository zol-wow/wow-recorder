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
const OUTPUT_AUDIO = 'wasapi_output_capture';
const PROCESS_AUDIO = 'wasapi_process_output_capture';

// ScreenCaptureAudioStreamType in mac-capture.
const SCK_DESKTOP_AUDIO = 0;
const SCK_APPLICATION_AUDIO = 1;

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

  /**
   * The Windows source type each source was created as. Callers keep
   * using Windows types and settings; we translate at this boundary.
   */
  private sourceTypes = new Map<string, string>();

  createSource(id: string, type: string): string {
    const name = noobs.CreateSource(id, MacNoobsBackend.mapSourceType(type));
    this.sourceTypes.set(name, type);

    if (type === OUTPUT_AUDIO || type === PROCESS_AUDIO) {
      const settings = noobs.GetSourceSettings(name);
      noobs.SetSourceSettings(name, this.toMacSettings(name, settings));
    }

    return name;
  }

  // Windows source ids → Mac equivalents.
  // - Desktop and per-app audio both use ScreenCaptureKit, which needs
  //   no loopback driver on macOS 13+.
  // - Monitor and window capture both use ScreenCaptureKit too, the
  //   legacy mac-capture sources are deprecated.
  // - game_capture has no Mac equivalent (no DX/Vulkan hook); it's
  //   filtered out via capabilities.
  private static mapSourceType(type: string): string {
    switch (type) {
      case OUTPUT_AUDIO:
      case PROCESS_AUDIO:
        return 'sck_audio_capture';
      case 'wasapi_input_capture':
        return 'coreaudio_input_capture';
      case 'monitor_capture':
      case 'window_capture':
        return 'screen_capture';
      default:
        return type;
    }
  }

  /**
   * Windows audio settings to ScreenCaptureKit ones. Desktop audio has
   * no device to pick. Per-app audio targets a bundle id, which callers
   * pass in the Windows `window` setting.
   */
  private toMacSettings(name: string, settings: ObsData): ObsData {
    switch (this.sourceTypes.get(name)) {
      case OUTPUT_AUDIO:
        return { ...settings, type: SCK_DESKTOP_AUDIO };
      case PROCESS_AUDIO:
        return {
          ...settings,
          type: SCK_APPLICATION_AUDIO,
          application: settings.window ?? settings.application ?? '',
        };
      default:
        return settings;
    }
  }

  deleteSource(id: string): void {
    noobs.DeleteSource(id);
    this.sourceTypes.delete(id);
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
    noobs.SetSourceSettings(id, this.toMacSettings(id, settings));
  }
  getSourceProperties(id: string): ObsProperty[] {
    const properties = noobs.GetSourceProperties(id);

    switch (this.sourceTypes.get(id)) {
      case OUTPUT_AUDIO:
        // Present desktop audio as a single default device, like WASAPI.
        return [
          {
            name: 'device_id',
            description: 'Device',
            type: 'list',
            enabled: true,
            visible: true,
            combo_type: 'list',
            combo_format: 'string',
            items: [{ name: 'Default', value: 'default', disabled: false }],
          },
        ];
      case PROCESS_AUDIO:
        // The app list stands in for the Windows window list.
        return properties.map((p) =>
          p.name === 'application' ? { ...p, name: 'window' } : p,
        );
      default:
        return properties;
    }
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
