// client/src/components/ModuleTabs.jsx
export default function ModuleTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="erp-tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`erp-tab${activeTab === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
