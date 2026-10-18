import type { ReactNode } from 'react';
import { Icon } from '../Icon';

export function EmptyState({
  icon = 'inbox',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon name={icon} size={28} />
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {message && <p className="empty-state__msg">{message}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
