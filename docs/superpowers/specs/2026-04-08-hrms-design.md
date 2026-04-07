# HRMS Module Design Spec
**Date:** 2026-04-08  
**Project:** Fat Closet Store Manager  
**Status:** Approved

---

## Overview

Add a Human Resource Management System (HRMS) as a new section of the Fat Closet Store Manager. The system is India-specific, targeting small retail store staff management. It covers employee master records, monthly payroll tracking, daily attendance, and configuration of departments and designations.

Architecture follows the existing pattern: a single route `/hr` renders `HR.jsx` with a sidebar and tabs — exactly like Customers, Inventory, and Buyers.

---

## 1. Database Schema — `hr.db`

A new SQLite database opened via the existing `openDb()` helper in `server.js`.

### `employees`
```sql
CREATE TABLE IF NOT EXISTS employees (
  emp_id       TEXT PRIMARY KEY,          -- EMP001, EMP002…
  name         TEXT NOT NULL,
  pan          TEXT,                       -- AAAAA9999A format
  aadhar       TEXT,                       -- 12 digits
  salary       REAL    DEFAULT 0,          -- monthly gross (₹)
  start_date   TEXT,                       -- YYYY-MM-DD
  end_date     TEXT,                       -- YYYY-MM-DD, null if active
  pay_mode     TEXT    DEFAULT 'cash',     -- 'cash' | 'bank'
  salary_day   INTEGER,                    -- 1–28: day of month salary is paid
  department   TEXT,                       -- references departments.name
  designation  TEXT,                       -- references designations.name
  phone        TEXT,
  address      TEXT,
  status       TEXT    DEFAULT 'active'    -- 'active' | 'terminated'
);
```

### `departments`
```sql
CREATE TABLE IF NOT EXISTS departments (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);
```

### `designations`
```sql
CREATE TABLE IF NOT EXISTS designations (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);
```

### `salary_headers`
```sql
CREATE TABLE IF NOT EXISTS salary_headers (
  header_id  TEXT PRIMARY KEY,   -- SH001…
  emp_id     TEXT NOT NULL,
  month      TEXT NOT NULL,      -- YYYY-MM
  total_paid REAL DEFAULT 0,     -- recomputed on every line change
  notes      TEXT,
  created_at TEXT,
  UNIQUE(emp_id, month)
);
```

### `salary_lines`
```sql
CREATE TABLE IF NOT EXISTS salary_lines (
  line_id      TEXT PRIMARY KEY,  -- SL001…
  header_id    TEXT NOT NULL,
  payment_type TEXT NOT NULL,     -- 'salary' | 'advance' | 'bonus' | 'deduction'
  amount       REAL NOT NULL,
  pay_date     TEXT NOT NULL,     -- YYYY-MM-DD
  pay_mode     TEXT NOT NULL,     -- 'cash' | 'bank'
  notes        TEXT
);
```

### `attendance`
```sql
CREATE TABLE IF NOT EXISTS attendance (
  att_id   TEXT PRIMARY KEY,     -- ATT001…
  emp_id   TEXT NOT NULL,
  att_date TEXT NOT NULL,        -- YYYY-MM-DD
  status   TEXT NOT NULL,        -- 'full' | 'half' | 'holiday' | 'absent'
  notes    TEXT,
  UNIQUE(emp_id, att_date)       -- INSERT OR REPLACE for re-uploads
);
```

**Auto-ID pattern:** All primary keys follow the existing `nextId()` helper in `server.js` with prefix-based generation (EMP, SH, SL, ATT).

---

## 2. Page Structure

**Route:** `/hr`  
**Component:** `client/src/pages/HR.jsx`  
**Sidebar section:** `"HR"`

### Tabs

| Tab ID | Icon | Label | Purpose |
|--------|------|-------|---------|
| `add` | ➕ | Add Employee | Register a new employee |
| `view` | 👥 | Employees | List all; click row → ViewModal with Edit + Terminate |
| `payroll` | 💸 | Payroll | Select employee + month; view/add payment lines |
| `attendance` | 🗓️ | Attendance | Monthly grid, manual toggle, CSV upload/download |
| `config` | ⚙️ | Config | Manage departments and designations |

### Sidebar.jsx changes
- Add `HR` entry to `ALL_NAV`: `{ href: '/hr', icon: '👷', label: 'HR' }`
- Add `HR` key to `SECTION_TABS` with the 5 tabs above

### LandingPage.jsx changes
- Add 6th card: `{ to: '/hr', icon: '👷', label: 'HR', desc: 'Staff & payroll' }`
- Change grid from `repeat(5, 150px)` to `repeat(3, 160px)` so 6 cards wrap into two rows of 3

### App.jsx changes
- Import `HR` from `./pages/HR`
- Add `<Route path="/hr" element={<HR />} />`

---

## 3. Tab Designs

### Add Employee Tab
Fields (2-column form-grid):
- Name* (required)
- PAN (validated: `^[A-Z]{5}[0-9]{4}[A-Z]$`, auto-uppercased)
- Aadhar (validated: exactly 12 digits)
- Salary ₹ (number input)
- Start Date* (date, required, ≤ today)
- End Date (date, optional, ≥ start date)
- Pay Mode (radio/select: Cash | Bank)
- Salary Day (dropdown: 1–28)
- Department (dropdown populated from `/hr/departments`)
- Designation (dropdown populated from `/hr/designations`)
- Phone
- Address (full width)

