// client/src/components/DataTable.jsx
export default function DataTable({
  columns,
  rows,
  gridCols,
  onRowClick,
  loading,
  emptyText = 'No records found.',
  renderRow,
}) {
  const template = gridCols || `repeat(${columns.length}, 1fr)`

  if (loading) return <div className="erp-table-empty">Loading…</div>
  if (!rows || rows.length === 0) {
    return <div className="erp-table-empty">{emptyText}</div>
  }

  return (
    <div className="erp-table-wrap">
      {/* Header */}
      <div className="erp-table-header" style={{ gridTemplateColumns: template }}>
        {columns.map(c => (
          <div key={c.key} className="erp-th" style={{ textAlign: c.align || 'left' }}>
            {c.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, i) =>
        renderRow ? (
          renderRow(row, i)
        ) : (
          <div
            key={row.id ?? row.sku_id ?? row.vbeln ?? i}
            className={`erp-table-row${i % 2 === 1 ? ' alt' : ''}${onRowClick ? ' clickable' : ''}`}
            style={{ gridTemplateColumns: template }}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map(c => (
              <div key={c.key} className="erp-td" style={{ textAlign: c.align || 'left' }}>
                {c.render ? c.render(row) : (row[c.key] ?? '—')}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
