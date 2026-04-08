import Sidebar from '../components/Sidebar'
export default function HR() {
  return (
    <div className="page-layout">
      <Sidebar section="HR" activeTab="add" onTabChange={() => {}} />
      <div className="main"><h1 className="page-title">HR</h1><p className="page-sub">Coming soon…</p></div>
    </div>
  )
}
