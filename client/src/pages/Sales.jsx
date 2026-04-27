import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'
import { db, supabase } from '../lib/supabase'

const fmt = n => '₹' + parseFloat(n || 0).toFixed(2)
const fmtD = s => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ step, labels }) {
  return (
    <div className="steps">
      {labels.map((label, i) => {
        const n = i + 1
        const cls = n < step ? 'step done' : n === step ? 'step active' : 'step'
        return (
          <span key={n} style={{ display: 'contents' }}>
            <div className={cls}>
              <div className="step-num">{n < step ? '✓' : n}</div>
              <span>{label}</span>
            </div>
            {n < labels.length && <div className={`step-line${n < step ? ' done' : ''}`} />}
          </span>
        )
      })}
    </div>
  )
}

// ── Live search dropdown ──────────────────────────────────────────────────────
function SearchDropdown({ placeholder, onSearch, onSelect, renderItem, getLabelText, width = 340 }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState('')
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    setSelectedLabel('')
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      const items = await onSearch(val)
      setResults(items || [])
      setOpen(true)
    }, 250)
  }

  function select(item) {
    const label = getLabelText ? getLabelText(item) : (renderItem ? '' : String(item))
    setSelectedLabel(label)
    setQuery('')
    setResults([])
    setOpen(false)
    onSelect(item)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width }}>
      <input
        value={selectedLabel || query}
        onChange={handleInput}
        onFocus={() => { if (results.length) setOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
        style={{ width: '100%' }}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((item, i) => (
            <div key={i} className="search-result-item" onMouseDown={() => select(item)}>
              {renderItem ? renderItem(item) : item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── New Order ─────────────────────────────────────────────────────────────────
function NewOrderTab() {
  const showToast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Step and customer stored in URL so browser back/forward works
  const step = parseInt(searchParams.get('step') || '1')
  const urlKunnr = searchParams.get('kunnr') || ''

  const [customer, setCustomer] = useState(null)
  const [cart, setCart] = useState([])                // local cart state
  const [allInventory, setAllInventory] = useState([])
  const [products, setProducts] = useState([])
  // Multi-select: { matnr: qty }
  const [selectedItems, setSelectedItems] = useState({})
  const [filterCat, setFilterCat] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [categories, setCategories] = useState({})
  const [custDiscountPct, setCustDiscountPct] = useState(0)   // % from customer_discount table
  const [prodDiscounts, setProdDiscounts] = useState({})      // matnr -> discount_pct
  const [brands, setBrands] = useState([])
  const [orderForm, setOrderForm] = useState({ payment_method: '', discount: '', salesperson: '', notes: '' })
  const [placing, setPlacing] = useState(false)

  // Restore customer from URL when navigating back
  useEffect(() => {
    if (urlKunnr && !customer) {
      db.customers().from('kna1').select('*').eq('kunnr', urlKunnr).single()
        .then(({ data: custData }) => { if (custData) setCustomer(custData) })
        .catch(() => {})
    }
  }, [urlKunnr]) // eslint-disable-line

  useEffect(() => {
    async function loadFilters() {
      try {
        const [{ data: catData }, { data: brandData }] = await Promise.all([
          db.inventory().from('categories').select('*'),
          db.inventory().from('brands').select('name'),
        ])
        // Build categories map keyed by name for filter dropdown
        const catMap = {}
        ;(catData || []).forEach(c => { catMap[c.name] = c })
        setCategories(catMap)
        setBrands(brandData || [])
      } catch { /* non-blocking */ }
    }
    loadFilters()
  }, [])

  // Load products whenever step 2 is shown (direct URL load, back navigation, or fresh select)
  useEffect(() => {
    if (step === 2) loadProducts()
  }, [step]) // eslint-disable-line

  async function loadProducts() {
    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const [
        { data: invData },
        { data: spData },
        { data: pdData },
        { data: gstData },
      ] = await Promise.all([
        db.inventory().from('mara').select('*').gt('quantity', 0).order('brand'),
        db.pricing().from('sales_price').select('*'),
        db.pricing().from('product_discount').select('*'),
        db.pricing().from('gst_config').select('*'),
      ])

      // Build map: tax_category -> gst_rate (take the active/latest valid entry)
      const gstMap = {}
      ;(gstData || []).forEach(g => { gstMap[g.tax_category] = parseFloat(g.gst_rate) || 0 })

      // Build map: matnr -> active sales price (falls back to nearest upcoming if none active today)
      const spMap = {}
      const spFutureMap = {}  // fallback: earliest future price per matnr
      ;(spData || []).forEach(sp => {
        const from = (sp.valid_from || '').replace(/-/g, '')
        const to   = (sp.valid_to  || '12319999').replace(/-/g, '')
        if (today >= from && today <= to) {
          // Active today — prefer the one with the latest valid_from
          if (!spMap[sp.matnr] || from > (spMap[sp.matnr].valid_from || '').replace(/-/g, '')) {
            spMap[sp.matnr] = sp
          }
        } else if (from > today) {
          // Future price — keep the one with the earliest valid_from as fallback
          if (!spFutureMap[sp.matnr] || from < (spFutureMap[sp.matnr].valid_from || '').replace(/-/g, '')) {
            spFutureMap[sp.matnr] = sp
          }
        }
      })

      // Build map: matnr -> latest active product discount %
      const pdMap = {}
      ;(pdData || []).forEach(pd => {
        const from = (pd.valid_from || '').replace(/-/g, '')
        const to   = (pd.valid_to  || '12319999').replace(/-/g, '')
        if (today >= from && today <= to) {
          if (!pdMap[pd.matnr] || from > (pdMap[pd.matnr].valid_from || '').replace(/-/g, '')) {
            pdMap[pd.matnr] = pd
          }
        }
      })
      setProdDiscounts(Object.fromEntries(Object.entries(pdMap).map(([k, v]) => [k, parseFloat(v.discount_pct) || 0])))

      const enriched = invData.map(p => ({
        ...p,
        // Use active price; fall back to nearest upcoming price if none active today
        sales_price: spMap[p.matnr]
          ? spMap[p.matnr].unit_price
          : spFutureMap[p.matnr]
            ? spFutureMap[p.matnr].unit_price
            : null,
        _price_is_future: !spMap[p.matnr] && !!spFutureMap[p.matnr],
        _price_valid_from: spFutureMap[p.matnr] ? spFutureMap[p.matnr].valid_from : null,
        prod_discount_pct: pdMap[p.matnr] ? parseFloat(pdMap[p.matnr].discount_pct) : 0,
        gst_rate: gstMap[p.tax_category] ?? 0,
      }))
      setAllInventory(enriched)
      setProducts(enriched)
    } catch (err) { showToast(err.message || 'Could not load products', 'error') }
  }

  useEffect(() => {
    let filtered = allInventory
    if (filterCat)    filtered = filtered.filter(p => p.category === filterCat)
    if (filterBrand)  filtered = filtered.filter(p => p.brand === filterBrand)
    if (productSearch) {
      const q = productSearch.toLowerCase()
      filtered = filtered.filter(p => Object.values(p).some(v => String(v ?? '').toLowerCase().includes(q)))
    }
    setProducts(filtered)
  }, [filterCat, filterBrand, productSearch, allInventory])

  async function searchCustomers(q) {
    try {
      const { data } = await db.customers().from('kna1').select('kunnr, name, number')
        .or(`name.ilike.%${q}%,number.ilike.%${q}%,kunnr.ilike.%${q}%`).limit(10)
      return data || []
    } catch { return [] }
  }

  // Navigate to a wizard step — pushes a browser history entry
  function goStep(n, kunnr) {
    const p = new URLSearchParams()
    p.set('tab', 'new')
    if (n > 1) p.set('step', String(n))
    if (kunnr) p.set('kunnr', kunnr)
    setSearchParams(p)   // adds history entry — browser back goes to previous step
  }

  async function selectCustomer(c) {
    setCustomer(c)
    setCart([])
    // Fetch customer discount
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: cdRows } = await db.pricing().from('customer_discount').select('*')
        .eq('kunnr', c.kunnr).lte('valid_from', today).or(`valid_to.is.null,valid_to.gte.${today}`)
        .order('valid_from', { ascending: false }).limit(1)
      setCustDiscountPct(cdRows?.[0]?.discount_pct || 0)
    } catch { setCustDiscountPct(0) }
    goStep(2, c.kunnr)
    loadProducts()
  }

  // Toggle a product in/out of the multi-selection
  function toggleSelect(p) {
    setSelectedItems(prev => {
      if (prev[p.matnr]) {
        const next = { ...prev }; delete next[p.matnr]; return next
      }
      return { ...prev, [p.matnr]: 1 }
    })
  }

  // Update qty for a selected product
  function setSelectedQty(matnr, qty) {
    const q = Math.max(1, parseInt(qty) || 1)
    setSelectedItems(prev => ({ ...prev, [matnr]: q }))
  }

  async function addToCart() {
    const entries = Object.entries(selectedItems) // [[matnr, qty], ...]
    if (!entries.length) return showToast('Select at least one product', 'error')
    const kunnr = customer?.kunnr || urlKunnr

    // Validate pricing for all selected items first
    const productMap = Object.fromEntries(allInventory.map(p => [p.matnr, p]))
    const noPriceItems = entries.filter(([matnr]) => {
      const p = productMap[matnr]
      const sp = p?.sales_price ?? p?.mrp ?? 0
      return !sp || parseFloat(sp) <= 0
    })
    if (noPriceItems.length) {
      const names = noPriceItems.map(([matnr]) => `${productMap[matnr]?.brand} (${matnr})`).join(', ')
      return showToast(`❌ No pricing set for: ${names}. Go to Sales → Pricing tab first.`, 'error')
    }

    // ── Group conflict check (non-blocking, one call per product) ─────────────
    if (kunnr) {
      const conflictMsgs = []
      await Promise.all(entries.map(async ([matnr]) => {
        try {
          const { data: ccData } = await supabase.rpc('conflict_check', { p_kunnr: kunnr, p_matnr: matnr })
          if (ccData?.[0]?.has_conflict) {
            conflictMsgs.push(`⚠️ ${ccData[0].buyer_name} (${ccData[0].group_name}) already bought ${productMap[matnr]?.brand} ${matnr}`)
          }
        } catch { /* non-blocking */ }
      }))
      if (conflictMsgs.length) showToast([...new Set(conflictMsgs)].join('\n'), 'warning')
    }

    // Add every selected item to local cart state only (no server temp cart)
    let added = 0
    entries.forEach(([matnr, qty]) => {
      const p = productMap[matnr]
      const sp = p.sales_price ?? p.mrp ?? 0
      const pdPct = p.prod_discount_pct || prodDiscounts[matnr] || 0
      setCart(prev => {
        const idx = prev.findIndex(i => i.matnr === matnr)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty }
          return updated
        }
        return [...prev, { ...p, sales_price: sp, prod_discount_pct: pdPct, quantity: qty }]
      })
      added++
    })

    showToast(`✅ ${added} item${added > 1 ? 's' : ''} added to cart`)
    setSelectedItems({})
  }

  function updateCartQty(matnr, delta) {
    const item = cart.find(i => i.matnr === matnr)
    if (!item) return
    const newQty = Math.max(1, item.quantity + delta)
    setCart(prev => prev.map(i => i.matnr === matnr ? { ...i, quantity: newQty } : i))
  }

  function removeFromCart(matnr) {
    setCart(prev => prev.filter(i => i.matnr !== matnr))
  }

  function startNewOrder() {
    setCart([]); setCustomer(null); setSelectedItems({})
    setOrderForm({ payment_method: '', discount: '', salesperson: '', notes: '' })
    goStep(1)
  }

  const cartTotals = cart.reduce((acc, item) => {
    const basePrice = parseFloat(item.sales_price ?? item.mrp ?? item.price ?? 0)
    const pdPct = parseFloat(item.prod_discount_pct || prodDiscounts[item.matnr] || 0)
    const priceAfterProdDisc = basePrice * (1 - pdPct / 100)
    const gst = parseFloat(item.gst_rate || 0) / 100
    const taxableBase = priceAfterProdDisc / (1 + gst)
    acc.subtotal += taxableBase * item.quantity
    acc.tax += (priceAfterProdDisc - taxableBase) * item.quantity
    acc.gross += priceAfterProdDisc * item.quantity
    acc.prodDiscount += (basePrice - priceAfterProdDisc) * item.quantity
    return acc
  }, { subtotal: 0, tax: 0, gross: 0, prodDiscount: 0 })

  const custDiscountAmt = cartTotals.gross * custDiscountPct / 100
  const manualDiscountAmt = parseFloat(orderForm.discount) || 0
  const discountAmt = custDiscountAmt + manualDiscountAmt
  const grandTotal = cartTotals.gross - custDiscountAmt - manualDiscountAmt

  async function placeOrder() {
    if (!cart.length) return showToast('Cart is empty', 'error')
    const kunnr = customer?.kunnr || urlKunnr
    setPlacing(true)
    try {
      // Compute gross before header discounts so we can distribute them proportionally
      const orderLines = cart.map(item => {
        const sp = parseFloat(item.sales_price ?? item.mrp ?? 0)
        const pdPct = parseFloat(item.prod_discount_pct || prodDiscounts[item.matnr] || 0)
        const effPrice = sp * (1 - pdPct / 100)
        const gst = parseFloat(item.gst_rate || 0)
        return { item, effPrice, pdPct, gst, lineGross: effPrice * item.quantity }
      })
      const totalGross = orderLines.reduce((s, l) => s + l.lineGross, 0)
      const custDiscAmt = totalGross * (custDiscountPct || 0) / 100
      const manualDiscAmt = parseFloat(orderForm.discount) || 0
      const grandTotal = totalGross - custDiscAmt - manualDiscAmt
      const discountFactor = totalGross > 0 ? grandTotal / totalGross : 1

      const { data: orderId, error } = await supabase.rpc('place_order', {
        p_kunnr: kunnr,
        p_items: orderLines.map(({ item, effPrice, pdPct, gst, lineGross }) => ({
          matnr: item.matnr,
          quantity: item.quantity,
          price: effPrice,
          mrp: item.mrp || 0,
          discount_pct: pdPct,
          gst_rate: gst,
          line_total: lineGross * discountFactor,   // actual revenue after all discounts
        })),
        p_customer_discount_pct: custDiscountPct || 0,
        p_manual_discount: manualDiscAmt,
      })
      if (error) { showToast(error.message, 'error'); return }
      showToast(`✅ Order ${orderId} placed!`)
      navigate(`/invoice?order_id=${orderId}`)
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    } finally {
      setPlacing(false)
    }
  }

  // ── Step 1: Select Customer ──
  if (step === 1) {
    return (
      <>
        <StepBar step={1} labels={['Customer', 'Add Products', 'Cart & Checkout']} />
        <div className="card">
          <div className="card-title">Find Customer</div>
          <div className="card-sub">Search by name, phone number, or KUNNR.</div>
          <div className="form-group">
            <label>Search Customer</label>
            <SearchDropdown
              placeholder="Name, phone, or KUNNR…"
              onSearch={searchCustomers}
              onSelect={selectCustomer}
              renderItem={c => (
                <div>
                  <div className="sri-name">{c.name} <span className="sri-kunnr">{c.kunnr}</span></div>
                  <div className="sri-detail">{[c.number, c.email].filter(Boolean).join(' · ')}</div>
                </div>
              )}
            />
          </div>
        </div>
      </>
    )
  }

  // ── Step 2: Add Products ──
  if (step === 2) {
    return (
      <>
        <StepBar step={2} labels={['Customer', 'Add Products', 'Cart & Checkout']} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => goStep(1)}>← Change Customer</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent2)', border: '1.5px solid #e8d0a0', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#92650a' }}>
            <span>👤</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{customer?.kunnr || urlKunnr}</span>
            <span>{customer?.name}</span>
          </div>
          <button className="btn btn-ghost" onClick={() => goStep(3, customer?.kunnr || urlKunnr)} disabled={!cart.length}>
            🛒 View Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
          </button>
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={startNewOrder}>✕ Cancel</button>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Add Products</div>
          <div className="card-sub">Click products to select them — set quantity on each card, then tap "Add to Cart".</div>
          <div className="filter-row">
            <div className="form-group">
              <label>Category</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">All Categories</option>
                {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Brand</label>
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
                <option value="">All Brands</option>
                {brands.map(b => <option key={b.id || b.name} value={b.name || b}>{b.name || b}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Search</label>
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input placeholder="MATNR, brand, size…" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-ghost" style={{ alignSelf: 'flex-end' }} onClick={loadProducts}>↺</button>
          </div>
        </div>

        {allInventory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p style={{ fontWeight: 600 }}>No inventory items yet.</p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Add products via Inventory → New Product before creating an order.</p>
          </div>
        ) : (
          <div className="product-grid" style={{ marginBottom: 90 }}>
            {products.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <div className="empty-icon">🔍</div>
                <p>No products match your filters.</p>
              </div>
            ) : products.map(p => {
              const isSel = !!selectedItems[p.matnr]
              const selQty = selectedItems[p.matnr] || 1
              return (
                <div
                  key={p.matnr}
                  className={`product-card${isSel ? ' selected' : ''}`}
                  onClick={() => toggleSelect(p)}
                >
                  <div className="selected-tick">✓</div>
                  <div className="p-matnr">{p.matnr}</div>
                  <div className="p-brand">{p.brand}</div>
                  <div className="p-meta">{[p.category, p.size, p.color].filter(Boolean).join(' · ')}</div>
                  <div className="p-price">
                    {fmt(p.sales_price ?? p.mrp ?? 0)}
                    {p._price_is_future && (
                      <span title={`Price active from ${p._price_valid_from}`} style={{ marginLeft: 4, fontSize: 10, color: '#b45309', background: '#fef3c7', border: '1px solid #f0c060', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                        from {p._price_valid_from}
                      </span>
                    )}
                    {!p.sales_price && !p._price_is_future && (p.mrp > 0) && (
                      <span title="No sales price set — using MRP as fallback" style={{ marginLeft: 4, fontSize: 10, color: '#7c3aed', background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                        MRP
                      </span>
                    )}
                  </div>
                  <div className="p-stock">{p.available ?? p.quantity ?? 0} in stock</div>
                  {isSel && (
                    <div className="card-qty-row" onClick={e => e.stopPropagation()}>
                      <button className="qty-stepper" onClick={() => setSelectedQty(p.matnr, selQty - 1)}>−</button>
                      <input
                        className="qty-input-card"
                        type="number" min="1"
                        value={selQty}
                        onChange={e => setSelectedQty(p.matnr, e.target.value)}
                      />
                      <button className="qty-stepper" onClick={() => setSelectedQty(p.matnr, selQty + 1)}>+</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="add-bar">
          <div className="selected-info">
            {Object.keys(selectedItems).length === 0
              ? 'No products selected — click cards to select'
              : `${Object.keys(selectedItems).length} product${Object.keys(selectedItems).length > 1 ? 's' : ''} selected · ${Object.values(selectedItems).reduce((s, q) => s + q, 0)} units`
            }
          </div>
          {Object.keys(selectedItems).length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setSelectedItems({})}>Clear selection</button>
          )}
          <button className="btn btn-primary" onClick={addToCart} disabled={!Object.keys(selectedItems).length}>
            Add to Cart 🛒{Object.keys(selectedItems).length > 1 ? ` (${Object.keys(selectedItems).length})` : ''}
          </button>
        </div>
      </>
    )
  }

  // ── Step 3: Cart & Checkout ──
  return (
    <>
      <StepBar step={3} labels={['Customer', 'Add Products', 'Cart & Checkout']} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => goStep(2, customer?.kunnr || urlKunnr)}>← Back to Products</button>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, flex: 1 }}>Your Cart</h1>
        <button className="btn btn-ghost" onClick={() => goStep(2, customer?.kunnr || urlKunnr)}>+ Add More</button>
        <button className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={startNewOrder}>✕ Clear Order</button>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>MATNR</th><th>Brand</th><th>Details</th>
              <th className="right">Sales Price</th><th className="right">GST %</th><th className="right">Qty</th>
              <th className="right">Line Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {cart.length === 0 ? (
              <tr className="state-row"><td colSpan={8}>Your cart is empty. <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => goStep(2, customer?.kunnr || urlKunnr)}>Add products</button></td></tr>
            ) : cart.map(item => {
              const sp  = parseFloat(item.sales_price ?? item.mrp ?? item.price ?? 0)
              const pdPct = parseFloat(item.prod_discount_pct || prodDiscounts[item.matnr] || 0)
              const effPrice = sp * (1 - pdPct / 100)
              const gst = parseFloat(item.gst_rate || 0)
              return (
                <tr key={item.matnr}>
                  <td><span className="mono">{item.matnr}</span></td>
                  <td><strong>{item.brand}</strong></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{[item.category, item.size, item.color].filter(Boolean).join(' · ')}</td>
                  <td className="right">{fmt(sp)}{pdPct > 0 && <span style={{ color: 'var(--success)', fontSize: 11, marginLeft: 4 }}>−{pdPct}%</span>}</td>
                  <td className="right"><span className="gst-badge">{gst}%</span></td>
                  <td className="right">
                    <div className="qty-cell">
                      <button className="qty-stepper" onClick={() => updateCartQty(item.matnr, -1)}>−</button>
                      <span className="qty-display">{item.quantity}</span>
                      <button className="qty-stepper" onClick={() => updateCartQty(item.matnr, 1)}>+</button>
                    </div>
                  </td>
                  <td className="right"><strong>{fmt(effPrice * item.quantity)}</strong></td>
                  <td><button className="action-btn btn-delete" onClick={() => removeFromCart(item.matnr)}>Remove</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Payment Method', key: 'payment_method', type: 'select', options: ['Cash', 'Card', 'UPI', 'Bank Transfer'] },
              { label: 'Discount (₹)', key: 'discount', type: 'number', placeholder: '0.00' },
              { label: 'Salesperson', key: 'salesperson', type: 'text', placeholder: 'Name' },
              { label: 'Notes', key: 'notes', type: 'text', placeholder: 'Any order notes…' },
            ].map(f => (
              <div key={f.key} className="form-group">
                <label>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={orderForm[f.key]} onChange={e => setOrderForm(o => ({ ...o, [f.key]: e.target.value }))}>
                    <option value="">Select…</option>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type} value={orderForm[f.key]} onChange={e => setOrderForm(o => ({ ...o, [f.key]: e.target.value }))} placeholder={f.placeholder} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? '0.01' : undefined} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="totals-card">
          <div className="totals-row"><span>Subtotal (excl. GST)</span><span>{fmt(cartTotals.subtotal)}</span></div>
          {cartTotals.prodDiscount > 0 && (
            <div className="totals-row tax"><span>Product Discount</span><span style={{ color: 'var(--success)' }}>−{fmt(cartTotals.prodDiscount)}</span></div>
          )}
          <div className="totals-row tax"><span>GST (incl.)</span><span>{fmt(cartTotals.tax)}</span></div>
          <div className="totals-row"><span>Amount Before Cust. Disc.</span><span>{fmt(cartTotals.gross)}</span></div>
          {custDiscountPct > 0 && (
            <div className="totals-row tax"><span>Customer Discount ({custDiscountPct}%)</span><span style={{ color: 'var(--success)' }}>−{fmt(custDiscountAmt)}</span></div>
          )}
          {manualDiscountAmt > 0 && (
            <div className="totals-row tax"><span>Manual Discount</span><span style={{ color: 'var(--success)' }}>−{fmt(manualDiscountAmt)}</span></div>
          )}
          <div className="totals-row grand"><span>Total</span><span>{fmt(grandTotal)}</span></div>
          <button className="place-order-btn" onClick={placeOrder} disabled={placing || !cart.length}>
            {placing ? '⏳ Placing…' : '✅ Place Order'}
          </button>
          <button onClick={startNewOrder} style={{ marginTop: 8, width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--card)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--muted)' }}>
            🗑️ Clear Cart & Start Over
          </button>
        </div>
      </div>
    </>
  )
}

// ── All Orders ────────────────────────────────────────────────────────────────
function AllOrdersTab() {
  const showToast = useToast()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      let q = db.transactions().from('vbak')
        .select('order_id, kunnr, status, payment_status, paid_amount, order_type, created_at, vbap(line_total)')
        .eq('status', 'CONFIRMED')
        .order('created_at', { ascending: false })
      if (dateFrom) q = q.gte('created_at', dateFrom)
      if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59')
      const { data, error } = await q
      if (error) { showToast(error.message, 'error'); return }

      // Batch-fetch customer names
      const kunnrs = [...new Set((data || []).map(o => o.kunnr).filter(Boolean))]
      let custMap = {}
      if (kunnrs.length) {
        const { data: custs } = await db.customers().from('kna1').select('kunnr, name').in('kunnr', kunnrs)
        custMap = Object.fromEntries((custs || []).map(c => [c.kunnr, c.name]))
      }

      const orders = (data || []).map(o => ({
        ...o,
        customer_name: custMap[o.kunnr] || '—',
        order_total: (o.vbap || []).reduce((s, l) => s + parseFloat(l.line_total || 0), 0),
      }))
      setOrders(orders)
    } catch (err) { showToast(err.message || 'Could not load orders', 'error') } finally { setLoading(false) }
  }, [dateFrom, dateTo, showToast])

  useEffect(() => { loadOrders() }, [loadOrders])

  function clearFilters() { setQuery(''); setTypeFilter('ALL'); setDateFrom(''); setDateTo('') }

  const filtered = orders.filter(o => {
    if (typeFilter !== 'ALL' && o.order_type !== typeFilter) return false
    if (!query) return true
    const q = query.toLowerCase()
    return Object.values(o).some(v => String(v ?? '').toLowerCase().includes(q))
  })

  const totalRevenue = filtered.reduce((s, o) => {
    const amt = parseFloat(o.order_total || 0)
    return o.order_type === 'R' ? s - amt : s + amt
  }, 0)

  function payBadge(ps) {
    const map = { PAID: 'paid', PENDING: 'pending', CANCELLED: 'cancelled', PARTIALLY_PAID: 'partial' }
    const lbl = ps === 'PARTIALLY_PAID' ? 'Partial' : (ps || '—')
    return <span className={`badge badge-${map[ps] || ''}`}>{lbl}</span>
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>All Orders</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Search, view and cancel confirmed sales orders.</p>
      </div>

      <div className="toolbar">
        <div className="form-group" style={{ minWidth: 220 }}>
          <label>Search</label>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input placeholder="Order ID, KUNNR, name…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: 'var(--card)', color: 'var(--ink)' }}>
            <option value="ALL">All Types</option>
            <option value="S">Sales Only</option>
            <option value="R">Returns Only</option>
          </select>
        </div>
        <div className="form-group">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: 13 }} />
        </div>
        <div className="form-group">
          <label>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: 13 }} />
        </div>
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-end' }} onClick={clearFilters}>Clear</button>
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-end' }} onClick={loadOrders}>↺ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-pill">Orders <strong>{filtered.length}</strong></div>
        <div className="stat-pill">Total Revenue <strong>{fmt(totalRevenue)}</strong></div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Order ID</th><th>Customer</th><th>KUNNR</th><th>Date</th>
              <th>Type</th><th>Payment</th><th className="right">Total</th><th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={8}><span className="spinner" /> Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={8}>No orders found.</td></tr>
            ) : filtered.map(o => (
              <tr key={o.order_id}>
                <td><span className="mono">{o.order_id}</span></td>
                <td>{o.customer_name || '—'}</td>
                <td><span className="mono">{o.kunnr}</span></td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtD(o.created_at)}</td>
                <td><span className={`badge badge-${o.order_type === 'R' ? 'return' : 'sale'}`}>{o.order_type === 'R' ? 'Return' : 'Sale'}</span></td>
                <td>{payBadge(o.payment_status)}</td>
                <td className="right"><strong>{fmt(o.order_total)}</strong></td>
                <td className="right">
                  <div className="actions">
                    <button className="action-btn btn-view-sm" onClick={() => navigate(`/invoice?order_id=${o.order_id}`)}>View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Returns ───────────────────────────────────────────────────────────────────
function ReturnsTab() {
  const showToast = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [orderIdInput, setOrderIdInput] = useState('')
  const [retCustQuery, setRetCustQuery] = useState('')
  const [retFrom, setRetFrom] = useState('')
  const [retTo, setRetTo] = useState('')
  const [matchingOrders, setMatchingOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderLines, setOrderLines] = useState([])
  const [returnItems, setReturnItems] = useState([])
  const [retReason, setRetReason] = useState('')
  const [retNotes, setRetNotes] = useState('')
  const [reasons, setReasons] = useState([])
  const retCustRef = useRef(null)
  const [retCustResults, setRetCustResults] = useState([])
  const [retKunnr, setRetKunnr] = useState('')
  const [retCustDiscPct, setRetCustDiscPct] = useState(0)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    db.transactions().from('return_reasons').select('*')
      .then(({ data }) => setReasons(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load return reasons:', err.message))
  }, [])

  async function fetchCustDiscForOrder(kunnr, orderDate) {
    try {
      const day = (orderDate || '').slice(0, 10) // YYYY-MM-DD
      const { data: cdRows } = await db.pricing().from('customer_discount').select('*')
        .eq('kunnr', kunnr).lte('valid_from', day).or(`valid_to.is.null,valid_to.gte.${day}`)
        .order('valid_from', { ascending: false }).limit(1)
      return cdRows?.[0]?.discount_pct ? parseFloat(cdRows[0].discount_pct) : 0
    } catch { return 0 }
  }

  async function fetchReturnOrder() {
    if (!orderIdInput.trim()) return
    try {
      const { data, error } = await db.transactions().from('vbak')
        .select('*, vbap(*)')
        .eq('order_id', orderIdInput.trim())
        .single()
      if (error || !data) return showToast('Order not found', 'error')
      const lines = data.vbap || []
      setSelectedOrder(data)
      setOrderLines(lines)
      setReturnItems(lines.map(l => ({ ...l, return_qty: 0, selected: false })))
      const pct = await fetchCustDiscForOrder(data.kunnr, data.created_at)
      setRetCustDiscPct(pct)
      setStep(2)
    } catch (err) { showToast(err.message || 'Could not fetch order', 'error') }
  }

  async function searchReturnCustomer(q) {
    try {
      const { data } = await db.customers().from('kna1').select('kunnr, name, number')
        .or(`name.ilike.%${q}%,number.ilike.%${q}%,kunnr.ilike.%${q}%`).limit(10)
      return data || []
    } catch { return [] }
  }

  async function searchOrdersForReturn() {
    if (!retKunnr) return showToast('Select a customer first', 'error')
    try {
      let query = db.transactions().from('vbak')
        .select('order_id, kunnr, order_type, payment_status, created_at, vbap(line_total)')
        .eq('kunnr', retKunnr)
        .eq('order_type', 'S')
        .eq('status', 'CONFIRMED')
        .neq('payment_status', 'CANCELLED')
        .order('created_at', { ascending: false })
      if (retFrom) query = query.gte('created_at', retFrom)
      if (retTo) query = query.lte('created_at', retTo + 'T23:59:59')
      const { data, error } = await query
      if (error) { showToast(error.message, 'error'); return }
      setMatchingOrders((data || []).map(o => ({
        ...o,
        order_total: (o.vbap || []).reduce((s, l) => s + parseFloat(l.line_total || 0), 0),
      })))
    } catch { showToast('Search failed', 'error') }
  }

  async function selectReturnOrder(orderId) {
    try {
      const { data, error } = await db.transactions().from('vbak')
        .select('*, vbap(*)')
        .eq('order_id', orderId)
        .single()
      if (error || !data) return showToast('Order not found', 'error')
      const lines = data.vbap || []
      setSelectedOrder(data)
      setOrderLines(lines)
      setReturnItems(lines.map(l => ({ ...l, return_qty: 0, selected: false })))
      const pct = await fetchCustDiscForOrder(data.kunnr, data.created_at)
      setRetCustDiscPct(pct)
      setStep(2)
    } catch (err) { showToast(err.message || 'Could not fetch order', 'error') }
  }

  function goStep3() {
    const selected = returnItems.filter(i => i.selected && i.return_qty > 0)
    if (!selected.length) return showToast('Select at least one item to return', 'error')
    if (!retReason) return showToast('Return reason required', 'error')
    setStep(3)
  }

  async function confirmReturn() {
    if (confirming) return
    setConfirming(true)
    try {
      const items = returnItems.filter(i => i.selected && i.return_qty > 0)
      const returnItemsMapped = items.map(i => {
        const origLineTotal = parseFloat(i.line_total || 0)
        const origQty = parseFloat(i.quantity || 1)
        const perUnitTotal = origQty > 0 ? origLineTotal / origQty : 0
        return {
          matnr: i.matnr,
          quantity: i.return_qty,
          price: parseFloat(i.price || i.effective_price || i.sales_price || i.mrp || 0),
          mrp: parseFloat(i.mrp || 0),
          discount_pct: parseFloat(i.discount_pct || 0),
          gst_rate: parseFloat(i.gst_rate || 0),
          line_total: perUnitTotal * i.return_qty,   // proportional share of original discounted line_total
        }
      })
      const { data: retId, error } = await supabase.rpc('place_return', {
        p_original_order_id: selectedOrder.order_id,
        p_items: returnItemsMapped,
        p_reason: retReason,
      })
      if (error) { showToast(error.message, 'error'); return }
      showToast(`✅ Return ${retId} created`)
      navigate(`/invoice?order_id=${retId}`)
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    } finally {
      setConfirming(false)
    }
  }

  const retSelected = returnItems.filter(i => i.selected && i.return_qty > 0)
  const retTotals = retSelected.reduce((acc, i) => {
    // Use order-time price; fall back through effective_price chain
    const unitPrice = parseFloat(i.price || i.effective_price || i.sales_price || i.mrp || 0)
    const prodDiscPct = parseFloat(i.discount_pct || 0)
    const afterProdDisc = unitPrice * (1 - prodDiscPct / 100)
    const gst = parseFloat(i.gst_rate || 0) / 100
    const base = afterProdDisc / (1 + gst)
    acc.subtotal += base * i.return_qty
    acc.tax += (afterProdDisc - base) * i.return_qty
    acc.prodDisc += (unitPrice - afterProdDisc) * i.return_qty
    acc.gross += afterProdDisc * i.return_qty
    return acc
  }, { subtotal: 0, tax: 0, prodDisc: 0, gross: 0 })
  const retCustDiscAmt = retTotals.gross * retCustDiscPct / 100
  const retTotal = retTotals.gross - retCustDiscAmt

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>Returns</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Create a return order linked to an original sales order.</p>
      </div>
      <StepBar step={step} labels={['Find Order', 'Select Items', 'Confirm']} />

      {step === 1 && (
        <div className="card">
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 4 }}>Find Original Order</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Enter the order ID directly, or search by customer and date range.</p>

          <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>Option A — Search or Enter Order ID</div>
            <div style={{ maxWidth: 500 }}>
              <SearchDropdown
                placeholder="Type order ID or KUNNR to search…"
                onSearch={async q => { try { const { data } = await db.transactions().from('vbak').select('order_id, kunnr, created_at, vbap(line_total)').or(`order_id.ilike.%${q}%,kunnr.ilike.%${q}%`).eq('order_type', 'S').eq('status', 'CONFIRMED').limit(10); return (data || []).map(o => ({ ...o, order_total: (o.vbap || []).reduce((s,l) => s + parseFloat(l.line_total||0), 0) })) } catch { return [] } }}
                onSelect={o => selectReturnOrder(o.order_id)}
                renderItem={o => (
                  <div>
                    <div className="sri-name"><span className="sri-kunnr">{o.order_id}</span> {o.customer_name}</div>
                    <div className="sri-detail">{fmtD(o.created_at)} · {fmt(o.order_total)}</div>
                  </div>
                )}
                getLabelText={o => o.order_id}
                width="100%"
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                Or enter the exact ID: <input value={orderIdInput} onChange={e => setOrderIdInput(e.target.value)} placeholder="S100001" style={{ width: 120, marginLeft: 6, padding: '4px 8px', fontSize: 12 }} onKeyDown={e => e.key === 'Enter' && fetchReturnOrder()} />
                <button className="btn btn-ghost" onClick={fetchReturnOrder} style={{ marginLeft: 6, fontSize: 12, padding: '5px 10px' }}>Go →</button>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>Option B — Search by Customer & Date</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px auto', gap: 10, alignItems: 'flex-end', maxWidth: 700 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Customer</label>
                <SearchDropdown
                  placeholder="Name or KUNNR…"
                  onSearch={searchReturnCustomer}
                  onSelect={c => setRetKunnr(c.kunnr)}
                  renderItem={c => (
                    <div>
                      <div className="sri-name">{c.name} <span className="sri-kunnr">{c.kunnr}</span></div>
                    </div>
                  )}
                  getLabelText={c => `${c.name} (${c.kunnr})`}
                  width="100%"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>From Date</label>
                <input type="date" value={retFrom} onChange={e => setRetFrom(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>To Date</label>
                <input type="date" value={retTo} onChange={e => setRetTo(e.target.value)} style={{ width: '100%' }} />
              </div>
              <button className="btn btn-primary" onClick={searchOrdersForReturn}>Search →</button>
            </div>

            {matchingOrders.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Select an order:</div>
                {matchingOrders.map(o => (
                  <div key={o.order_id} onClick={() => selectReturnOrder(o.order_id)} style={{
                    padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)',
                    marginBottom: 8, cursor: 'pointer', background: 'var(--card)', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span><strong>{o.order_id}</strong> · {fmtD(o.created_at)}</span>
                    <span>{fmt(o.order_total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>Select Items to Return</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Order: {selectedOrder?.order_id}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => setStep(1)} style={{ fontSize: 13 }}>← Back</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  {['Return', 'MATNR', 'Product', 'Orig Qty', 'Return Qty', 'Price', 'GST%'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Return' ? 'left' : h.includes('Qty') || h === 'Price' || h === 'GST%' ? 'right' : 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <input type="checkbox" checked={item.selected} onChange={e => {
                        const updated = [...returnItems]
                        updated[i] = { ...updated[i], selected: e.target.checked, return_qty: e.target.checked ? updated[i].quantity : 0 }
                        setReturnItems(updated)
                      }} />
                    </td>
                    <td style={{ padding: '10px 12px' }}><span className="mono">{item.matnr}</span></td>
                    <td style={{ padding: '10px 12px' }}>{item.brand || item.matnr}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.quantity}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <input type="number" min="0" max={item.quantity} value={item.return_qty} disabled={!item.selected}
                        onChange={e => {
                          const updated = [...returnItems]
                          updated[i] = { ...updated[i], return_qty: Math.min(parseInt(e.target.value) || 0, item.quantity) }
                          setReturnItems(updated)
                        }}
                        style={{ width: 60, textAlign: 'center', padding: '4px 8px', fontSize: 13 }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(item.price || item.effective_price || item.sales_price || item.mrp)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.gst_rate || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Return Reason *</label>
              <select value={retReason} onChange={e => setRetReason(e.target.value)} style={{ width: '100%' }}>
                <option value="">Select reason…</option>
                {reasons.map(r => <option key={r.reason || r} value={r.reason || r}>{r.reason || r}</option>)}
              </select>
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
              <input value={retNotes} onChange={e => setRetNotes(e.target.value)} placeholder="Any additional details…" style={{ width: '100%' }} />
            </div>
            <button className="btn btn-primary" onClick={goStep3}>Review Return →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ background: '#fff5f5', border: '1.5px solid #fecaca' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>↩️</span>
            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: 'var(--danger)' }}>Confirm Return Order</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Original Order: {selectedOrder?.order_id}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => setStep(2)} style={{ marginLeft: 'auto', fontSize: 13 }}>← Back</button>
          </div>

          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--accent2)', borderRadius: 8, fontSize: 13 }}>
            {retSelected.length} item(s) · Reason: <strong>{retReason}</strong>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 550 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  {['MATNR', 'Product', 'Qty', 'Price', 'Disc%', 'GST%', 'Refund'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: ['Qty', 'Price', 'Disc%', 'GST%', 'Refund'].includes(h) ? 'right' : 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retSelected.map((item, i) => {
                  const unitPrice = parseFloat(item.price || item.effective_price || item.sales_price || item.mrp || 0)
                  const prodDiscPct = parseFloat(item.discount_pct || 0)
                  const afterProdDisc = unitPrice * (1 - prodDiscPct / 100)
                  return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}><span className="mono">{item.matnr}</span></td>
                    <td style={{ padding: '10px 12px' }}>{item.brand || item.matnr}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.return_qty}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(unitPrice)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{prodDiscPct > 0 ? `${prodDiscPct}%` : '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.gst_rate || 0}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}><strong>{fmt(afterProdDisc * item.return_qty)}</strong></td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <span>Subtotal (excl GST)</span><span>{fmt(retTotals.subtotal)}</span>
              </div>
              {retTotals.prodDisc > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  <span>Product Discount</span><span style={{ color: 'var(--danger)' }}>−{fmt(retTotals.prodDisc)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <span>GST Refund</span><span>{fmt(retTotals.tax)}</span>
              </div>
              {retCustDiscPct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  <span>Customer Discount ({retCustDiscPct}%)</span><span style={{ color: 'var(--danger)' }}>−{fmt(retCustDiscAmt)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                <span>Total Refund</span><span>{fmt(retTotal)}</span>
              </div>
            </div>
          </div>

          <button className="btn" onClick={confirmReturn} disabled={confirming} style={{ background: 'var(--danger)', color: 'white', fontSize: 14, padding: '12px 28px', marginTop: 8 }}>
            {confirming ? '⏳ Confirming…' : '↩️ Confirm Return & Restock'}
          </button>
        </div>
      )}
    </>
  )
}

// ── Sales Pricing ─────────────────────────────────────────────────────────────
function PricingTab() {
  const showToast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pricingSeg, setPricingSeg] = useState('salesprice')
  const [showAddForm, setShowAddForm] = useState(false)
  const [spData, setSpData] = useState([])
  const [cdData, setCdData] = useState([])
  const [pdData, setPdData] = useState([])
  const [spFilter, setSpFilter] = useState('')
  const [cdFilter, setCdFilter] = useState('')
  const [pdFilter, setPdFilter] = useState('')
  const [spForm, setSpForm] = useState({ matnr: '', matnr_label: '', valid_from: '', valid_to: '', unit_price: '' })
  const [cdForm, setCdForm] = useState({ kunnr: '', kunnr_label: '', discount: '', valid_from: '', valid_to: '' })
  const [pdForm, setPdForm] = useState({ matnr: '', matnr_label: '', discount: '', valid_from: '', valid_to: '' })
  // edit state — null means not editing
  const [spEdit, setSpEdit] = useState(null)   // { id, matnr, brand, category, unit_price, valid_from, valid_to }
  const [cdEdit, setCdEdit] = useState(null)   // { id, kunnr, customer_name, discount_pct, valid_from, valid_to }
  const [pdEdit, setPdEdit] = useState(null)   // { id, matnr, brand, category, discount_pct, valid_from, valid_to }

  const loadSP = useCallback(async () => {
    try { const { data } = await db.pricing().from('sales_price').select('*').order('valid_from', { ascending: false }); setSpData(data || []) } catch (err) { showToast(err.message || 'Failed to load pricing data', 'error') }
  }, [showToast])
  const loadCD = useCallback(async () => {
    try { const { data } = await db.pricing().from('customer_discount').select('*').order('kunnr'); setCdData(data || []) } catch (err) { showToast(err.message || 'Failed to load pricing data', 'error') }
  }, [showToast])
  const loadPD = useCallback(async () => {
    try { const { data } = await db.pricing().from('product_discount').select('*').order('matnr'); setPdData(data || []) } catch (err) { showToast(err.message || 'Failed to load pricing data', 'error') }
  }, [showToast])

  useEffect(() => { loadSP(); loadCD(); loadPD() }, [loadSP, loadCD, loadPD])

  // Auto-open add form and pre-fill MATNR when arriving from "New Product" save
  useEffect(() => {
    const preMatnr = searchParams.get('matnr')
    if (preMatnr) {
      const today = new Date().toISOString().slice(0, 10)
      setSpForm(f => ({ ...f, matnr: preMatnr, matnr_label: preMatnr, valid_from: today, valid_to: '' }))
      setShowAddForm(true)
      // Remove the param so refresh doesn't re-open
      const next = new URLSearchParams(searchParams)
      next.delete('matnr')
      setSearchParams(next, { replace: true })
    }
  }, []) // eslint-disable-line

  async function searchMatnr(q) {
    try {
      const { data } = await db.inventory().from('mara').select('matnr, brand, category')
        .or(`matnr.ilike.%${q}%,brand.ilike.%${q}%`).limit(10)
      return data || []
    } catch { return [] }
  }
  async function searchCust(q) {
    try {
      const { data } = await db.customers().from('kna1').select('kunnr, name, number')
        .or(`name.ilike.%${q}%,number.ilike.%${q}%,kunnr.ilike.%${q}%`).limit(10)
      return data || []
    } catch { return [] }
  }

  async function saveSP() {
    if (!spForm.matnr || !spForm.unit_price || !spForm.valid_from) return showToast('MATNR, price and valid from required', 'error')
    try {
      const { error } = await db.pricing().from('sales_price').insert({
        matnr: spForm.matnr, unit_price: parseFloat(spForm.unit_price),
        valid_from: spForm.valid_from, valid_to: spForm.valid_to || null,
      })
      if (error) throw new Error(error.message)
      showToast('✅ Price saved')
      setSpForm({ matnr: '', matnr_label: '', valid_from: '', valid_to: '', unit_price: '' })
      setShowAddForm(false)
      loadSP()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function saveCD() {
    if (!cdForm.kunnr || !cdForm.discount || !cdForm.valid_from) return showToast('Customer, discount and valid from required', 'error')
    try {
      const { error } = await db.pricing().from('customer_discount').insert({
        kunnr: cdForm.kunnr, discount_pct: parseFloat(cdForm.discount),
        valid_from: cdForm.valid_from, valid_to: cdForm.valid_to || null,
      })
      if (error) throw new Error(error.message)
      showToast('✅ Discount saved')
      setCdForm({ kunnr: '', kunnr_label: '', discount: '', valid_from: '', valid_to: '' })
      setShowAddForm(false)
      loadCD()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function savePD() {
    if (!pdForm.matnr || !pdForm.discount || !pdForm.valid_from) return showToast('MATNR, discount and valid from required', 'error')
    try {
      const { error } = await db.pricing().from('product_discount').insert({
        matnr: pdForm.matnr, discount_pct: parseFloat(pdForm.discount),
        valid_from: pdForm.valid_from, valid_to: pdForm.valid_to || null,
      })
      if (error) throw new Error(error.message)
      showToast('✅ Discount saved')
      setPdForm({ matnr: '', matnr_label: '', discount: '', valid_from: '', valid_to: '' })
      setShowAddForm(false)
      loadPD()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function updateSP() {
    if (!spEdit.unit_price || !spEdit.valid_from) return showToast('Price and valid-from required', 'error')
    try {
      const { error } = await db.pricing().from('sales_price').update({
        unit_price: parseFloat(spEdit.unit_price), valid_from: spEdit.valid_from, valid_to: spEdit.valid_to || null,
      }).eq('id', spEdit.id)
      if (error) throw new Error(error.message)
      showToast('✅ Price updated')
      setSpEdit(null)
      loadSP()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function updateCD() {
    if (!cdEdit.discount_pct || !cdEdit.valid_from) return showToast('Discount and valid-from required', 'error')
    try {
      const { error } = await db.pricing().from('customer_discount').update({
        discount_pct: parseFloat(cdEdit.discount_pct), valid_from: cdEdit.valid_from, valid_to: cdEdit.valid_to || null,
      }).eq('id', cdEdit.id)
      if (error) throw new Error(error.message)
      showToast('✅ Discount updated')
      setCdEdit(null)
      loadCD()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function updatePD() {
    if (!pdEdit.discount_pct || !pdEdit.valid_from) return showToast('Discount and valid-from required', 'error')
    try {
      const { error } = await db.pricing().from('product_discount').update({
        discount_pct: parseFloat(pdEdit.discount_pct), valid_from: pdEdit.valid_from, valid_to: pdEdit.valid_to || null,
      }).eq('id', pdEdit.id)
      if (error) throw new Error(error.message)
      showToast('✅ Discount updated')
      setPdEdit(null)
      loadPD()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function deleteRecord(type, id) {
    if (!confirm('Delete this pricing record?')) return
    try {
      const tableMap = { 'sales-price': 'sales_price', 'customer-discount': 'customer_discount', 'product-discount': 'product_discount' }
      const tableName = tableMap[type]
      const { error } = await db.pricing().from(tableName).delete().eq('id', id)
      if (error) throw new Error(error.message)
      if (type === 'sales-price') loadSP()
      else if (type === 'customer-discount') loadCD()
      else loadPD()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  const filteredSP = spFilter ? spData.filter(r => JSON.stringify(r).toLowerCase().includes(spFilter.toLowerCase())) : spData
  const filteredCD = cdFilter ? cdData.filter(r => JSON.stringify(r).toLowerCase().includes(cdFilter.toLowerCase())) : cdData
  const filteredPD = pdFilter ? pdData.filter(r => JSON.stringify(r).toLowerCase().includes(pdFilter.toLowerCase())) : pdData

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>Sales Pricing</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Manage sales prices and discount tables.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="seg-group">
          {[
            { id: 'salesprice', label: '💲 Sales Price' },
            { id: 'custdiscount', label: '👤 Customer Discount' },
            { id: 'proddiscount', label: '🏷️ Product Discount' },
          ].map(s => (
            <button key={s.id} className={`seg-btn${pricingSeg === s.id ? ' active' : ''}`} onClick={() => { setPricingSeg(s.id); setShowAddForm(false) }}>{s.label}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(f => !f)} style={{ fontSize: 13, padding: '9px 18px' }}>
          {showAddForm ? '✕ Cancel' : '+ Add New'}
        </button>
      </div>

      {/* Sales Price */}
      {pricingSeg === 'salesprice' && (
        <>
          {showAddForm && (
            <div className="pricing-add-form open">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Add Sales Price</div>
              <div className="pricing-form-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Material</label>
                  <SearchDropdown placeholder="Search MATNR or brand…" onSearch={searchMatnr} onSelect={p => setSpForm(f => ({ ...f, matnr: p.matnr, matnr_label: `${p.matnr} - ${p.brand}` }))}
                    renderItem={p => <div><span className="sri-kunnr">{p.matnr}</span> {p.brand}</div>}
                    getLabelText={p => `${p.matnr} — ${p.brand}`} width="100%" />
                  {spForm.matnr && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Selected: {spForm.matnr}</div>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid From</label>
                  <input type="date" value={spForm.valid_from} onChange={e => setSpForm(f => ({ ...f, valid_from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid To (optional)</label>
                  <input type="date" value={spForm.valid_to} onChange={e => setSpForm(f => ({ ...f, valid_to: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Unit Price (₹)</label>
                  <input type="number" value={spForm.unit_price} onChange={e => setSpForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={saveSP} style={{ fontSize: 13, padding: '9px 16px' }}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setShowAddForm(false)} style={{ fontSize: 13, padding: '9px 16px' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {/* Edit form for Sales Price */}
          {spEdit && (
            <div className="pricing-add-form open" style={{ borderColor: 'var(--accent)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
                Edit Sales Price — <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{spEdit.matnr}</span>
                {spEdit.brand && <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{spEdit.brand} · {spEdit.category}</span>}
              </div>
              <div className="pricing-form-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid From</label>
                  <input type="date" value={spEdit.valid_from} onChange={e => setSpEdit(s => ({ ...s, valid_from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid To (leave blank = open)</label>
                  <input type="date" value={spEdit.valid_to && spEdit.valid_to !== '12319999' ? spEdit.valid_to : ''} onChange={e => setSpEdit(s => ({ ...s, valid_to: e.target.value || null }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Unit Price (₹)</label>
                  <input type="number" value={spEdit.unit_price} onChange={e => setSpEdit(s => ({ ...s, unit_price: e.target.value }))} min="0" step="0.01" />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={updateSP} style={{ fontSize: 13, padding: '9px 16px' }}>Update</button>
                  <button className="btn btn-ghost" onClick={() => setSpEdit(null)} style={{ fontSize: 13, padding: '9px 16px' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          <div className="pricing-toolbar">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Filter by Material</label>
              <input value={spFilter} onChange={e => setSpFilter(e.target.value)} placeholder="MATNR or brand…" style={{ width: 220 }} />
            </div>
            <button className="btn btn-ghost" onClick={loadSP} style={{ alignSelf: 'flex-end', fontSize: 13 }}>↺ Refresh</button>
          </div>
          <div className="table-card">
            <table>
              <thead><tr><th>MATNR</th><th>Brand</th><th>Category</th><th>Valid From</th><th>Valid To</th><th className="right">Unit Price</th><th></th></tr></thead>
              <tbody>
                {filteredSP.length === 0 ? <tr className="state-row"><td colSpan={7}>No sales prices found.</td></tr>
                  : filteredSP.map((r, i) => (
                    <tr key={i} style={spEdit && spEdit.id === r.id ? { background: 'rgba(var(--accent-rgb,201,168,76),0.06)' } : {}}>
                      <td><span className="mono">{r.matnr}</span></td>
                      <td>{r.brand || '—'}</td>
                      <td>{r.category || '—'}</td>
                      <td>{r.valid_from}</td>
                      <td>{r.valid_to === '12319999' || !r.valid_to ? 'Open' : r.valid_to}</td>
                      <td className="right"><strong>{fmt(r.unit_price)}</strong></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="action-btn" onClick={() => { setShowAddForm(false); setSpEdit({ ...r, valid_to: r.valid_to === '12319999' ? '' : (r.valid_to || '') }) }} style={{ marginRight: 6 }}>Edit</button>
                        <button className="action-btn btn-delete" onClick={() => deleteRecord('sales-price', r.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Customer Discount */}
      {pricingSeg === 'custdiscount' && (
        <>
          {showAddForm && (
            <div className="pricing-add-form open">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Add Customer Discount</div>
              <div className="pricing-form-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Customer</label>
                  <SearchDropdown placeholder="Search name or KUNNR…" onSearch={searchCust} onSelect={c => setCdForm(f => ({ ...f, kunnr: c.kunnr, kunnr_label: `${c.kunnr} - ${c.name}` }))}
                    renderItem={c => <div><span className="sri-kunnr">{c.kunnr}</span> {c.name}</div>}
                    getLabelText={c => `${c.kunnr} — ${c.name}`} width="100%" />
                  {cdForm.kunnr && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Selected: {cdForm.kunnr}</div>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Discount %</label>
                  <input type="number" value={cdForm.discount} onChange={e => setCdForm(f => ({ ...f, discount: e.target.value }))} placeholder="e.g. 10" min="0" max="100" step="0.1" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid From</label>
                  <input type="date" value={cdForm.valid_from} onChange={e => setCdForm(f => ({ ...f, valid_from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid To (optional)</label>
                  <input type="date" value={cdForm.valid_to} onChange={e => setCdForm(f => ({ ...f, valid_to: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={saveCD} style={{ fontSize: 13, padding: '9px 16px' }}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setShowAddForm(false)} style={{ fontSize: 13, padding: '9px 16px' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {/* Edit form for Customer Discount */}
          {cdEdit && (
            <div className="pricing-add-form open" style={{ borderColor: 'var(--accent)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
                Edit Customer Discount — <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{cdEdit.kunnr}</span>
                {cdEdit.customer_name && <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{cdEdit.customer_name}</span>}
              </div>
              <div className="pricing-form-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Discount %</label>
                  <input type="number" value={cdEdit.discount_pct} onChange={e => setCdEdit(s => ({ ...s, discount_pct: e.target.value }))} min="0" max="100" step="0.1" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid From</label>
                  <input type="date" value={cdEdit.valid_from} onChange={e => setCdEdit(s => ({ ...s, valid_from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid To (leave blank = open)</label>
                  <input type="date" value={cdEdit.valid_to && cdEdit.valid_to !== '12319999' ? cdEdit.valid_to : ''} onChange={e => setCdEdit(s => ({ ...s, valid_to: e.target.value || null }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={updateCD} style={{ fontSize: 13, padding: '9px 16px' }}>Update</button>
                  <button className="btn btn-ghost" onClick={() => setCdEdit(null)} style={{ fontSize: 13, padding: '9px 16px' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          <div className="pricing-toolbar">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Filter by Customer</label>
              <input value={cdFilter} onChange={e => setCdFilter(e.target.value)} placeholder="Name or KUNNR…" style={{ width: 220 }} />
            </div>
            <button className="btn btn-ghost" onClick={loadCD} style={{ alignSelf: 'flex-end', fontSize: 13 }}>↺ Refresh</button>
          </div>
          <div className="table-card">
            <table>
              <thead><tr><th>KUNNR</th><th>Customer Name</th><th className="right">Discount %</th><th>Valid From</th><th>Valid To</th><th></th></tr></thead>
              <tbody>
                {filteredCD.length === 0 ? <tr className="state-row"><td colSpan={6}>No customer discounts found.</td></tr>
                  : filteredCD.map((r, i) => (
                    <tr key={i} style={cdEdit && cdEdit.id === r.id ? { background: 'rgba(var(--accent-rgb,201,168,76),0.06)' } : {}}>
                      <td><span className="mono">{r.kunnr}</span></td>
                      <td>{r.customer_name || '—'}</td>
                      <td className="right"><strong>{r.discount_pct}%</strong></td>
                      <td>{r.valid_from}</td>
                      <td>{r.valid_to === '12319999' || !r.valid_to ? 'Open' : r.valid_to}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="action-btn" onClick={() => { setShowAddForm(false); setCdEdit({ ...r, valid_to: r.valid_to === '12319999' ? '' : (r.valid_to || '') }) }} style={{ marginRight: 6 }}>Edit</button>
                        <button className="action-btn btn-delete" onClick={() => deleteRecord('customer-discount', r.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Product Discount */}
      {pricingSeg === 'proddiscount' && (
        <>
          {showAddForm && (
            <div className="pricing-add-form open">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Add Product Discount</div>
              <div className="pricing-form-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Material</label>
                  <SearchDropdown placeholder="Search MATNR or brand…" onSearch={searchMatnr} onSelect={p => setPdForm(f => ({ ...f, matnr: p.matnr, matnr_label: `${p.matnr} - ${p.brand}` }))}
                    renderItem={p => <div><span className="sri-kunnr">{p.matnr}</span> {p.brand}</div>}
                    getLabelText={p => `${p.matnr} — ${p.brand}`} width="100%" />
                  {pdForm.matnr && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Selected: {pdForm.matnr}</div>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Discount %</label>
                  <input type="number" value={pdForm.discount} onChange={e => setPdForm(f => ({ ...f, discount: e.target.value }))} placeholder="e.g. 15" min="0" max="100" step="0.1" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid From</label>
                  <input type="date" value={pdForm.valid_from} onChange={e => setPdForm(f => ({ ...f, valid_from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid To (optional)</label>
                  <input type="date" value={pdForm.valid_to} onChange={e => setPdForm(f => ({ ...f, valid_to: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={savePD} style={{ fontSize: 13, padding: '9px 16px' }}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setShowAddForm(false)} style={{ fontSize: 13, padding: '9px 16px' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {/* Edit form for Product Discount */}
          {pdEdit && (
            <div className="pricing-add-form open" style={{ borderColor: 'var(--accent)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
                Edit Product Discount — <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{pdEdit.matnr}</span>
                {pdEdit.brand && <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{pdEdit.brand} · {pdEdit.category}</span>}
              </div>
              <div className="pricing-form-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Discount %</label>
                  <input type="number" value={pdEdit.discount_pct} onChange={e => setPdEdit(s => ({ ...s, discount_pct: e.target.value }))} min="0" max="100" step="0.1" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid From</label>
                  <input type="date" value={pdEdit.valid_from} onChange={e => setPdEdit(s => ({ ...s, valid_from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid To (leave blank = open)</label>
                  <input type="date" value={pdEdit.valid_to && pdEdit.valid_to !== '12319999' ? pdEdit.valid_to : ''} onChange={e => setPdEdit(s => ({ ...s, valid_to: e.target.value || null }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={updatePD} style={{ fontSize: 13, padding: '9px 16px' }}>Update</button>
                  <button className="btn btn-ghost" onClick={() => setPdEdit(null)} style={{ fontSize: 13, padding: '9px 16px' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          <div className="pricing-toolbar">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Filter by Material</label>
              <input value={pdFilter} onChange={e => setPdFilter(e.target.value)} placeholder="MATNR or brand…" style={{ width: 220 }} />
            </div>
            <button className="btn btn-ghost" onClick={loadPD} style={{ alignSelf: 'flex-end', fontSize: 13 }}>↺ Refresh</button>
          </div>
          <div className="table-card">
            <table>
              <thead><tr><th>MATNR</th><th>Brand</th><th>Category</th><th className="right">Discount %</th><th>Valid From</th><th>Valid To</th><th></th></tr></thead>
              <tbody>
                {filteredPD.length === 0 ? <tr className="state-row"><td colSpan={7}>No product discounts found.</td></tr>
                  : filteredPD.map((r, i) => (
                    <tr key={i} style={pdEdit && pdEdit.id === r.id ? { background: 'rgba(var(--accent-rgb,201,168,76),0.06)' } : {}}>
                      <td><span className="mono">{r.matnr}</span></td>
                      <td>{r.brand || '—'}</td>
                      <td>{r.category || '—'}</td>
                      <td className="right"><strong>{r.discount_pct}%</strong></td>
                      <td>{r.valid_from}</td>
                      <td>{r.valid_to === '12319999' || !r.valid_to ? 'Open' : r.valid_to}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="action-btn" onClick={() => { setShowAddForm(false); setPdEdit({ ...r, valid_to: r.valid_to === '12319999' ? '' : (r.valid_to || '') }) }} style={{ marginRight: 6 }}>Edit</button>
                        <button className="action-btn btn-delete" onClick={() => deleteRecord('product-discount', r.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Sales() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'orders'

  function setTab(t) {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('tab', t)
      // Clear wizard state when switching away from new-order tab
      if (t !== 'new') { p.delete('step'); p.delete('kunnr') }
      return p
    })
  }

  return (
    <div className="page-layout">
      <Sidebar section="Sales" activeTab={tab} onTabChange={setTab} />
      <div className="main" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div className="topbar">
          <div className="topbar-left">
            <span className="page-title">Sales Order</span>
          </div>
        </div>
        <div className="sales-tabbar">
          {[
            { id: 'new',     label: '🧾 New Order' },
            { id: 'orders',  label: '📋 All Orders' },
            { id: 'returns', label: '↩️ Returns' },
            { id: 'pricing', label: '💰 Sales Pricing' },
          ].map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, padding: '32px 40px', overflowX: 'hidden' }}>
          {tab === 'new' && <NewOrderTab />}
          {tab === 'orders' && <AllOrdersTab />}
          {tab === 'returns' && <ReturnsTab />}
          {tab === 'pricing' && <PricingTab />}
        </div>
      </div>
    </div>
  )
}
