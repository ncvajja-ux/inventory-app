import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'

// ─── hooks ────────────────────────────────────────────────────────────────────
function useGroups() {
  const [groups, setGroups] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.groups().from('customer_groups').select('*').order('name')
      if (error) { console.error('Failed to load groups:', error.message); return }
      setGroups(data || [])
    } catch (err) {
      console.error('Failed to load groups:', err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  return [groups, load]
}

function useCustomerSearch() {
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

// ─── GroupCard ────────────────────────────────────────────────────────────────
function GroupCard({ group, onRefresh, showToast }) {
  const [expanded, setExpanded]   = useState(false)
  const [members,  setMembers]    = useState([])
  const [editing,  setEditing]    = useState(false)
  const [editName, setEditName]   = useState(group.name)
  const [editNotes,setEditNotes]  = useState(group.notes || '')
  const [addQ,     setAddQ]       = useState('')
  const [results,  search, clearResults] = useCustomerSearch()

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
    } catch (err) {
      console.error('Failed to load group members:', err.message)
    }
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
    setEditing(false); onRefresh()
    showToast('Group updated', 'success')
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
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: expanded ? '1px solid var(--border)' : 'none',
        cursor: 'pointer',
      }} onClick={() => { setExpanded(e => !e); setEditing(false) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>👥</span>
          {editing ? (
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 15, fontWeight: 700, width: 200, padding: '4px 8px' }}
              autoFocus
            />
          ) : (
            <span style={{ fontWeight: 700, fontSize: 15 }}>{group.name}</span>
          )}
          <span style={{
            background: 'var(--accent2)', color: '#92650a',
            borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
          }}>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
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

      {/* Body */}
      {expanded && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Edit notes */}
          {editing && (
            <div>
              <label>Notes</label>
              <input
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Optional notes about this group"
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>
          )}

          {/* Members list */}
          {members.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No members yet — add some below.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => (
                <div key={m.kunnr} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg)',
                  borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: avatarColor(m.kunnr),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, flexShrink: 0,
                    }}>{(m.name || m.kunnr).charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.number || ''}</div>
                    </div>
                    <span className="mono">{m.kunnr}</span>
                  </div>
                  <button
                    onClick={() => removeMember(m.kunnr)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, padding: '0 4px' }}
                    title="Remove from group"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Add member */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={addQ}
                onChange={e => { setAddQ(e.target.value); search(e.target.value) }}
                placeholder="Search customer to add…"
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 13 }}
                onClick={() => { setAddQ(''); clearResults() }}>
                Clear
              </button>
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

          {/* Group notes display */}
          {!editing && group.notes && (
            <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{group.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── NewGroupTab ──────────────────────────────────────────────────────────────
function NewGroupTab({ onCreated, showToast }) {
  const [name,  setName]  = useState('')
  const [notes, setNotes] = useState('')
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

// ─── ViewGroupsTab ─────────────────────────────────────────────────────────
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
          <p>No groups yet — create one from the sidebar</p>
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
export default function Groups() {
  const [tab, setTab] = useState('view')
  const showToast = useToast()

  return (
    <div className="page-layout">
      <Sidebar section="Groups" activeTab={tab} onTabChange={setTab} />
      <main className="main">
        {tab === 'view' && <ViewGroupsTab showToast={showToast} />}
        {tab === 'new'  && <NewGroupTab onCreated={() => setTab('view')} showToast={showToast} />}
      </main>
    </div>
  )
}
