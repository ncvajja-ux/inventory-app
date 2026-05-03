import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'

const SALARY_DAYS = Array.from({length: 28}, (_, i) => i + 1)
const PAY_MODES = ['cash', 'bank']
const PAYMENT_TYPES = ['salary', 'advance', 'bonus', 'deduction']
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

function maskAadhar(v) {
  if (!v || v.length < 4) return v
  return 'XXXX XXXX ' + v.slice(-4)
}

// ─── Employee Form (shared by Add + Edit) ────────────────────────────────────
function EmployeeForm({ initial = {}, onSubmit, onCancel, submitLabel = 'Save', departments = [], designations = [] }) {
  const showToast = useToast()
  const [form, setForm] = useState({
    name: '', pan: '', aadhar: '', salary: '', start_date: '', end_date: '',
    pay_mode: 'cash', salary_day: '', department: '', designation: '', phone: '', address: '',
    ...initial,
  })

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }
  function setPan(e) { setForm(f => ({ ...f, pan: e.target.value.toUpperCase() })) }

  function validate() {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return false }
    if (!form.start_date)  { showToast('Start date is required', 'error'); return false }
    if (form.pan && !PAN_RE.test(form.pan)) { showToast('PAN must be format AAAAA9999A (e.g. ABCDE1234F)', 'error'); return false }
    if (form.aadhar && !/^\d{12}$/.test(form.aadhar)) { showToast('Aadhar must be exactly 12 digits', 'error'); return false }
    if (form.end_date && form.start_date && form.end_date < form.start_date) { showToast('End date must be on or after start date', 'error'); return false }
    return true
  }

  return (
    <div className="card">
      <div className="form-grid">
        <div className="form-group">
          <label>Full Name *</label>
          <input value={form.name} onChange={set('name')} placeholder="Employee name" />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" type="tel" />
        </div>
        <div className="form-group">
          <label>PAN</label>
          <input value={form.pan} onChange={setPan} placeholder="ABCDE1234F" maxLength={10}
            style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} />
        </div>
        <div className="form-group">
          <label>Aadhar Number</label>
          <input value={form.aadhar} onChange={set('aadhar')} placeholder="12-digit number" maxLength={12}
            style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} />
        </div>
        <div className="form-group">
          <label>Monthly Salary (₹)</label>
          <input value={form.salary} onChange={set('salary')} placeholder="0.00" type="number" min="0" step="0.01" />
        </div>
        <div className="form-group">
          <label>Pay Mode</label>
          <select value={form.pay_mode} onChange={set('pay_mode')}>
            <option value="cash">Cash</option>
            <option value="bank">Bank Deposit</option>
          </select>
        </div>
        <div className="form-group">
          <label>Salary Paid On (day of month)</label>
          <select value={form.salary_day} onChange={set('salary_day')}>
            <option value="">Select day…</option>
            {SALARY_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Department</label>
          <select value={form.department} onChange={set('department')}>
            <option value="">Select department…</option>
            {departments.map(d => <option key={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Designation</label>
          <select value={form.designation} onChange={set('designation')}>
            <option value="">Select designation…</option>
            {designations.map(d => <option key={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Employment Start Date *</label>
          <input value={form.start_date} onChange={set('start_date')} type="date"
            max={new Date().toISOString().split('T')[0]} />
        </div>
        <div className="form-group">
          <label>Termination Date</label>
          <input value={form.end_date} onChange={set('end_date')} type="date"
            min={form.start_date || undefined} />
        </div>
        <div className="form-group full">
          <label>Address</label>
          <input value={form.address} onChange={set('address')} placeholder="Street, City, State" />
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={() => { if (validate()) onSubmit(form) }}>{submitLabel}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Add Employee Tab ─────────────────────────────────────────────────────────
function AddTab({ onAdded }) {
  const showToast = useToast()
  const [nextId, setNextId] = useState('—')
  const [formKey, setFormKey] = useState(0)
  const [depts, setDepts] = useState([])
  const [desigs, setDesigs] = useState([])

  const loadMeta = useCallback(async () => {
    try {
      const [idRes, dRes, dgRes] = await Promise.all([
        db.hr().from('employees').select('emp_id').order('emp_id', { ascending: false }).limit(1),
        db.hr().from('departments').select('*').order('name'),
        db.hr().from('designations').select('*').order('name'),
      ])
      if (idRes.error) throw idRes.error
      if (dRes.error) throw dRes.error
      if (dgRes.error) throw dgRes.error

      const lastNum = idRes.data.length > 0
        ? parseInt(idRes.data[0].emp_id.replace(/^E/, ''), 10)
        : 0
      setNextId('E' + String(lastNum + 1).padStart(5, '0'))
      setDepts(dRes.data)
      setDesigs(dgRes.data)
    } catch (err) {
      console.error('loadMeta error:', err)
      setNextId('Auto')
    }
  }, [])

  useEffect(() => { loadMeta() }, [loadMeta])

  async function submit(form) {
    try {
      const { data: idData, error: idError } = await db.hr()
        .from('employees')
        .select('emp_id')
        .order('emp_id', { ascending: false })
        .limit(1)
      if (idError) throw idError

      const lastNum = idData.length > 0
        ? parseInt(idData[0].emp_id.replace(/^E/, ''), 10)
        : 0
      const emp_id = 'E' + String(lastNum + 1).padStart(5, '0')

      const { error } = await db.hr().from('employees').insert({ emp_id, ...form })
      if (error) throw error

      showToast(`✅ ${form.name} added! ID: ${emp_id}`)
      loadMeta()
      setFormKey(k => k + 1)
      onAdded()
    } catch (err) {
      console.error('add employee error:', err)
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <>
      <h1 className="page-title">Add Employee</h1>
      <p className="page-sub">Register a new staff member. Emp ID assigned automatically.</p>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>Auto-Assigned Employee ID</label>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="id-badge">{nextId}</div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Assigned automatically on save</span>
        </div>
      </div>
      <EmployeeForm
        key={formKey}
        submitLabel="Add Employee"
        departments={depts}
        designations={desigs}
        onSubmit={submit}
        onCancel={() => { setFormKey(k => k + 1); loadMeta() }}
      />
    </>
  )
}

// ─── View Employees — ViewModal ───────────────────────────────────────────────
function ViewModal({ emp, onClose, onEdit, onTerminate }) {
  const F = (label, value) => value ? (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  ) : null

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 6 }}>{emp.name}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="id-badge">{emp.emp_id}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: emp.status === 'active' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                color: emp.status === 'active' ? 'var(--success)' : 'var(--danger)',
              }}>{emp.status}</span>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 18, padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          {F('Designation', emp.designation)}
          {F('Department', emp.department)}
          {F('Phone', emp.phone)}
          {F('PAN', emp.pan)}
          {F('Aadhar', emp.aadhar ? maskAadhar(emp.aadhar) : null)}
          {F('Monthly Salary', emp.salary ? `₹${Number(emp.salary).toLocaleString('en-IN')}` : null)}
          {F('Pay Mode', emp.pay_mode)}
          {F('Salary Day', emp.salary_day ? `${emp.salary_day}th of month` : null)}
          {F('Start Date', emp.start_date)}
          {F('End Date', emp.end_date)}
          {F('Address', emp.address)}
        </div>
        <div className="modal-actions" style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {emp.status === 'active' && (
            <button className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => { onClose(); onTerminate(emp) }}>
              Terminate
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => { onClose(); onEdit(emp) }}>Edit</button>
        </div>
      </div>
    </div>
  )
}

// ─── View Employees — EditModal ───────────────────────────────────────────────
function EditModal({ emp, onClose, onSaved }) {
  const showToast = useToast()
  const [depts, setDepts] = useState([])
  const [desigs, setDesigs] = useState([])

  useEffect(() => {
    Promise.all([
      db.hr().from('departments').select('*').order('name'),
      db.hr().from('designations').select('*').order('name'),
    ]).then(([dRes, dgRes]) => {
      if (dRes.error) console.error('load departments error:', dRes.error)
      else setDepts(dRes.data)
      if (dgRes.error) console.error('load designations error:', dgRes.error)
      else setDesigs(dgRes.data)
    }).catch(err => console.error('EditModal load error:', err))
  }, [])

  async function submit(form) {
    try {
      const { error } = await db.hr()
        .from('employees')
        .update({ ...form })
        .eq('emp_id', emp.emp_id)
      if (error) throw error
      showToast(`✅ ${form.name} updated!`)
      onSaved(); onClose()
    } catch (err) {
      console.error('update employee error:', err)
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 4 }}>Edit Employee</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>{emp.emp_id}</div>
        <EmployeeForm
          initial={emp}
          submitLabel="Save Changes"
          departments={depts}
          designations={desigs}
          onSubmit={submit}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}

// ─── View Employees Tab ───────────────────────────────────────────────────────
function ViewTab() {
  const showToast = useToast()
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db.hr().from('employees').select('*').order('name')
      if (error) throw error
      setAll(data)
    } catch (err) {
      console.error('load employees error:', err)
      showToast('❌ Could not load employees', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  async function terminate(emp) {
    const today = new Date().toISOString().split('T')[0]
    try {
      const { error } = await db.hr()
        .from('employees')
        .update({ ...emp, end_date: today })
        .eq('emp_id', emp.emp_id)
      if (error) throw error
      showToast(`✅ ${emp.name} terminated`)
      load()
    } catch (err) {
      console.error('terminate employee error:', err)
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  async function deleteEmp(emp) {
    if (!confirm(`Delete "${emp.name}" (${emp.emp_id})? This cannot be undone.`)) return
    try {
      const { error } = await db.hr()
        .from('employees')
        .delete()
        .eq('emp_id', emp.emp_id)
      if (error) throw error
      showToast(`🗑️ ${emp.name} deleted`)
      load()
    } catch (err) {
      console.error('delete employee error:', err)
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  const filtered = query
    ? all.filter(r => ['name','emp_id','department','designation','status'].some(
        k => String(r[k]||'').toLowerCase().includes(query.toLowerCase())
      ))
    : all

  return (
    <>
      <h1 className="page-title">Employees</h1>
      <p className="page-sub">All registered staff. Click a row to view details.</p>
      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input placeholder="Search by name, ID, department…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={load}>↺ Refresh</button>
      </div>
      <div className="stats">
        <div className="stat-pill">Total <strong>{all.length}</strong></div>
        <div className="stat-pill">Active <strong>{all.filter(e=>e.status==='active').length}</strong></div>
      </div>
      <div className="table-card">
        <table>
          <thead><tr>
            <th>Emp ID</th><th>Name</th><th>Designation</th><th>Department</th>
            <th>Salary</th><th>Pay Mode</th><th>Salary Day</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={9}><span className="spinner" /> Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={9}>No employees found.</td></tr>
            ) : filtered.map(row => (
              <tr key={row.emp_id} style={{ cursor: 'pointer' }} onClick={() => setViewing(row)}>
                <td><span className="mono">{row.emp_id}</span></td>
                <td><strong>{row.name}</strong></td>
                <td>{row.designation || '—'}</td>
                <td>{row.department || '—'}</td>
                <td>{row.salary ? `₹${Number(row.salary).toLocaleString('en-IN')}` : '—'}</td>
                <td>{row.pay_mode || '—'}</td>
                <td>{row.salary_day ? `${row.salary_day}th` : '—'}</td>
                <td>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: row.status === 'active' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                    color: row.status === 'active' ? 'var(--success)' : 'var(--danger)',
                  }}>{row.status}</span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="actions">
                    <button className="action-btn btn-edit" onClick={() => setEditing(row)}>Edit</button>
                    <button className="action-btn btn-delete" onClick={() => deleteEmp(row)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewing && <ViewModal emp={viewing} onClose={() => setViewing(null)} onEdit={setEditing} onTerminate={terminate} />}
      {editing && <EditModal emp={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  )
}

// ─── Payroll Tab ──────────────────────────────────────────────────────────────
function PayrollTab() {
  const showToast = useToast()
  const [employees, setEmployees] = useState([])
  const [selEmp, setSelEmp] = useState(null)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [payroll, setPayroll] = useState(null)
  const [loading, setLoading] = useState(false)
  const [newLine, setNewLine] = useState({ payment_type: 'salary', amount: '', pay_date: '', pay_mode: 'cash', notes: '' })

  useEffect(() => {
    db.hr().from('employees').select('*').order('name').eq('status', 'active')
      .then(({ data, error }) => {
        if (error) console.error('load active employees error:', error)
        else setEmployees(data)
      })
  }, [])

  async function loadPayroll(emp, m) {
    if (!emp || !m) return
    setLoading(true)
    try {
      const { data: header, error: hErr } = await db.hr()
        .from('salary_headers')
        .select('*')
        .eq('emp_id', emp.emp_id)
        .eq('month', m)
        .maybeSingle()
      if (hErr) throw hErr

      if (!header) {
        setPayroll(null)
        return
      }

      const { data: lines, error: lErr } = await db.hr()
        .from('salary_lines')
        .select('*')
        .eq('header_id', header.header_id)
      if (lErr) throw lErr

      setPayroll({ ...header, lines: lines || [] })
    } catch (err) {
      console.error('load payroll error:', err)
      showToast('❌ Failed to load payroll', 'error')
    } finally {
      setLoading(false)
    }
  }

  function selectEmp(emp) { setSelEmp(emp); loadPayroll(emp, month) }
  function changeMonth(m) { setMonth(m); if (selEmp) loadPayroll(selEmp, m) }

  async function openOrCreate() {
    if (!selEmp) return showToast('Select an employee first', 'error')
    try {
      const { error } = await db.hr()
        .from('salary_headers')
        .upsert(
          { header_id: 'PH' + Date.now(), emp_id: selEmp.emp_id, month, total_paid: 0, notes: '' },
          { onConflict: 'emp_id,month' }
        )
      if (error) throw error
      await loadPayroll(selEmp, month)
      showToast(`✅ Payroll record opened for ${month}`)
    } catch (err) {
      console.error('openOrCreate payroll error:', err)
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  async function addLine() {
    if (!newLine.amount || Number(newLine.amount) <= 0) return showToast('Amount must be greater than 0', 'error')
    if (!newLine.pay_date) return showToast('Pay date is required', 'error')
    try {
      const { error: lineErr } = await db.hr()
        .from('salary_lines')
        .insert({
          line_id: 'SL' + Date.now(),
          header_id: payroll.header_id,
          payment_type: newLine.payment_type,
          amount: parseFloat(newLine.amount),
          pay_date: newLine.pay_date,
          pay_mode: newLine.pay_mode,
          notes: newLine.notes || null,
        })
      if (lineErr) throw lineErr

      // Refresh lines and update header total_paid
      const { data: lines, error: lErr } = await db.hr()
        .from('salary_lines')
        .select('*')
        .eq('header_id', payroll.header_id)
      if (lErr) throw lErr

      const total_paid = (lines || []).reduce((s, l) => s + Number(l.amount), 0)
      const { error: updateErr } = await db.hr()
        .from('salary_headers')
        .update({ total_paid })
        .eq('header_id', payroll.header_id)
      if (updateErr) throw updateErr

      showToast('✅ Line added')
      setNewLine({ payment_type: 'salary', amount: '', pay_date: '', pay_mode: 'cash', notes: '' })
      loadPayroll(selEmp, month)
    } catch (err) {
      console.error('add payroll line error:', err)
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  async function deleteLine(line_id) {
    if (!confirm('Remove this payment line?')) return
    try {
      const { error } = await db.hr()
        .from('salary_lines')
        .delete()
        .eq('line_id', line_id)
      if (error) throw error

      // Update header total_paid after deletion
      const { data: lines, error: lErr } = await db.hr()
        .from('salary_lines')
        .select('*')
        .eq('header_id', payroll.header_id)
      if (lErr) throw lErr

      const total_paid = (lines || []).reduce((s, l) => s + Number(l.amount), 0)
      const { error: updateErr } = await db.hr()
        .from('salary_headers')
        .update({ total_paid })
        .eq('header_id', payroll.header_id)
      if (updateErr) throw updateErr

      showToast('🗑️ Line removed')
      loadPayroll(selEmp, month)
    } catch (err) {
      console.error('delete payroll line error:', err)
      showToast('❌ Failed to delete line', 'error')
    }
  }

  const gross = payroll?.lines?.filter(l => l.payment_type !== 'deduction').reduce((s, l) => s + Number(l.amount), 0) || 0
  const deductions = payroll?.lines?.filter(l => l.payment_type === 'deduction').reduce((s, l) => s + Number(l.amount), 0) || 0
  const net = gross - deductions
  function setLine(field) { return e => setNewLine(l => ({ ...l, [field]: e.target.value })) }

  return (
    <>
      <h1 className="page-title">Payroll</h1>
      <p className="page-sub">Select an employee and month to view or record salary payments.</p>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div className="card" style={{ width: 260, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Select Employee</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
            {employees.map(e => (
              <button key={e.emp_id} onClick={() => selectEmp(e)} style={{
                textAlign: 'left', padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13,
                background: selEmp?.emp_id === e.emp_id ? 'var(--accent)' : 'white',
                color: selEmp?.emp_id === e.emp_id ? 'white' : 'var(--ink)',
              }}>
                <div style={{ fontWeight: 600 }}>{e.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{e.emp_id}</div>
              </button>
            ))}
            {employees.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>No active employees.</p>}
          </div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Month</div>
          <input type="month" value={month} onChange={e => changeMonth(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
          {selEmp && (
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={openOrCreate}>
              Open / Create Record
            </button>
          )}
        </div>
        <div style={{ flex: 1 }}>
          {!payroll && !loading && (
            <div className="card" style={{ color: 'var(--muted)', textAlign: 'center', padding: 48 }}>
              Select an employee and month, then click "Open / Create Record"
            </div>
          )}
          {loading && <div className="card" style={{ textAlign: 'center', padding: 48 }}><span className="spinner" /> Loading…</div>}
          {payroll && !loading && (
            <>
              <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>EMPLOYEE</div><div style={{ fontWeight: 600 }}>{selEmp?.name}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>MONTH</div><div style={{ fontWeight: 600 }}>{month}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>GROSS PAID</div><div style={{ fontWeight: 600 }}>₹{gross.toLocaleString('en-IN')}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>DEDUCTIONS</div><div style={{ fontWeight: 600, color: 'var(--danger)' }}>₹{deductions.toLocaleString('en-IN')}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>NET PAY</div><div style={{ fontWeight: 700, fontSize: 16, color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>₹{net.toLocaleString('en-IN')}</div></div>
              </div>
              <div className="table-card" style={{ marginBottom: 16 }}>
                <table>
                  <thead><tr><th>Type</th><th>Amount</th><th>Date</th><th>Mode</th><th>Notes</th><th></th></tr></thead>
                  <tbody>
                    {(!payroll.lines || payroll.lines.length === 0) && (
                      <tr className="state-row"><td colSpan={6}>No payment lines yet. Add one below.</td></tr>
                    )}
                    {payroll.lines?.map(l => (
                      <tr key={l.line_id}>
                        <td><span style={{ fontWeight: 600, color: l.payment_type === 'deduction' ? 'var(--danger)' : 'var(--success)' }}>{l.payment_type}</span></td>
                        <td>₹{Number(l.amount).toLocaleString('en-IN')}</td>
                        <td>{l.pay_date}</td>
                        <td>{l.pay_mode}</td>
                        <td>{l.notes || '—'}</td>
                        <td><button className="action-btn btn-delete" onClick={() => deleteLine(l.line_id)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Add Payment Line</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group"><label>Type</label><select value={newLine.payment_type} onChange={setLine('payment_type')}>{PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div className="form-group"><label>Amount (₹)</label><input value={newLine.amount} onChange={setLine('amount')} type="number" min="0.01" step="0.01" placeholder="0.00" /></div>
                  <div className="form-group"><label>Pay Date</label><input value={newLine.pay_date} onChange={setLine('pay_date')} type="date" /></div>
                  <div className="form-group"><label>Mode</label><select value={newLine.pay_mode} onChange={setLine('pay_mode')}>{PAY_MODES.map(m => <option key={m}>{m}</option>)}</select></div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 1 }}><label>Notes</label><input value={newLine.notes} onChange={setLine('notes')} placeholder="Optional note…" /></div>
                  <button className="btn btn-primary" onClick={addLine}>Add Line</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
const ATT_CYCLE = ['absent', 'full', 'half', 'holiday']
const ATT_LABEL = { full: 'F', half: 'H', holiday: '🎉', absent: '—' }
const ATT_COLOR = {
  full:    { background: 'rgba(22,163,74,0.12)',  color: '#15803d' },
  half:    { background: 'rgba(234,179,8,0.12)',  color: '#b45309' },
  holiday: { background: 'rgba(99,102,241,0.12)', color: '#4338ca' },
  absent:  { background: 'transparent',           color: 'var(--muted)' },
}

function AttendanceTab() {
  const showToast = useToast()
  const [employees, setEmployees] = useState([])
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [filter, setFilter] = useState('all')
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploadLog, setUploadLog] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const daysInMonth = (() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  })()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return `${month}-${d}`
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [y, m] = month.split('-').map(Number)
      const nextMonth = m === 12
        ? `${y + 1}-01-01`
        : `${y}-${String(m + 1).padStart(2, '0')}-01`

      const [empRes, attRes] = await Promise.all([
        db.hr().from('employees').select('*').order('name').eq('status', 'active'),
        db.hr().from('attendance').select('*').gte('att_date', `${month}-01`).lt('att_date', nextMonth),
      ])
      if (empRes.error) throw empRes.error
      if (attRes.error) throw attRes.error

      setEmployees(empRes.data)
      const map = {}
      attRes.data.forEach(a => { map[`${a.emp_id}_${a.att_date}`] = { status: a.status, att_id: a.att_id } })
      setRecords(map)
    } catch (err) {
      console.error('load attendance error:', err)
      showToast('❌ Could not load attendance', 'error')
    } finally {
      setLoading(false)
    }
  }, [month, showToast])

  useEffect(() => { loadData() }, [loadData])

  async function toggleCell(emp_id, date) {
    if (date > today) return
    const key = `${emp_id}_${date}`
    const current = records[key]?.status || 'absent'
    const next = ATT_CYCLE[(ATT_CYCLE.indexOf(current) + 1) % ATT_CYCLE.length]
    setRecords(r => ({ ...r, [key]: { ...r[key], status: next } }))
    try {
      const { data, error } = await db.hr()
        .from('attendance')
        .upsert(
          { att_id: `${emp_id}_${date}`, emp_id, att_date: date, status: next, notes: null },
          { onConflict: 'emp_id,att_date' }
        )
        .select()
        .maybeSingle()
      if (error) throw error
      setRecords(r => ({ ...r, [key]: { status: next, att_id: data?.att_id || `${emp_id}_${date}` } }))
    } catch (err) {
      console.error('toggle attendance error:', err)
      setRecords(r => ({ ...r, [key]: { ...r[key], status: current } }))
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  function downloadTemplate() {
    const [y, m] = month.split('-').map(Number)
    const dCount = new Date(y, m, 0).getDate()
    const rows = []
    employees.forEach(emp => {
      for (let d = 1; d <= dCount; d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`
        rows.push(`${emp.emp_id},${emp.name},${date},,`)
      }
    })
    const csv = ['emp_id,name,date,status,notes', ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `attendance_template_${month}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function processFile(file) {
    if (!file) return
    setUploadLog(null)
    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return showToast('File must have header + data rows', 'error')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const recs = lines.slice(1).map(line => {
      const cols = line.split(',')
      const obj = {}
      headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim() })
      return obj
    }).filter(r => r.emp_id && r.date && r.status)

    const validStatuses = new Set(['full', 'half', 'absent', 'holiday'])
    const toUpsert = []
    const skippedRows = []

    recs.forEach(r => {
      if (!validStatuses.has(r.status)) {
        skippedRows.push({ emp_id: r.emp_id, att_date: r.date, reason: `invalid status: ${r.status}` })
        return
      }
      toUpsert.push({
        att_id: `${r.emp_id}_${r.date}`,
        emp_id: r.emp_id,
        att_date: r.date,
        status: r.status,
        notes: r.notes || null,
      })
    })

    let inserted = 0, updated = 0, errors = 0
    try {
      if (toUpsert.length > 0) {
        const { error } = await db.hr()
          .from('attendance')
          .upsert(toUpsert, { onConflict: 'emp_id,att_date' })
        if (error) throw error
        // Supabase upsert doesn't distinguish insert vs update; approximate
        inserted = toUpsert.length
      }
    } catch (err) {
      console.error('bulk attendance upload error:', err)
      errors = toUpsert.length
      inserted = 0
    }

    const result = { inserted, updated, skipped: skippedRows.length, errors, skippedRows }
    setUploadLog(result)
    showToast(`Upload done: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`)
    loadData()
  }

  const displayEmps = filter === 'all' ? employees : employees.filter(e => e.emp_id === filter)

  return (
    <>
      <h1 className="page-title">Attendance</h1>
      <p className="page-sub">Click a cell to cycle: — → F (full) → H (half) → 🎉 (holiday) → —</p>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, minWidth: 160 }}>
          <option value="all">All Employees</option>
          {employees.map(e => <option key={e.emp_id} value={e.emp_id}>{e.name}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={loadData}>↺ Refresh</button>
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 32 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /> Loading…</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', background: 'var(--bg)', position: 'sticky', left: 0, zIndex: 1, borderBottom: '1px solid var(--border)' }}>Employee</th>
                {days.map(date => {
                  const d = new Date(date)
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <th key={date} style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, color: isWeekend ? 'var(--accent)' : 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                      {date.slice(8)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {displayEmps.length === 0 ? (
                <tr><td colSpan={days.length + 1} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No employees.</td></tr>
              ) : displayEmps.map(emp => (
                <tr key={emp.emp_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 13, position: 'sticky', left: 0, background: 'var(--card)', zIndex: 1, borderRight: '1px solid var(--border)' }}>
                    <div>{emp.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>{emp.emp_id}</div>
                  </td>
                  {days.map(date => {
                    const key = `${emp.emp_id}_${date}`
                    const status = records[key]?.status || 'absent'
                    const isFuture = date > today
                    return (
                      <td key={date} style={{ padding: '3px 4px', textAlign: 'center' }}>
                        <button onClick={() => !isFuture && toggleCell(emp.emp_id, date)} style={{
                          width: 28, height: 28, borderRadius: 6, border: 'none',
                          cursor: isFuture ? 'default' : 'pointer', fontSize: 12, fontWeight: 700,
                          transition: 'all 0.1s', opacity: isFuture ? 0.3 : 1,
                          ...ATT_COLOR[status],
                        }} title={isFuture ? 'Future date' : status}>
                          {ATT_LABEL[status]}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>CSV Upload</div>
        <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }}
          onClick={() => document.getElementById('att-file').click()}
          style={{ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--accent2)' : 'transparent', transition: 'all 0.2s' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📥</div>
          <div style={{ fontWeight: 600 }}>Drop CSV here or click to browse</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Columns: emp_id, name, date, status, notes</div>
          <input id="att-file" type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={e => processFile(e.target.files[0])} />
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={downloadTemplate}>⬇ Download Template ({month})</button>
        </div>
        {uploadLog && (
          <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: uploadLog.errors > 0 ? 'rgba(234,179,8,0.1)' : 'rgba(22,163,74,0.1)', border: `1px solid ${uploadLog.errors > 0 ? '#eab308' : '#22c55e'}`, fontSize: 13 }}>
            <strong>Upload complete:</strong> {uploadLog.inserted} inserted · {uploadLog.updated} updated · {uploadLog.skipped} skipped · {uploadLog.errors} errors
            {uploadLog.skippedRows?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong>Skipped rows:</strong>
                {uploadLog.skippedRows.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--muted)' }}>Row {i+1}: {r.emp_id} / {r.att_date} — {r.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Config Tab ───────────────────────────────────────────────────────────────
function ConfigCard({ title, table, itemKey }) {
  const showToast = useToast()
  const [items, setItems] = useState([])
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    try {
      const { data, error } = await db.hr().from(table).select('*').order('name')
      if (error) throw error
      setItems(data)
    } catch (err) {
      console.error(`load ${table} error:`, err)
    }
  }, [table])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!newName.trim()) return showToast('Name is required', 'error')
    try {
      const { error } = await db.hr().from(table).insert({ name: newName.trim() })
      if (error) throw error
      showToast(`✅ ${newName.trim()} added`); setNewName(''); load()
    } catch (err) {
      console.error(`add ${table} error:`, err)
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  async function remove(item) {
    try {
      const { error } = await db.hr().from(table).delete().eq('id', item.id)
      if (error) throw error
      showToast('🗑️ Deleted'); load()
    } catch (err) {
      console.error(`delete ${table} error:`, err)
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder={`New ${title.toLowerCase()}…`}
          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
          onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="btn btn-primary" onClick={add}>Add</button>
      </div>
      {items.length === 0
        ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No {title.toLowerCase()} yet.</p>
        : items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13 }}>{item[itemKey]}</span>
            <button className="action-btn btn-delete" onClick={() => remove(item)}>Delete</button>
          </div>
        ))
      }
    </div>
  )
}

function ConfigTab() {
  return (
    <>
      <h1 className="page-title">HR Config</h1>
      <p className="page-sub">Manage departments and designations.</p>
      <div style={{ display: 'flex', gap: 24 }}>
        <ConfigCard title="Departments" table="departments" itemKey="name" />
        <ConfigCard title="Designations" table="designations" itemKey="name" />
      </div>
    </>
  )
}

// ─── Main HR page ─────────────────────────────────────────────────────────────
const HR_TABS = [
  { id: 'view',       label: 'Employees' },
  { id: 'payroll',    label: 'Payroll' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'config',     label: 'Config' },
  { id: 'add',        label: 'Add Employee' },
]
const HR_TAB_LABELS = {
  view: 'Employees', payroll: 'Payroll', attendance: 'Attendance',
  config: 'Config', add: 'Add Employee',
}

export default function HR() {
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ employees: '—', present: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [{ count: empCount }, { count: presentCount }] = await Promise.all([
          db.hr().from('employees').select('*', { count: 'exact', head: true }),
          db.hr().from('attendance').select('*', { count: 'exact', head: true })
            .eq('date', today).eq('status', 'present'),
        ])
        setStats({ employees: empCount ?? 0, present: presentCount ?? 0 })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [refreshKey])

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="HR"
        breadcrumb={HR_TAB_LABELS[tab]}
        action={
          tab !== 'add' && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setTab('add')}>
              + Add Employee
            </button>
          )
        }
      />
      <ModuleTabs tabs={HR_TABS} activeTab={tab} onChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <StatsStrip stats={[
        { value: stats.employees, label: 'Employees' },
        { value: stats.present,   label: 'Present Today', color: 'var(--success)' },
      ]} />
      <div className="erp-content">
        {tab === 'add'        && <AddTab onAdded={() => { setTab('view'); setRefreshKey(k => k + 1) }} />}
        {tab === 'view'       && <ViewTab key={refreshKey} />}
        {tab === 'payroll'    && <PayrollTab />}
        {tab === 'attendance' && <AttendanceTab />}
        {tab === 'config'     && <ConfigTab />}
      </div>
    </ERPLayout>
  )
}
