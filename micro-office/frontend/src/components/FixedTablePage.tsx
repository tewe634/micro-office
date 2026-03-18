import type { ReactNode } from 'react';

export default function FixedTablePage({
  top,
  actions,
  table,
  pagination,
}: {
  top?: ReactNode;
  actions?: ReactNode;
  table: ReactNode;
  pagination?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {top ? <div style={{ flex: '0 0 auto' }}>{top}</div> : null}
      {actions ? <div style={{ flex: '0 0 auto' }}>{actions}</div> : null}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', borderRadius: 8 }}>
        <div style={{ padding: 12 }}>{table}</div>
      </div>
      {pagination ? (
        <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'flex-end' }}>{pagination}</div>
      ) : null}
    </div>
  );
}
