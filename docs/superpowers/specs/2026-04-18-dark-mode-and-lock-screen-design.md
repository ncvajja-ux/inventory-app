# Dark Mode Toggle & Password Lock Screen — Design Spec

**Date:** 2026-04-18  
**Status:** Approved

---

## Overview

Two independent features added to the Fat Closet Store Manager app:

1. **Dark / Light mode toggle** — switches the entire app between the current warm-white light theme and the luxury dark theme (gold on near-black) used by the landing page.
2. **Password lock screen** — when `APP_PASSWORD` is set in the server's `.env` file, a luxury dark lock screen gates the app. No password in `.env` → no lock.

---

## Feature 1: Dark / Light Mode

### Behaviour

- Default is light mode (current app appearance).
- User clicks the toggle in the sidebar footer to switch.
- Preference persists across page refreshes via `localStorage`.
- Toggle shows ☀️ when in dark mode (click to go light), 🌙 when in light mode (click to go dark).

### Architecture

#### `client/src/components/ThemeContext.jsx` (new)

```
ThemeProvider
  state: theme ('light' | 'dark')
  mount: read localStorage.getItem('theme') → default 'light'
  effect: document.documentElement.setAttribute('data-theme', theme)
          localStorage.setItem('theme', theme)
  exports: ThemeContext, ThemeProvider, useTheme()
```

`useTheme()` returns `{ theme, toggleTheme }`.

#### `client/src/index.css` — dark theme variables

One new CSS block:

```css
[data-theme="dark"] {
  --bg:      #0f0f0f;
  --card:    #1a1a1a;
  --border:  #2e2e2e;
  --ink:     #e8e8e8;
  --muted:   #888888;
  --accent:  #c9a84c;
  --accent2: rgba(201,168,76,0.12);
  --sidebar: #0a0a0a;
  --danger:  #f87171;
  --success: #4ade80;
  --info:    #38bdf8;
}
```

Followed by targeted overrides for elements that use hardcoded colours rather than CSS variables:

| Selector | Override |
|---|---|
| `tbody tr:hover` | `background: #1f1f1f` |
| `.modal` | `background: var(--card)` |
| `input, select` | `background: #111111; color: var(--ink)` |
| `input:focus, select:focus` | `background: #1a1a1a` |
| `.tabs` | `background: var(--card)` |
| `.topbar` | `background: var(--card)` |
| `.sales-tabbar` | `background: var(--card)` |
| `.add-bar` | `background: var(--card)` |
| `.search-wrap input` | `background: var(--card)` |
| `.search-results` | `background: var(--card)` |
| `.product-card` | `background: var(--card)` |
| `.totals-card` | `background: var(--card)` |
| `.cart-table-wrap` | `background: var(--card)` |
| `thead th` | `background: var(--bg)` |
| `.stat-pill` | `background: var(--card)` |
| `.qty-stepper` | `background: var(--card)` |
| `.seg-group` | `background: var(--card)` |
| `.pricing-add-form` | `background: var(--card)` |
| `.config-card` | `background: var(--card)` |

#### `client/src/components/Sidebar.jsx`

- Import `useTheme`.
- Add a theme icon button to the sidebar footer row (beside the collapse toggle).
- In collapsed mode: icon-only, centred. In expanded mode: small icon with label "Light" / "Dark".

#### `client/src/App.jsx`

- Wrap existing content in `<ThemeProvider>`.

### Dark Mode Palette Reference

Derived from the existing `LandingPage.jsx` `DARK` constants — consistent with the luxury landing page the app already ships.

---

## Feature 2: Password Lock Screen

### Behaviour

- If `APP_PASSWORD` is not set (or empty) in `.env`, the app loads normally — no lock.
- If `APP_PASSWORD` is set, the lock screen is shown on every fresh page load.
- After a correct password entry, the session is marked unlocked in `sessionStorage`. The lock screen does not reappear for the remainder of the browser session (closing the tab or browser resets it).
- Wrong password: input shakes, red error message appears below the field.

### Architecture

#### `.env` (new, project root)

```
APP_PASSWORD=
```

Empty by default. User sets a value to enable the lock.

#### `server.js`

- Add `require('dotenv').config()` at the very top (before any route definitions).
- Add `dotenv` to `package.json` dependencies.
- Two new routes (registered before any catch-all):

```
GET  /auth/status  → { locked: Boolean }
                     locked = !!process.env.APP_PASSWORD

POST /auth/unlock  body: { password: String }
                   → { ok: true }  if password matches APP_PASSWORD
                   → { ok: false } if it doesn't
```

No tokens or cookies are issued — session state lives entirely in the client's `sessionStorage`.

#### `client/src/components/LockScreen.jsx` (new)

Visual design: matches `LandingPage.jsx` exactly —
- `#0f0f0f` full-screen background
- Radial gold ambient glow at top
- "Fat Closet · Store Manager" eyebrow in gold (letter-spaced, uppercase)
- `DM Serif Display` headline: *"The Closet Command Centre"*
- Gold ornamental rule (lines + rotated diamonds)
- Password input on dark surface (`#1a1a1a`, border `#2e2e2e`) with lock icon
- Gold "UNLOCK" button
- Error state: red message + CSS shake animation on the input wrapper
- Props: `onUnlock: () => void`

Internal behaviour:
1. Submit → `POST /auth/unlock`
2. `ok: true` → `sessionStorage.setItem('app_unlocked', '1')` → call `onUnlock()`
3. `ok: false` → trigger shake, show "Incorrect password"

#### `client/src/App.jsx` — lock gate

```
isLocked: null | true | false
  null  → checking (render nothing / blank)
  true  → render <LockScreen onUnlock={() => setIsLocked(false)} />
  false → render normal app

Mount effect:
  if sessionStorage.getItem('app_unlocked') === '1'
    → setIsLocked(false)   // skip server call
  else
    → GET /auth/status
      → setIsLocked(data.locked)
```

The blank-while-checking phase is imperceptibly brief for a local server.

---

## Files Changed

| File | Change |
|---|---|
| `client/src/components/ThemeContext.jsx` | **new** — context + provider + hook |
| `client/src/components/LockScreen.jsx` | **new** — luxury dark lock screen |
| `client/src/components/Sidebar.jsx` | add theme toggle to footer |
| `client/src/App.jsx` | wrap in ThemeProvider; add lock gate |
| `client/src/index.css` | add `[data-theme="dark"]` block + overrides |
| `server.js` | add dotenv, `/auth/status`, `/auth/unlock` |
| `package.json` | add `dotenv` dependency |
| `.env` | **new** — `APP_PASSWORD=` (empty) |

---

## Out of Scope

- Per-page or per-route access control (all-or-nothing lock only)
- Multiple users or user accounts
- Password change UI (edit `.env` directly)
- Remember-me across browser sessions (use sessionStorage only, as agreed)
