import { useQuery } from '@tanstack/react-query';
import type { PermissionsSnapshot } from 'main/platform/permissions/IPermissionsGate';

/**
 * Polls permission status every 2 seconds while the window is focused,
 * until Screen Recording is granted. macOS sends no event when the user
 * grants a permission in System Settings, so polling is the only way to
 * notice.
 */
export function usePermissionsStatus() {
  return useQuery<PermissionsSnapshot>({
    queryKey: ['permissions'],
    queryFn: () => window.permissions.snapshot(),
    refetchInterval: (query) =>
      query.state.data?.screen === 'granted' ? false : 2000,
    refetchIntervalInBackground: false,
  });
}
