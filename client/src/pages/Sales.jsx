import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'

const TAX_RATE = 0.18
const fmt = n => '₹' + parseFloat(n || 0).toFixed(2)

// ── Step indicator ──────────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <div className="steps">
      {[1, 2, 3].map((n, i) => {
        const label = ['Customer', 'Add Products', 'Cart & Place Order'][i]
        const cls = n < step ? 'step done' : n === step ? 'step active' : 'step'
        return (
          <span key={n} style={{ display: 'contents' }}>
            <div className={cls}>
              <div className="step-num">{n < step ? '✓' : n}</div>
              <span>{label}</span>
            </div>
            {n < 3 && <div className={`step-line${n < step ? ' done' : ''}`} />}
          </span>
        )
      })}
    </div>
  )
}

// ── Step 1: Customer lookup ─────────────────────────────────────────────────
function CustomerView({ onCustomerSet }) {
  const showToast = useToast()
  const [kunnrInput, setKunnrInput] = useState('')
  const [result, setResult] = useState(null)

  async function lookup() {
    const kunnr = kunnrInput.trim()
    if (!kunnr) return
    try {
      const res = await fetch(`/customers/${kunnr}`)
      if (!res.ok) { setResult(null); return showToast('Customer not found', 'error') }
      const data = await res.json()
      setResult(data)
    } catch {
      showToast('Server error', 'error')
    }
  }

  return (
    <div className="card">
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 4 }}>Enter Customer ID</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Enter the 6-digit KUNNR to start a new sales order.</div>
      <div className="input-row">
        <div className="form-group">
          <label>KUNNR</label>
          <input
            value={kunnrInput}
            onChange={e => setKunnrInput(e.target.value)}
            placeholder="e.g. 100001"
            maxLength={6}
            style={{ width: 180 }}
            onKeyDown={e => e.key === 'Enter' && lookup()}
          />
        </div>
        <button className="btn btn-primary" onClick={lookup}>Look Up →</button>
      </div>
      {result && (
        <div style={{ marginTop: 20, padding: 20, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{result.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                KUNNR: <span className="mono">{result.kunnr}</span>
                {result.number && ` · ${result.number}`}
                {result.email && ` · ${result.email}`}
              </div>
              {result.gstin && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>GSTIN: {result.gstin}</div>}
            </div>
            <button className="btn btn-primary" onClick={() => onCustomerSet(result)}>
              Select &amp; Continue →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Product selection ───────────────────────────────────────────────
function ProductsView({ kunnr, cartItems, onCartUpdated }) {
  const showToast = useToast()
  const [brands, setBrands] = useState([])
  const [filterBrand, setFilterBrand] = useState('')
  const [matnrFilter, setMatnrFilter] = useState('')
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [addQty, setAddQty] = useState(1)

  useEffect(() => {
    fetch('/inventory/meta/brands').then(r => r.json()).then(setBrands).catch(() => {})
  }, [])

  const loadProducts = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterBrand) params.set('brand', filterBrand)
    const res = await fetch(`/inventory/meta/items?${params}`)
    setProducts(await res.json())
    setSelectedProduct(null)
  }, [filterBrand])

  useEffect(() => { loadProducts() }, [loadProducts])

  const filtered = matnrFilter
    ? products.filter(p => p.matnr.toLowerCase().includes(matnrFilter.toLowerCase()))
    : products

  async function addToCart() {
    if (!selectedProduct) return showToast('Select a product first', 'error')
    const qty = parseInt(addQty) || 1
    try {
      const res = await fetch(`/order/temp/${kunnr}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matnr: selectedProduct.matnr, quantity: qty, price: selectedProduct.price }),
      })
      if (!res.ok) throw new Error('Failed to add to cart')
      showToast(`✅ ${selectedProduct.brand} added to cart`)
      setSelectedProduct(null)
      setAddQty(1)
      onCartUpdated()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 4 }}>Add Products</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Filter by brand, then select a product to add to cart.</div>
        <div className="filter-row">
          <div className="form-group">
            <label>Brand</label>
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
              <option value="">All Brands</option>
              {brands.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Filter by MATNR</label>
            <div className="search-wrap" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input value={matnrFilter} onChange={e => setMatnrFilter(e.target.value)} placeholder="Type MATNR to filter…" style={{ width: '100%', paddingLeft: 36 }} />
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p>No products found.</p>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map(p => (
            <div
              key={p.matnr}
              className={`product-card ${selectedProduct?.matnr === p.matnr ? 'selected' : ''}`}
              onClick={() => setSelectedProduct(selectedProduct?.matnr === p.matnr ? null : p)}
            >
              {selectedProduct?.matnr === p.matnr && <div className="selected-tick">✓</div>}
              <span className="p-matnr">{p.matnr}</span>
              <div className="p-brand">{p.brand || '—'}</div>
              <div className="p-meta">{[p.brandfamily, p.size, p.gender].filter(Boolean).join(' · ')}</div>
              <div className="p-price">{fmt(p.price)}</div>
              <div className="p-qty">Stock: {p.quantity ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="add-bar">
        <div className="selected-info">
          {selectedProduct
            ? <><strong>{selectedProduct.brand}</strong> — {selectedProduct.brandfamily} {selectedProduct.size} — {fmt(selectedProduct.price)}</>
            : 'No product selected'}
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Qty</label>
          <input className="qty-input" type="number" min="1" value={addQty} onChange={e => setAddQty(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={addToCart}>Add to Cart 🛒</button>
      </div>
    </>
  )
}

// ── Step 3: Cart ────────────────────────────────────────────────────────────
function CartView({ kunnr, cartItems, onBack, onOrderPlaced, onCartUpdated }) {
  const showToast = useToast()

  async function removeItem(id) {
    try {
      await fetch(`/order/temp/${kunnr}/item/${id}`, { method: 'DELETE' })
      onCartUpdated()
    } catch {
      showToast('Failed to remove item', 'error')
    }
  }

  async function placeOrder() {
    if (cartItems.length === 0) return showToast('Cart is empty', 'error')
    try {
      const res = await fetch(`/order/place/${kunnr}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to place order')
      onOrderPlaced(data.order_id)
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax = subtotal * TAX_RATE
  const grand = subtotal + tax

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back to Products</button>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>Your Cart</h1>
      </div>

      <div className="cart-table-wrap">
        <table>
          <thead>
            <tr>
              <th>MATNR</th><th>Brand</th><th>Details</th>
              <th className="right">Unit Price</th><th className="right">Qty</th>
              <th className="right">Gross Price</th><th></th>
            </tr>
          </thead>
          <tbody>
            {cartItems.length === 0 ? (
              <tr className="state-row"><td colSpan={7}>Your cart is empty.</td></tr>
            ) : cartItems.map(item => (
              <tr key={item.id}>
                <td><span className="mono">{item.matnr}</span></td>
                <td><strong>{item.brand || '—'}</strong></td>
                <td style={{ color: 'var(--muted)', fontSize: 13 }}>{[item.brandfamily, item.size].filter(Boolean).join(' · ')}</td>
                <td className="right">{fmt(item.price)}</td>
                <td className="right">{item.quantity}</td>
                <td className="right">{fmt(item.price * item.quantity)}</td>
                <td>
                  <button className="action-btn btn-delete" onClick={() => removeItem(item.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Review your items before placing the order.<br />
            Once placed, a confirmed order number will be assigned.
          </p>
        </div>
        <div className="totals-card">
          <div className="totals-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="totals-row tax"><span>GST (18%)</span><span>{fmt(tax)}</span></div>
          <div className="totals-row grand"><span>Total</span><span>{fmt(grand)}</span></div>
          <button className="place-order-btn" onClick={placeOrder}>✅ Place Order</button>
        </div>
      </div>
    </>
  )
}

// ── Main Sales page ─────────────────────────────────────────────────────────
export default function Sales() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [step, setStep] = useState(1)
  const [customer, setCustomer] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [showCart, setShowCart] = useState(false)

  const loadCart = useCallback(async (kunnr) => {
    if (!kunnr) return
    try {
      const res = await fetch(`/order/temp/${kunnr}`)
      const data = await res.json()
      setCartItems(data?.items || [])
    } catch {}
  }, [])

  function handleCustomerSet(cust) {
    setCustomer(cust)
    setStep(2)
    setShowCart(false)
    loadCart(cust.kunnr)
  }

  function handleCartUpdated() {
    loadCart(customer.kunnr)
  }

  function handleOrderPlaced(orderId) {
    navigate(`/invoice?order_id=${orderId}`)
  }

  function goToStep1() {
    setCustomer(null)
    setCartItems([])
    setStep(1)
    setShowCart(false)
  }

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="page-layout">
      <Sidebar section="Sales" onTabChange={goToStep1} />
      <div className="main" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>Sales Order</span>
            {customer && (
              <div className="customer-chip">
                <span>👤</span>
                <span style={{ fontFamily: 'Courier New', fontSize: 12 }}>{customer.kunnr}</span>
                <span>{customer.name}</span>
              </div>
            )}
          </div>
          {customer && cartCount > 0 && (
            <button className="cart-btn" onClick={() => { setShowCart(true); setStep(3) }}>
              🛒 Cart
              <span className="cart-badge">{cartCount}</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '36px 40px', overflowY: 'auto' }}>
          <StepBar step={step} />
          {step === 1 && <CustomerView onCustomerSet={handleCustomerSet} />}
          {step === 2 && (
            <ProductsView
              kunnr={customer.kunnr}
              cartItems={cartItems}
              onCartUpdated={handleCartUpdated}
            />
          )}
          {step === 3 && (
            <CartView
              kunnr={customer.kunnr}
              cartItems={cartItems}
              onBack={() => { setShowCart(false); setStep(2) }}
              onOrderPlaced={handleOrderPlaced}
              onCartUpdated={handleCartUpdated}
            />
          )}
        </div>
      </div>
    </div>
  )
}
