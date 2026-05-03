// client/src/components/CardList.jsx
export default function CardList({
  items,
  renderCard,
  onCardClick,
  loading,
  emptyText = 'No records found.',
}) {
  if (loading) return <div className="erp-card-list-empty">Loading…</div>
  if (!items || items.length === 0) {
    return <div className="erp-card-list-empty">{emptyText}</div>
  }

  return (
    <div className="erp-card-list">
      {items.map((item, i) => (
        <div
          key={item.id ?? item.sku_id ?? item.vbeln ?? i}
          className="erp-card-item"
          onClick={onCardClick ? () => onCardClick(item) : undefined}
          style={onCardClick ? { cursor: 'pointer' } : undefined}
        >
          {renderCard(item)}
        </div>
      ))}
    </div>
  )
}
