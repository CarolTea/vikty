import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';

export interface AppHeaderProps {
  /** Shortened wallet address; when present the connect button is replaced by it. */
  address?: string;
  onConnect?: () => void;
}

export function AppHeader({ address, onConnect }: AppHeaderProps) {
  const { t } = useTranslation('discovery');
  const { t: tc } = useTranslation('common');
  return (
    <header className="vt-glass vt-header">
      <div className="vt-brand">
        <span className="vt-wordmark">{tc('appName')}</span>
        <span className="vt-tagline">{tc('tagline')}</span>
      </div>
      <div className="vt-header-actions">
        <button type="button" className="vt-network" aria-label={t('header.networkLabel')}>
          <span className="vt-network-dot" aria-hidden="true" />
          {t('header.network')}
          <Icon name="chevron-down" size={16} />
        </button>
        {address ? (
          <span className="vt-address">{address}</span>
        ) : (
          <Button variant="primary" onClick={onConnect}>{t('header.connect')}</Button>
        )}
      </div>
    </header>
  );
}
