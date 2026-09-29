import { useQuery } from '@tanstack/react-query';
import type { RecorderCapabilities } from 'main/platform/recorder/IRecorderBackend';
import { CaptureModeCapability } from 'main/platform/recorder/IRecorderBackend';
import { ESupportedEncoders } from 'main/obsEnums';

// Superset of all encoders we may surface across platforms — the
// real backend filters down to its supported set. Shown while the IPC
// resolves so the dropdown isn't briefly missing options.
const FALLBACK: RecorderCapabilities = {
  captureModes: [
    CaptureModeCapability.GAME,
    CaptureModeCapability.WINDOW,
    CaptureModeCapability.MONITOR,
  ],
  encoders: [
    ESupportedEncoders.OBS_X264,
    ESupportedEncoders.AMD_H264,
    ESupportedEncoders.AMD_AV1,
    ESupportedEncoders.NVENC_H264,
    ESupportedEncoders.NVENC_AV1,
    ESupportedEncoders.QSV_H264,
    ESupportedEncoders.QSV_AV1,
    ESupportedEncoders.VT_H264,
    ESupportedEncoders.VT_HEVC,
  ],
};

/**
 * Read recorder-backend capabilities once — they are constant for a
 * given platform + app version, so staleTime is effectively infinite.
 * Returns FALLBACK until the IPC resolves. It's placeholder data rather
 * than initial data, as initial data counts as fresh and would stop
 * the query from ever running.
 */
export function useRecorderCapabilities(): RecorderCapabilities {
  const { data } = useQuery<RecorderCapabilities>({
    queryKey: ['recorder-capabilities'],
    queryFn: () => window.recorderCapabilities.get(),
    staleTime: Infinity,
    placeholderData: FALLBACK,
  });
  return data ?? FALLBACK;
}
