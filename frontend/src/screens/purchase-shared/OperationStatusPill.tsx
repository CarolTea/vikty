import { useTranslation } from 'react-i18next';
import { StatusPill } from '../../components';
import { statusTone } from './status';
import { NS, type OperationStatus } from './types';

export function OperationStatusPill({ status }: { status: OperationStatus }) {
  const { t } = useTranslation(NS);
  return (
    <StatusPill tone={statusTone(status)} live>
      {t(`status.${status}`)}
    </StatusPill>
  );
}
