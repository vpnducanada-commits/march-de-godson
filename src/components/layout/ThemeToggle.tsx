import { Icon } from '../Icon';
import { useTheme } from '../../hooks/useTheme';

/**
 * Bascule clair/sombre. Le choix est persisté (localStorage) et synchronisé
 * sur tous les composants via useSyncExternalStore ; le premier rendu est
 * déjà au bon thème (script inline index.html — aucun flash).
 */
export function ThemeToggle({ label }: { label?: boolean }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'clair' : 'sombre';

  if (label) {
    return (
      <button type="button" className="dropdown__item" onClick={toggle}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        Thème {next}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`Passer au thème ${next}`}
      onClick={toggle}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
    </button>
  );
}
