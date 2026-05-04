import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'

function useBodyTypes() {
  const [bodyTypes, setBodyTypes] = useState([])
  useEffect(() => {
    db.inventory().from('body_types').select('name')
      .then(({ data, error }) => {
        if (error) console.error('Failed to load body types:', error.message)
        setBodyTypes(data?.map(r => r.name) || [])
      })
  }, [])
  return bodyTypes
}

function EditModal({ customer, onClose, onSaved }) {
  const showToast = useToast()
  const bodyTypes = useBodyTypes()
  const [form, setForm] = useState({
    name: customer.name || '',
    number: customer.number || '',
    email: customer.email || '',
    address: customer.address || '',
    gstin: customer.gstin || '',
    dob: customer.dob || '',
    anniversary: customer.anniversary || '',
    notes: customer.notes || '',
    body_type: customer.body_type || '',
    status: customer.status || 'Active',
  })

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function save() {
    if (!form.name.trim()) return showToast('Name is required', 'error')
    const { error } = await db.customers().from('kna1').update({
      name: form.name, number: form.number, address: form.address,
      email: form.email, gstin: form.gstin, dob: form.dob || null,
      anniversary: form.anniversary || null, notes: form.notes || null,
      body_type: form.body_type || null
    }).eq('kunnr', customer.kunnr)
    if (error) { showToast(`❌ ${error.message}`, 'error'); return }
    showToast(`✅ ${form.name} updated!`)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-title">Edit Customer</div>
        <div className="modal-sub">Editing KUNNR: {customer.kunnr}</div>
        <div className="modal-grid">
          <div className="form-group">
            <label>Full Name</label>
            <input value={form.name} onChange={set('name')} placeholder="Customer name" />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input value={form.number} onChange={set('number')} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email} onChange={set('email')} placeholder="customer@email.com" type="email" />
          </div>
          <div className="form-group">
            <label>GSTIN</label>
            <input value={form.gstin} onChange={set('gstin')} placeholder="GST number" />
          </div>
          <div className="form-group">
            <label>Date of Birth</label>
            <input value={form.dob} onChange={set('dob')} type="date" />
          </div>
          <div className="form-group">
            <label>Anniversary</label>
            <input value={form.anniversary} onChange={set('anniversary')} type="date" />
          </div>
          <div className="form-group">
            <label>Body Type</label>
            <select value={form.body_type} onChange={set('body_type')}>
              <option value="">Select body type…</option>
              {bodyTypes.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={set('status')}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="form-group full">
            <label>Address</label>
            <input value={form.address} onChange={set('address')} placeholder="Street, City, State" />
          </div>
          <div className="form-group full">
            <label>Notes / Tags</label>
            <input value={form.notes} onChange={set('notes')} placeholder="e.g. VIP, prefers casual…" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

function AddTab({ onAdded }) {
  const showToast = useToast()
  const bodyTypes = useBodyTypes()
  const [nextKunnr, setNextKunnr] = useState('—')
  const [form, setForm] = useState({
    name: '', number: '', email: '', address: '', gstin: '', dob: '', anniversary: '', notes: '', body_type: '',
  })

  const loadNextKunnr = useCallback(async () => {
    const { data, error } = await db.customers().from('kna1').select('kunnr').order('kunnr', { ascending: false }).limit(1)
    if (error) {
      console.error('Failed to load next KUNNR:', error.message)
      // Fall back to a timestamp-based ID to avoid collision
      setNextKunnr(String(Date.now()).slice(-6))
      return
    }
    const maxNum = data?.[0] ? parseInt(data[0].kunnr) : 99999
    const nextKunnr = String(maxNum + 1).padStart(6, '0')
    setNextKunnr(nextKunnr)
  }, [])

  useEffect(() => { loadNextKunnr() }, [loadNextKunnr])

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  function reset() {
    setForm({ name: '', number: '', email: '', address: '', gstin: '', dob: '', anniversary: '', notes: '', body_type: '' })
    loadNextKunnr()
  }

  async function addCustomer() {
    if (!form.name.trim()) return showToast('Name is required', 'error')
    const { error } = await db.customers().from('kna1').insert({
      kunnr: nextKunnr, name: form.name, number: form.number,
      address: form.address, email: form.email, gstin: form.gstin,
      dob: form.dob || null, anniversary: form.anniversary || null,
      notes: form.notes || null, status: 'Active',
      body_type: form.body_type || null
    })
    if (error) { showToast(`❌ ${error.message}`, 'error'); return }
    showToast(`✅ ${form.name} added! KUNNR: ${nextKunnr}`)
    reset()
    onAdded()
  }

  return (
    <>
      <h1 className="page-title">Add Customer</h1>
      <p className="page-sub">Fill in the details — a KUNNR will be assigned automatically.</p>
      <div className="card">
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <label>Auto-Assigned KUNNR</label>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="id-badge">{nextKunnr}</div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Assigned automatically on save</span>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Full Name *</label>
            <input value={form.name} onChange={set('name')} placeholder="Customer name" />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input value={form.number} onChange={set('number')} placeholder="+91 98765 43210" type="tel" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email} onChange={set('email')} placeholder="customer@email.com" type="email" />
          </div>
          <div className="form-group">
            <label>GSTIN</label>
            <input value={form.gstin} onChange={set('gstin')} placeholder="GST number (optional)" />
          </div>
          <div className="form-group">
            <label>Date of Birth</label>
            <input value={form.dob} onChange={set('dob')} type="date" />
          </div>
          <div className="form-group">
            <label>Anniversary</label>
            <input value={form.anniversary} onChange={set('anniversary')} type="date" />
          </div>
          <div className="form-group">
            <label>Body Type</label>
            <select value={form.body_type} onChange={set('body_type')}>
              <option value="">Select body type…</option>
              {bodyTypes.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="form-group full">
            <label>Address</label>
            <input value={form.address} onChange={set('address')} placeholder="Street, City, State" />
          </div>
          <div className="form-group full">
            <label>Notes / Tags</label>
            <input value={form.notes} onChange={set('notes')} placeholder="e.g. VIP, prefers casual, allergic to wool…" />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={addCustomer}>Add Customer</button>
          <button className="btn btn-ghost" onClick={reset}>Clear</button>
        </div>
      </div>
    </>
  )
}

function ViewTab() {
  const showToast = useToast()
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db.customers().from('kna1').select('*').order('kunnr')
      if (error) {
        showToast('❌ ' + error.message, 'error')
      } else {
        setAllData(data)
      }
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  async function updateStatus(kunnr, name, status) {
    const { error } = await db.customers().from('kna1').update({ status }).eq('kunnr', kunnr)
    if (error) showToast(`❌ ${error.message}`, 'error')
    else { showToast(`✅ ${name} status set to ${status}`); loadData() }
  }

  function downloadCSV() {
    if (!allData.length) return
    const headers = ['KUNNR', 'Name', 'Phone', 'Email', 'Address', 'GSTIN', 'DOB', 'Anniversary', 'Body Type', 'Notes']
    const rows = allData.map(r => [
      r.kunnr, r.name, r.number, r.email, r.address, r.gstin, r.dob, r.anniversary, r.body_type, r.notes,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = query
    ? allData.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(query.toLowerCase())))
    : allData

  return (
    <>
      <h1 className="page-title">All Customers</h1>
      <p className="page-sub">Live customer records from the database.</p>

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input placeholder="Search by name, KUNNR, email…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={loadData}>↺ Refresh</button>
        <button className="btn btn-ghost" onClick={downloadCSV}>⬇ Download CSV</button>
      </div>

      <div className="stats">
        <div className="stat-pill">Total Customers <strong>{allData.length}</strong></div>
        {query && <div className="stat-pill">Showing <strong>{filtered.length}</strong></div>}
      </div>

      <div className="table-card" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>KUNNR</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>GSTIN</th><th>DOB</th><th>Anniversary</th><th>Body Type</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={11}><span className="spinner" /> Loading customers…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={11}>No customers found.</td></tr>
            ) : filtered.map(row => (
              <tr key={row.kunnr}>
                <td>
                  <Link to={`/customers/${row.kunnr}`} className="table-link mono">
                    {row.kunnr || '—'}
                  </Link>
                </td>
                <td>
                  <Link to={`/customers/${row.kunnr}`} className="table-link">
                    <strong>{row.name || '—'}</strong>
                  </Link>
                </td>
                <td>{row.number || '—'}</td>
                <td>{row.email || '—'}</td>
                <td>{row.address || '—'}</td>
                <td>{row.gstin || '—'}</td>
                <td style={{ fontSize: 12 }}>{row.dob || '—'}</td>
                <td style={{ fontSize: 12 }}>{row.anniversary || '—'}</td>
                <td style={{ fontSize: 12 }}>{row.body_type || '—'}</td>
                <td>
                  <span className={`badge badge-${row.status === 'Credit Hold' ? 'partial' : row.status === 'Blacklisted' || row.status === 'Duplicate/Deleted' ? 'cancelled' : 'paid'}`}>
                    {row.status || 'Active'}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <button className="action-btn btn-edit" onClick={() => setEditingCustomer(row)}>Edit</button>
                    <select
                      className="action-btn"
                      value=""
                      onChange={e => { if (e.target.value) updateStatus(row.kunnr, row.name, e.target.value) }}
                      style={{ cursor: 'pointer', padding: '4px 6px', fontSize: 12 }}
                    >
                      <option value="">Status ▾</option>
                      <option value="Active">Active</option>
                      <option value="Credit Hold">Credit Hold</option>
                      <option value="Blacklisted">Blacklisted</option>
                      <option value="Duplicate/Deleted">Duplicate/Deleted</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCustomer && (
        <EditModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={loadData}
        />
      )}
    </>
  )
}

function UploadTab() {
  const showToast = useToast()
  const [dragging, setDragging] = useState(false)
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [uploading, setUploading] = useState(false)
  const dropRef = useRef(null)

  function addLog(msg, type = 'info') {
    setLogs(l => [...l, { msg, type, ts: Date.now() }])
  }

  function downloadTemplate() {
    const tsv = 'name\tnumber\temail\taddress\tgstin\tdob\tanniversary\tnotes\nJohn Doe\t9876543210\tjohn@example.com\t123 Main St\t\t\t\t'
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customers_template.tsv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function processFile(file) {
    if (!file) return
    setLogs([])
    setSummary(null)
    setUploading(true)
    addLog(`📂 Reading: ${file.name}`)

    const text = await file.text()
    const sep = file.name.endsWith('.tsv') || text.includes('\t') ? '\t' : ','
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) {
      addLog('❌ File must have a header + at least one data row.', 'error')
      setUploading(false)
      return
    }

    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase())
    const rows = lines.slice(1)
    addLog(`✅ Found ${rows.length} rows, ${headers.length} columns`)

    let ok = 0, fail = 0
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].split(sep)
      const obj = {}
      headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim() })
      if (!obj.name) {
        addLog(`Row ${i + 2}: ⚠️ Skipped — missing name`, 'warn')
        fail++
        continue
      }
      try {
        const { data: kunnrData, error: kunnrError } = await db.customers().from('kna1').select('kunnr').order('kunnr', { ascending: false }).limit(1)
        if (kunnrError) {
          console.error('Failed to load next KUNNR:', kunnrError.message)
          addLog(`Row ${i + 2}: ❌ ${obj.name} — could not determine next KUNNR: ${kunnrError.message}`, 'error')
          fail++
          continue
        }
        const maxNum = kunnrData?.[0] ? parseInt(kunnrData[0].kunnr) : 99999
        const newKunnr = String(maxNum + 1).padStart(6, '0')
        const { error } = await db.customers().from('kna1').insert({
          kunnr: newKunnr, name: obj.name, number: obj.number || null,
          address: obj.address || null, email: obj.email || null, gstin: obj.gstin || null,
          dob: obj.dob || null, anniversary: obj.anniversary || null,
          notes: obj.notes || null, status: 'Active', body_type: obj.body_type || null
        })
        if (error) throw new Error(error.message)
        addLog(`Row ${i + 2}: ✅ Added ${obj.name} (${newKunnr})`, 'success')
        ok++
      } catch (err) {
        addLog(`Row ${i + 2}: ❌ ${obj.name} — ${err.message}`, 'error')
        fail++
      }
    }

    setSummary({ ok, fail, total: rows.length })
    setUploading(false)
    showToast(`Upload complete: ${ok} added, ${fail} failed`)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function onFileChange(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  return (
    <>
      <h1 className="page-title">Mass Upload</h1>
      <p className="page-sub">Upload a TSV or CSV file to add customers in bulk.</p>

      <div className="card">
        <div
          ref={dropRef}
          className={`drop-zone${dragging ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('cu-file-input').click()}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'var(--card-hover, rgba(0,0,0,0.03))' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📥</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop your TSV / CSV here</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>or click to browse</div>
          <input id="cu-file-input" type="file" accept=".tsv,.csv,.txt" style={{ display: 'none' }} onChange={onFileChange} />
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={downloadTemplate}>⬇ Download Template</button>
        </div>

        {summary && (
          <div style={{
            marginTop: 20,
            padding: '12px 16px',
            borderRadius: 8,
            background: summary.fail === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
            border: `1px solid ${summary.fail === 0 ? '#22c55e' : '#eab308'}`,
          }}>
            <strong>Upload Complete:</strong> {summary.ok} added, {summary.fail} failed out of {summary.total} rows
          </div>
        )}

        {logs.length > 0 && (
          <div style={{
            marginTop: 16,
            background: '#0f1117',
            borderRadius: 8,
            padding: '12px 16px',
            maxHeight: 260,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: 12,
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{
                color: log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fbbf24' : log.type === 'success' ? '#4ade80' : '#94a3b8',
                marginBottom: 2,
              }}>
                {log.msg}
              </div>
            ))}
            {uploading && <div style={{ color: '#60a5fa', marginTop: 4 }}>⏳ Processing…</div>}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Groups helpers (merged from Groups module) ───────────────────────────────
function useGroups() {
  const [groups, setGroups] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.groups().from('customer_groups').select('*').order('name')
      if (error) { console.error('Failed to load groups:', error.message); return }
      setGroups(data || [])
    } catch (err) { console.error('Failed to load groups:', err.message) }
  }, [])
  useEffect(() => { load() }, [load])
  return [groups, load]
}

function useGroupCustomerSearch() {
  const [results, setResults] = useState([])
  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return }
    try {
      const { data } = await db.customers().from('kna1').select('kunnr, name, number')
        .or(`name.ilike.%${q}%,number.ilike.%${q}%`).limit(10)
      setResults(data || [])
    } catch (err) { console.error('Failed to search customers:', err.message) }
  }, [])
  return [results, search, () => setResults([])]
}

function GroupCard({ group, onRefresh, showToast }) {
  const [expanded,  setExpanded]  = useState(false)
  const [members,   setMembers]   = useState([])
  const [editing,   setEditing]   = useState(false)
  const [editName,  setEditName]  = useState(group.name)
  const [editNotes, setEditNotes] = useState(group.notes || '')
  const [addQ,      setAddQ]      = useState('')
  const [results,   search, clearResults] = useGroupCustomerSearch()

  const loadMembers = useCallback(async () => {
    try {
      const { data, error } = await db.groups().from('group_members').select('kunnr').eq('group_id', group.group_id)
      if (error) { console.error('Failed to load group members:', error.message); return }
      const kunnrs = data?.map(m => m.kunnr) || []
      const { data: custs, error: custsError } = kunnrs.length
        ? await db.customers().from('kna1').select('kunnr, name, number').in('kunnr', kunnrs)
        : { data: [] }
      if (custsError) { console.error('Failed to load member customers:', custsError.message); return }
      setMembers(custs || [])
    } catch (err) { console.error('Failed to load group members:', err.message) }
  }, [group.group_id])

  useEffect(() => { if (expanded) loadMembers() }, [expanded, loadMembers])

  async function removeMember(kunnr) {
    const { error } = await db.groups().from('group_members').delete().eq('group_id', group.group_id).eq('kunnr', kunnr)
    if (error) { showToast(error.message, 'error'); return }
    loadMembers(); onRefresh()
  }

  async function addMember(kunnr) {
    const { error } = await db.groups().from('group_members').insert({ group_id: group.group_id, kunnr })
    if (error) { showToast(error.message, 'error'); return }
    setAddQ(''); clearResults(); loadMembers(); onRefresh()
  }

  async function saveEdit() {
    if (!editName.trim()) return
    const { error } = await db.groups().from('customer_groups').update({ name: editName.trim(), notes: editNotes.trim() || null }).eq('group_id', group.group_id)
    if (error) { showToast(error.message, 'error'); return }
    setEditing(false); onRefresh(); showToast('Group updated', 'success')
  }

  async function deleteGroup() {
    if (!window.confirm(`Delete "${group.name}" and remove all its members?`)) return
    const { error } = await db.groups().from('customer_groups').delete().eq('group_id', group.group_id)
    if (error) { showToast(error.message, 'error'); return }
    onRefresh(); showToast('Group deleted', 'success')
  }

  const avatarColors = ['#dbeafe','#dcfce7','#fef9c3','#fce7f3','#e0e7ff','#ffedd5']
  const avatarColor  = (kunnr) => avatarColors[parseInt(kunnr) % avatarColors.length]

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: expanded ? '1px solid var(--border)' : 'none',
        cursor: 'pointer',
      }} onClick={() => { setExpanded(e => !e); setEditing(false) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>👥</span>
          {editing ? (
            <input value={editName} onChange={e => setEditName(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 15, fontWeight: 700, width: 200, padding: '4px 8px' }} autoFocus />
          ) : (
            <span style={{ fontWeight: 700, fontSize: 15 }}>{group.name}</span>
          )}
          <span style={{ background: 'var(--accent2)', color: '#92650a', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
            {group.member_count} member{group.member_count !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          {editing ? (
            <>
              <button className="action-btn btn-edit" onClick={saveEdit}>Save</button>
              <button className="action-btn btn-ghost" onClick={() => { setEditing(false); setEditName(group.name); setEditNotes(group.notes||'') }}>Cancel</button>
            </>
          ) : (
            <>
              <button className="action-btn btn-edit" onClick={() => { setExpanded(true); setEditing(true) }}>Edit</button>
              <button className="action-btn btn-delete" onClick={deleteGroup}>Delete</button>
            </>
          )}
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {editing && (
            <div>
              <label>Notes</label>
              <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                placeholder="Optional notes about this group" style={{ width: '100%', marginTop: 6 }} />
            </div>
          )}
          {members.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No members yet — add some below.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => (
                <div key={m.kunnr} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: avatarColor(m.kunnr),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, flexShrink: 0,
                    }}>{(m.name || m.kunnr).charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.number || ''}</div>
                    </div>
                    <span className="mono">{m.kunnr}</span>
                  </div>
                  <button onClick={() => removeMember(m.kunnr)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, padding: '0 4px' }}
                    title="Remove from group">✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={addQ} onChange={e => { setAddQ(e.target.value); search(e.target.value) }}
                placeholder="Search customer to add…" style={{ flex: 1 }} />
              <button className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 13 }}
                onClick={() => { setAddQ(''); clearResults() }}>Clear</button>
            </div>
            {results.length > 0 && (
              <div className="search-results" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50 }}>
                {results.filter(r => !members.find(m => m.kunnr === r.kunnr)).map(r => (
                  <div key={r.kunnr} className="search-result-item" onClick={() => addMember(r.kunnr)}>
                    <div className="sri-name">{r.name}</div>
                    <div className="sri-detail"><span className="sri-kunnr">{r.kunnr}</span> · {r.number || ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!editing && group.notes && (
            <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{group.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

function NewGroupTab({ onCreated, showToast }) {
  const [name,   setName]   = useState('')
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const { error } = await db.groups().from('customer_groups')
        .insert({ group_id: crypto.randomUUID().slice(0, 8), name: name.trim(), notes: notes.trim() || null })
      if (error) { showToast(error.message, 'error'); return }
      setName(''); setNotes(''); onCreated(); showToast(`Group "${name.trim()}" created`, 'success')
    } finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>New Group</h2>
      <p className="page-sub">Create a friend or social circle group</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="form-group">
          <label>Group Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office Gang, College Friends" />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional description" />
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ViewGroupsTab({ showToast }) {
  const [groups, reload] = useGroups()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Customer Groups</h1>
          <p className="page-sub">Group friends to avoid selling identical designs to the same circle</p>
        </div>
        <div className="stat-pill">
          <strong>{groups.length}</strong> group{groups.length !== 1 ? 's' : ''}
        </div>
      </div>
      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>No groups yet — create one using the button above</p>
        </div>
      ) : (
        groups.map(g => (
          <GroupCard key={g.group_id} group={g} onRefresh={reload} showToast={showToast} />
        ))
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const CUST_TABS = [
  { id: 'view',   label: 'Customers' },
  { id: 'add',    label: 'Add Customer' },
  { id: 'upload', label: 'Mass Upload' },
  { id: 'groups', label: 'Customer Groups' },
]

const BREADCRUMBS = {
  view: 'All Customers', add: 'Add Customer', upload: 'Mass Upload', groups: 'Customer Groups',
}

export default function Customers() {
  const showToast = useToast()
  const [tab, setTab] = useState('view')
  const [groupSubView, setGroupSubView] = useState('list') // 'list' | 'new'
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ total: '—', withMeasurements: '—', groups: '—', members: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const [{ count: total }, { count: withM }, { count: gCount }, { count: mCount }] = await Promise.all([
          db.customers().from('kna1').select('*', { count: 'exact', head: true }),
          db.customers().from('customer_measurements').select('kunnr', { count: 'exact', head: true }),
          db.groups().from('customer_groups').select('*', { count: 'exact', head: true }),
          db.groups().from('group_members').select('*', { count: 'exact', head: true }),
        ])
        setStats({ total: total ?? 0, withMeasurements: withM ?? 0, groups: gCount ?? 0, members: mCount ?? 0 })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [refreshKey])

  function handleTabChange(t) {
    setTab(t)
    if (t !== 'groups') setGroupSubView('list')
    if (t === 'view') setRefreshKey(k => k + 1)
  }

  function goToView() {
    setTab('view')
    setRefreshKey(k => k + 1)
  }

  const breadcrumb = tab === 'groups' && groupSubView === 'new'
    ? 'New Group'
    : BREADCRUMBS[tab]

  const action = tab === 'groups'
    ? groupSubView === 'list'
      ? (
        <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => setGroupSubView('new')}>
          + New Group
        </button>
      )
      : null
    : tab !== 'add'
    ? (
      <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
        onClick={() => setTab('add')}>
        + Add Customer
      </button>
    )
    : null

  return (
    <ERPLayout>
      <ModuleHeader moduleLabel="CUSTOMERS" breadcrumb={breadcrumb} action={action} />
      <ModuleTabs tabs={CUST_TABS} activeTab={tab} onChange={handleTabChange} />
      <StatsStrip stats={
        tab === 'groups'
          ? [{ value: stats.groups, label: 'Groups' }, { value: stats.members, label: 'Total Members' }]
          : [{ value: stats.total, label: 'Customers' }, { value: stats.withMeasurements, label: 'With Measurements' }]
      } />
      <div className="erp-content">
        {tab === 'add'    && <AddTab onAdded={goToView} />}
        {tab === 'view'   && <ViewTab key={refreshKey} />}
        {tab === 'upload' && <UploadTab />}
        {tab === 'groups' && groupSubView === 'list' && (
          <ViewGroupsTab showToast={showToast} />
        )}
        {tab === 'groups' && groupSubView === 'new' && (
          <NewGroupTab showToast={showToast} onCreated={() => { setGroupSubView('list'); setRefreshKey(k => k + 1) }} />
        )}
      </div>
    </ERPLayout>
  )
}
