import { useQuery } from '@tanstack/react-query';
import type { RecorderCapabilities } from 'main/platform/recorder/IRecorderBackend';
import { CaptureModeCapability } from 'main/platform/recorder/IRecorderBackend';

// Superset of all capture modes across platforms. Shown while the IPC
// resolves so the options aren't briefly missing.
const FALLBACK: RecorderCapabilities = {
  captureModes: [
    CaptureModeCapability.GAME,
    CaptureModeCapability.WINDOW,
    CaptureModeCapability.MONITOR,
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
