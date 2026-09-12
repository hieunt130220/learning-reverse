import type { ReactNode } from 'react';

export type StatusBannerTone = 'info' | 'success' | 'warn' | 'error';

export function StatusBanner({
  tone,
  children,
  action,
}: {
  tone: StatusBannerTone;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`status-banner status-banner--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="status-banner-text">{children}</div>
      {action}
    </div>
  );
}
