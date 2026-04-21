# Customer Groups — Design Spec

**Date:** 2026-04-21  
**Status:** Approved

---

## Overview

Group customers together (e.g., friend circles, office colleagues) so the store can warn the salesperson when a product being added to a sale has already been bought — or is of the same brand+category — by another member of the same group. Goal: avoid selling identical or similar designs to friends in the same social circle.

Conflicts are **warnings only** — the salesperson always retains the ability to proceed.

---

## Feature Summary

- **Groups page** (new sidebar entry) — create, rename, delete groups; add/remove members
- **CustomerDetail card** — shows which groups a customer belongs to; allows adding to / leaving groups
- **Sales conflict check** — when adding a product to a cart, warns if a groupmate has bought the same or similar item

---

## Data Model

### `groups.db` (new SQLite database)

```sql
CREATE TABLE IF NOT EXISTS customer_groups (
  group_id   TEXT PRIMARY KEY,   -- "G100000", "G100001", …
  name       TEXT NOT NULL,
  notes      TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id   TEXT NOT NULL REFERENCES customer_groups(group_id) ON DELETE CASCADE,
  kunnr      TEXT NOT NULL,      -- references kna1.kunnr in customers.db
  PRIMARY KEY (group_id, kunnr)
);
```

`group_id` is auto-generated using the same `nextId()` pattern as `kunnr`/`matnr`, seeded at `G100000`.  
A customer can be a member of multiple groups (multiple rows in `group_members` with different `group_id`s).  
Deleting a group removes all its member rows via `ON DELETE CASCADE`.

---

## Server API

All routes registered in `server.js`. `/groups/conflict-check` is registered **before** `/groups/:id` to prevent `conflict-check` being matched as a group ID.

| Method | Route | Body / Query | Description |
|---|---|---|---|
| `GET` | `/groups` | — | All groups with member count |
| `POST` | `/groups` | `{name, notes}` | Create group, returns `{group_id}` |
| `PUT` | `/groups/:id` | `{name, notes}` | Rename / update notes |
| `DELETE` | `/groups/:id` | — | Delete group + members |
| `GET` | `/groups/:id/members` | — | Member list with customer names (joined from `customers.db`) |
| `POST` | `/groups/:id/members` | `{kunnr}` | Add member |
| `DELETE` | `/groups/:id/members/:kunnr` | — | Remove member |
| `GET` | `/customers/:kunnr/groups` | — | Groups this customer belongs to |
| `GET` | `/groups/conflict-check` | `?kunnr=&matnr=` | Conflict result (see below) |

---

## Conflict Check Logic

`GET /groups/conflict-check?kunnr=X&matnr=Y`

Runs entirely in Node.js (no cross-DB SQL joins):

1. **Find groupmates** — query `groups.db` for all `kunnr` who share any group with the buyer; exclude the buyer themselves.
2. **Lookup product** — get `brand` + `category` for `matnr` from `inventory.db`.
3. **Exact match** — for each groupmate, check `transactions.db` (`vbap` JOIN `vbak` WHERE `status NOT IN ('TEMP','CANCELLED')`) for this exact `matnr`.
4. **Style match** — find all `matnr`s with the same `brand` + `category` from `inventory.db`; check if any groupmate bought any of them in completed (non-TEMP, non-CANCELLED) orders.

### Response shape

```json
{
  "exactMatch": [
    { "kunnr": "100001", "name": "Samay Raina", "order_id": "S100005", "group_name": "Office Gang" }
  ],
  "styleMatch": [
    { "kunnr": "100002", "name": "Shekhar", "matnr": "100034", "brand": "Boss", "category": "Tops", "group_name": "Office Gang" }
  ]
}
```

Both arrays empty → no conflict, silent add.

### Behaviour in `Sales.jsx` `addToCart()`

- Call conflict check before adding to cart.
- If `exactMatch` is non-empty → amber warning toast listing groupmates; **item still added**.
- If `styleMatch` is non-empty (and no exact match) → amber warning toast; **item still added**.
- If both → single combined amber toast.
- No conflicts → add silently as before.

Toast format:  
- Exact: *"⚠️ Samay Raina (Office Gang) already bought this exact item"*  
- Style: *"⚠️ Shekhar (Office Gang) bought a Boss Top — similar style"*

---

## UI

### Groups Page (`client/src/pages/Groups.jsx`)

Follows the existing Sidebar + main-content pattern.

**Sidebar tabs:**
- 👥 View Groups
- ➕ New Group

**View Groups tab:**
- List of group cards, one per group, showing name + member count
- Click to expand: reveals member list with avatar initials, name, KUNNR badge, and ✕ remove button
- Search-customer input + Add button at the bottom of expanded card to add new members
- Edit (rename) and Delete buttons on each group header

**New Group tab:**
- Simple form: Name (required) + Notes (optional) + Save button

### CustomerDetail Groups Card (`client/src/pages/CustomerDetail.jsx`)

New card in the customer detail layout (positioned after the existing cards):

- Header: "👥 Groups"
- Body: chips for each group this customer belongs to; each chip has an ✕ to leave the group
- Footer: dropdown of all existing groups (excluding ones already joined) + Add button

### Sidebar (`client/src/components/Sidebar.jsx`)

New nav entry `{ href: '/groups', icon: '👥', label: 'Customer Groups' }` inserted between Customers and Inventory in `ALL_NAV`.

---

## Files Changed

| File | Change |
|---|---|
| `server.js` | Open `groups.db`, create tables on startup, register 9 routes |
| `client/vite.config.js` | Add `/groups` proxy entry |
| `client/src/App.jsx` | Add `<Route path="/groups" element={<Groups />} />` |
| `client/src/components/Sidebar.jsx` | Add Groups nav entry between Customers and Inventory |
| `client/src/pages/Groups.jsx` | **new** — groups management page |
| `client/src/pages/CustomerDetail.jsx` | Add Groups card |
| `client/src/pages/Sales.jsx` | Call `/groups/conflict-check` in `addToCart()`, show amber toast |

---

## Out of Scope

- Conflict checking on historical order edits (check only happens at point of sale)
- Group-level discount or pricing rules
- Notifications to customers about group conflicts
- Merging groups
