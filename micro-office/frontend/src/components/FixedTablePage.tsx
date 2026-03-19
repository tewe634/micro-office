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
    <div className="fixed-table-page">
      {top ? <div className="fixed-table-page__section">{top}</div> : null}
      {actions ? <div className="fixed-table-page__section">{actions}</div> : null}

      <div className="fixed-table-page__frame">
        <div className="fixed-table-page__table">{table}</div>
        {pagination ? <div className="fixed-table-page__footer">{pagination}</div> : null}
      </div>
    </div>
  );
}