Auto-assigned `emp_id` shown as badge (same pattern as Add Customer / Add Buyer).

### View Employees Tab
- Search bar (filter by name, emp_id, department, designation)
- Table columns: Emp ID · Name · Designation · Department · Salary · Pay Mode · Salary Day · Status
- Status badge: green `active`, red `terminated`
- Click any row → **ViewModal**: all fields displayed + Edit button (opens EditModal) + Terminate button (sets end_date to today and status to `terminated`)

### Payroll Tab
Two-panel layout:
1. **Left panel:** Employee search/select dropdown + month picker (YYYY-MM)
2. **Right panel (once employee + month selected):**
   - Header info: employee name, month, total net paid
   - Lines table: Type · Amount · Date · Mode · Notes · Delete
   - Running totals: Gross Paid / Deductions / **Net Pay** (green if positive, red if negative)
   - "Add Line" inline form: payment_type select, amount, pay_date, pay_mode, notes → Add button
   - Only one header per employee+month — if it already exists, open it

### Attendance Tab
- **Controls:** Month picker (YYYY-MM) + Employee filter (All / specific employee)
- **Grid:** Rows = employees, Columns = days 1–N of selected month
  - Cell cycle on click: `—` (absent) → `F` (full) → `H` (half) → `🎉` (holiday) → `—`
  - Future dates: greyed out, non-interactive
  - Saves immediately on cell click (POST/PUT to server)
- **CSV section** (below grid):
  - Drag-drop upload zone + "Download Template" button
  - Template columns: `emp_id, name, date (YYYY-MM-DD), status (full/half/holiday/absent), notes`
  - Template pre-fills `emp_id` and `name` for all active employees for the selected month; `status` and `notes` left blank
  - Upload summary log: rows inserted, rows updated, rows skipped (unknown emp_id), errors

### Config Tab
Two side-by-side cards (same pattern as Inventory Config):
- **Departments**: list with delete button per row + "Add Department" input + Add button; delete blocked if any active employee uses it
- **Designations**: same pattern

---

## 4. API Routes

All routes mounted on `server.js`, handled by `hrDb`.

### Employees
```
GET    /hr/employees              ?status=active|terminated|all (default: all)
GET    /hr/employees/:emp_id
GET    /hr/next-emp-id
POST   /hr/employees
PUT    /hr/employees/:emp_id
DELETE /hr/employees/:emp_id
```

### Payroll
```
GET    /hr/payroll/:emp_id                   all headers for employee
GET    /hr/payroll/:emp_id/:month            header + lines for YYYY-MM
POST   /hr/payroll                           create header { emp_id, month, notes }
POST   /hr/payroll/:header_id/lines          add line { payment_type, amount, pay_date, pay_mode, notes }
DELETE /hr/payroll/lines/:line_id            delete a line (recalculates header total_paid)
```

### Attendance
```
GET    /hr/attendance             ?emp_id=&month=YYYY-MM
POST   /hr/attendance             { emp_id, att_date, status, notes } — INSERT OR REPLACE
POST   /hr/attendance/bulk        array of records — INSERT OR REPLACE each
DELETE /hr/attendance/:att_id
```

### Config
```
GET    /hr/departments
POST   /hr/departments            { name }
DELETE /hr/departments/:id        — blocked if any employee.department references it

GET    /hr/designations
POST   /hr/designations           { name }
DELETE /hr/designations/:id       — blocked if any employee.designation references it
```

---

## 5. Validation Rules

### Client-side (with server mirror)
| Field | Rule |
|-------|------|
| PAN | `^[A-Z]{5}[0-9]{4}[A-Z]$` — input auto-uppercased, validated on blur and submit |
| Aadhar | Exactly 12 digits — displayed masked as `XXXX XXXX 1234` in ViewModal |
| Salary Day | Dropdown 1–28 only (avoids Feb 29/30/31 ambiguity) |
| Start Date | Required, must be ≤ today |
| End Date | Optional; must be ≥ start_date; setting it auto-sets status = 'terminated' |
| salary_lines.amount | Must be > 0 |
| attendance.status | Must be one of: `full`, `half`, `holiday`, `absent` |

### Business rules
- Payroll: one header per employee+month (`UNIQUE(emp_id, month)`); opening existing header shows current lines
- Payroll: `total_paid` = sum(salary+advance+bonus) − sum(deduction); recomputed server-side on every line add/delete
- Config delete: server returns 409 if department or designation is referenced by any employee; client shows error toast
- Attendance CSV upload: rows with unknown `emp_id` are skipped and listed in the upload summary log; valid rows use INSERT OR REPLACE

---

## 6. Files to Create / Modify

| Action | File |
|--------|------|
| Create | `client/src/pages/HR.jsx` |
| Modify | `client/src/App.jsx` — add `/hr` route |
| Modify | `client/src/pages/LandingPage.jsx` — add HR card, update grid |
| Modify | `client/src/components/Sidebar.jsx` — add HR to ALL_NAV and SECTION_TABS |
| Modify | `server.js` — add `hrDb`, HR table creation, all HR API routes |

No new CSS needed — all existing classes (`card`, `form-grid`, `form-group`, `table-card`, `modal-overlay`, `btn`, etc.) are reused.

---

## 7. Out of Scope (this iteration)
- Bank account / IFSC storage (deferred for security reasons)
- Automatic payroll calculation / salary slip PDF generation
- Leave management (casual leave, sick leave, earned leave)
- Time booking integration with external systems
- Role-based access control
