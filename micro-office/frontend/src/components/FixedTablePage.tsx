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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 12 }}>
      {top ? <div style={{ flex: '0 0 auto' }}>{top}</div> : null}
      {actions ? <div style={{ flex: '0 0 auto' }}>{actions}</div> : null}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, padding: 12, overflow: 'hidden' }}>{table}</div>
      </div>
      {pagination ? (
        <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>{pagination}</div>
      ) : null}
    </div>
  );
}
