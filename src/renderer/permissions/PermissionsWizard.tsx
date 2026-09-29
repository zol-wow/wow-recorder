import { Check } from 'lucide-react';
import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { Button } from '../components/Button/Button';
import { cn } from '../components/utils';
import { usePermissionsStatus } from './usePermissionsStatus';

interface IProps {
  language: Language;
}

/**
 * First-run mac permissions wizard. Blocks the app UI until Screen
 * Recording is granted. Accessibility is shown as a non-blocking
 * warning, as the app works without it.
 */
export default function PermissionsWizard(props: IProps) {
  const { language } = props;
  const { data: status } = usePermissionsStatus();

  // Show nothing until the first check returns, so the wizard doesn't
  // flash up on every launch.
  if (!status || status.screen === 'granted') return null;

  const accessibilityGranted = status.accessibility === 'granted';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 font-sans text-foreground">
      <div className="max-w-[540px] rounded-lg bg-card p-8 text-center">
        <h1 className="mb-4 text-2xl font-semibold">
          {getLocalePhrase(language, Phrase.PermissionsRequiredTitle)}
        </h1>
        <p className="mb-6 leading-relaxed">
          {getLocalePhrase(language, Phrase.PermissionsScreenRecordingText)}
        </p>

        <PermissionRow
          language={language}
          label={getLocalePhrase(
            language,
            Phrase.PermissionsScreenRecordingLabel,
          )}
          status={status.screen}
          onOpen={() => window.permissions.openSettingsFor('screen')}
        />
        <PermissionRow
          language={language}
          label={getLocalePhrase(
            language,
            Phrase.PermissionsAccessibilityLabel,
          )}
          status={status.accessibility}
          optional
          onOpen={() => window.permissions.openSettingsFor('accessibility')}
        />

        <p className="mt-6 text-sm opacity-80">
          {getLocalePhrase(language, Phrase.PermissionsRefreshText)}
        </p>

        {!accessibilityGranted && (
          <p className="mt-3 text-xs opacity-70">
            {getLocalePhrase(
              language,
              Phrase.PermissionsAccessibilityMissingText,
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function PermissionRow({
  language,
  label,
  status,
  optional,
  onOpen,
}: {
  language: Language;
  label: string;
  status: string;
  optional?: boolean;
  onOpen: () => void;
}) {
  const granted = status === 'granted';

  return (
    <div
      className={cn(
        'mb-2 flex items-center justify-between rounded-md border px-4 py-3',
        granted && 'border-success-border',
        !granted && optional && 'border-warning-border',
        !granted && !optional && 'border-error-border',
      )}
    >
      <span>{label}</span>
      <Button size="sm" variant="secondary" onClick={onOpen} disabled={granted}>
        {granted ? (
          <>
            {getLocalePhrase(language, Phrase.PermissionGranted)}
            <Check size={16} className="ml-1 inline-flex" />
          </>
        ) : (
          getLocalePhrase(language, Phrase.PermissionOpenSettings)
        )}
      </Button>
    </div>
  );
}
