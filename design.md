# AegisOne — Design System v2 (`design.md`)
**Codename: Sovereign Blue.** One visual language across Landing, Auth, Setup Engine, and Dashboards — light and dark.

---

## 0. Design Principles (read this before touching any component)

1. **One accent, many depths.** We use ONE blue family, expressed through depth (navy → mid → sky → white) instead of multiple competing colors (no violet, no indigo, no red-for-non-error uses).
2. **Quiet surfaces, loud data.** Chrome (sidebars, headers, cards) stays muted and low-contrast. Charts, numbers, status badges are where color and contrast are allowed to pop.
3. **Depth via elevation, not decoration.** Depth comes from shadow + blur + 1px hairline borders — never heavy gradients slapped on every element.
4. **No flat white dashboards.** Light mode uses a soft off-white canvas (`#F6FAFD`) with pure-white elevated cards — never white-on-white with only borders to separate them (this is AegisOne's current #1 problem).
5. **Dark mode is a first-class citizen**, not an inverted afterthought — built on true navy (`#0A1931`), not generic slate/black.

---

## 1. Color System

### 1.1 Core Palette (source: brand navy set)
```css
--navy-950:  #0A1931;  /* Deepest navy — dark mode canvas, light-mode headline text */
--navy-800:  #1A3D63;  /* Deep blue — dark mode elevated surfaces, sidebar (light mode) */
--blue-600:  #4A7FA7;  /* Mid blue — PRIMARY BRAND / buttons / links / active states */
--sky-300:   #B3CFE5;  /* Soft sky — tints, hover backgrounds, chart secondary series */
--frost-50:  #F6FAFD;  /* Off-white canvas — light mode background */
--white:     #FFFFFF;  /* Pure white — elevated cards only, light mode */
```

### 1.2 Extended Ramp (derived — for hover/active/disabled states)
```css
--blue-700: #3D6C90;  /* button hover / active */
--blue-500: #5C93BE;  /* lighter interactive, disabled-adjacent */
--blue-100: #E4EEF6;  /* badge backgrounds, subtle fills (light mode) */
--blue-50:  #F0F6FA;  /* faintest tint, table row hover (light mode) */
--navy-700: #24466E;  /* dark mode card hover border */
--navy-600: #2E5580;  /* dark mode secondary elevated surface */
```

### 1.3 Light Mode Surfaces
```css
--bg-canvas:        #F6FAFD;              /* page background */
--bg-sidebar:        #0A1931;              /* sidebar is DARK even in light mode — anchor element, see 4.1 */
--bg-card:            #FFFFFF;
--bg-card-hover:      #FFFFFF;              /* hover changes shadow/border, not fill */
--border-subtle:      #E1EBF2;
--border-strong:      #C7DAE8;
--text-primary:       #0A1931;
--text-secondary:     #4A6D8C;
--text-muted:         #8CA3B8;
```

### 1.4 Dark Mode Surfaces
```css
--bg-canvas:        #071426;              /* slightly deeper than navy-950 for max contrast with cards */
--bg-sidebar:        #050D1B;
--bg-card:            #0F2038;              /* navy-950 lifted one step */
--bg-card-hover:      #14284A;
--border-subtle:      rgba(179, 207, 229, 0.10);   /* sky-300 @ 10% */
--border-strong:      rgba(179, 207, 229, 0.20);
--text-primary:       #F6FAFD;
--text-secondary:     #A9C2D6;
--text-muted:         #6B87A0;
```

### 1.5 Status Colors (semantic — used ONLY for status, never decoration)
```css
--success:      #2FA97E;   /* light */  /--success-dark:  #4ADE9E; /* dark */
--warning:      #D9A441;   /* light */  /--warning-dark:  #F3C567; /* dark */
--danger:       #D65C5C;   /* light */  /--danger-dark:   #F08787; /* dark */
--info:         var(--blue-600);          /* re-use brand blue, don't add a 4th hue */

/* Badge pattern (both modes): 10% bg tint + 20% border + solid text */
--badge-bg:    color-mix(in srgb, var(--status-color) 12%, transparent);
--badge-border: color-mix(in srgb, var(--status-color) 25%, transparent);
```

### 1.6 What to remove from the current build
- Delete the unused Navy/Teal/Beige/SkyBlue/White exploration palette — not used anywhere, causes confusion.
- Delete indigo/violet from the landing page entirely.
- Delete the red lock icon on Super Admin login — replace with navy shield icon; red is reserved for `--danger` only.

---

## 2. Typography

```css
--font-display: 'Outfit', 'Plus Jakarta Sans', sans-serif;   /* headlines only */
--font-body:    'Inter', -apple-system, sans-serif;          /* everything else */
--font-mono:    'JetBrains Mono', ui-monospace, monospace;   /* IDs, codes, logs */
```

| Token | Size | Weight | Font | Usage |
|---|---|---|---|---|
| `display-xl` | 3rem / 48px | 700 | Outfit | Landing hero only |
| `display-lg` | 2.25rem / 36px | 600 | Outfit | Portal/section titles |
| `heading-md` | 1.375rem / 22px | 600 | Inter | Card headers |
| `heading-sm` | 1rem / 16px | 600 | Inter | Widget/modal titles |
| `body-base` | 0.875rem / 14px | 400 | Inter | Body copy, inputs |
| `body-sm` | 0.8125rem / 13px | 500 | Inter | Secondary text, table cells |
| `caption` | 0.6875rem / 11px | 600 | Inter | Badges, table headers — `letter-spacing: 0.04em; uppercase` |
| `mono-sm` | 0.75rem / 12px | 500 | JetBrains Mono | Employee IDs, dept codes, audit log hashes |

**Rule:** No more than 2 font families visible on any single screen (Outfit for the one hero headline, Inter for everything else). Never mix in a 3rd display font (this killed the old landing page).

---

## 3. Spacing, Radius, Elevation

```css
--radius-sm: 8px;   /* badges, small buttons */
--radius-md: 12px;  /* inputs, secondary buttons */
--radius-lg: 16px;  /* cards */
--radius-xl: 20px;  /* modals, hero panels */

--space unit: 4px base — use 4/8/12/16/24/32/48/64 only.

/* Elevation — light mode */
--shadow-sm: 0 1px 2px rgba(10,25,49,0.04);
--shadow-md: 0 4px 12px rgba(10,25,49,0.06), 0 1px 2px rgba(10,25,49,0.04);
--shadow-lg: 0 12px 32px rgba(10,25,49,0.10), 0 2px 6px rgba(10,25,49,0.05);
--shadow-glow-blue: 0 0 0 1px rgba(74,127,167,0.15), 0 8px 24px rgba(74,127,167,0.15);

/* Elevation — dark mode (softer, no black shadows — use navy glow instead) */
--shadow-sm-dark: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md-dark: 0 4px 16px rgba(0,0,0,0.35);
--shadow-glow-blue-dark: 0 0 0 1px rgba(179,207,229,0.12), 0 8px 28px rgba(74,127,167,0.25);
```

---

## 4. Core Components

### 4.1 Sidebar (Dashboard/Admin) — the anchor element
The current sidebar is plain white text-links — this reads thin/generic. Fix:
```
Background: var(--bg-sidebar)   /* deep navy in BOTH light and dark mode — this is the brand anchor */
Width: 248px, collapsible to 72px (icon-only)
Logo area: 64px height, bottom border rgba(255,255,255,0.06)
Nav item (default): text-secondary equivalent on dark = #A9C2D6, icon w-4.5 h-4.5, stroke 2px
Nav item (active): bg rgba(74,127,167,0.16), left border 3px solid var(--blue-600),
                    text #FFFFFF, icon color var(--sky-300)
Nav item (hover):  bg rgba(255,255,255,0.04)
Section labels: caption token, color #4A6D8C, margin-top 24px
User footer: avatar + name + role pill, top border rgba(255,255,255,0.06)
```
This single change (dark sidebar in light mode too, like Innova/CrypCoin reference) will do more for "premium feel" than any other single fix.

### 4.2 Cards
```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 200ms ease, border-color 200ms ease, transform 200ms ease;
}
.card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.card--stat {
  /* KPI cards: Overdue / Total Employees / etc, per Innova reference */
  display: flex; flex-direction: column; gap: 8px;
}
.card--stat .value { font: 700 1.75rem Inter; color: var(--text-primary); }
.card--stat .delta.positive { color: var(--success); }
.card--stat .delta.negative { color: var(--danger); }
.card--stat .icon-badge {
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  background: var(--blue-100); /* dark: rgba(74,127,167,.18) */
  display: grid; place-items: center;
}
```

### 4.3 Buttons
```css
.btn-primary {
  background: linear-gradient(135deg, var(--blue-600), var(--blue-700));
  color: #FFFFFF; font: 600 0.8125rem Inter; letter-spacing: 0.01em;
  padding: 10px 20px; border-radius: var(--radius-md);
  box-shadow: 0 1px 2px rgba(10,25,49,0.08), 0 4px 10px rgba(74,127,167,0.25);
  transition: all 180ms ease;
}
.btn-primary:hover { box-shadow: 0 4px 16px rgba(74,127,167,0.4); transform: translateY(-1px); }
.btn-primary:active { transform: scale(0.98) translateY(0); }

.btn-secondary {
  background: var(--blue-50);      /* dark: rgba(255,255,255,.04) */
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font: 600 0.8125rem Inter;
  border-radius: var(--radius-md); padding: 10px 20px;
}
.btn-ghost { background: transparent; color: var(--text-secondary); }
```
**No more uppercase-tracking-wider on every button** — reserve that treatment for badges/caption text only, buttons use normal case + semibold (matches the CrypCoin/Innova reference feel — softer, more premium, less "corporate SaaS default").

### 4.4 Inputs
```css
.input {
  background: var(--bg-canvas);          /* dark: rgba(255,255,255,.03) */
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 11px 14px; font: 400 0.875rem Inter;
  transition: border-color 150ms, box-shadow 150ms;
}
.input:focus {
  border-color: var(--blue-600);
  box-shadow: 0 0 0 3px rgba(74,127,167,0.15);
  background: var(--bg-card);
}
```

### 4.5 Status Badges
```css
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 999px;
  font: 600 0.6875rem Inter; letter-spacing: 0.02em;
  background: var(--badge-bg); border: 1px solid var(--badge-border);
  color: var(--status-color);
}
/* dot variant for table rows */
.badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--status-color); }
```

### 4.6 Data Tables
```
Row height: 52px
Header: caption token, text-muted, border-bottom 1px var(--border-subtle), no background fill
Row hover: background var(--blue-50) / dark: rgba(255,255,255,.02)
Row border: border-bottom 1px var(--border-subtle) — no vertical borders, no zebra striping
Avatar: 32px circle, bg var(--blue-100), initials in var(--blue-700)
Action icons: 16px, text-muted default, text-primary on hover, individual 32px hit-area with radius-sm hover bg
```

### 4.7 Charts (see §6 for library) — visual spec regardless of library
```
Line/area charts: single primary line in var(--blue-600), area fill = gradient
  linear-gradient(180deg, rgba(74,127,167,0.25), rgba(74,127,167,0))
Grid lines: var(--border-subtle), dashed, only horizontal
Tooltip: bg-card + shadow-lg + radius-md, never default browser tooltip
Multi-series: blue-600 (primary) → sky-300 (secondary) → navy-800 (tertiary) — stay in-family,
  do not introduce green/orange/purple for chart series (reserve those for status only)
```

### 4.8 Progress / Stepper (Setup Engine)
```css
.stepper-track { height: 3px; background: var(--border-subtle); border-radius: 2px; }
.stepper-fill  { background: linear-gradient(90deg, var(--blue-600), var(--sky-300)); }
.step-badge.complete { background: var(--success); color: #fff; }
.step-badge.active   { background: var(--blue-600); color: #fff; box-shadow: 0 0 0 4px rgba(74,127,167,0.2); }
.step-badge.pending  { background: var(--bg-canvas); border: 1px solid var(--border-strong); color: var(--text-muted); }
```

### 4.9 Login / Auth (unify into ONE template — currently 3 exist)
```
Layout: centered card, max-width 400px, on canvas background with a very subtle
  radial gradient glow behind it: radial-gradient(circle at 50% 0%, rgba(74,127,167,0.12), transparent 60%)
Card: bg-card, radius-xl, shadow-lg, padding 40px 32px
Logo: shield icon (Lucide `shield-check`), 40px, color var(--blue-600), NOT red, NOT a lock
Title: heading-md, text-primary
Subtitle: body-sm, text-muted
Inputs: standard .input spec above with icon prefix (mail/lock icons, w-4 h-4, text-muted)
Submit: .btn-primary, full width
Footer link: body-sm, var(--blue-600), no underline until hover
```
Delete the other two login variants (dark-browser-chrome "Super Admin" red-lock version, and the split "Organization Portal" version) — every auth entry point (org login, admin login, employee login) uses this ONE template with only the title/subtitle copy changing.

### 4.10 Icons
- Library: **Lucide** only (already in use — keep it, just standardize sizing).
- Sidebar nav: 18px, stroke 2
- Card header icons: 20px inside 36px rounded-sm badge container (`--blue-100` bg / dark `rgba(74,127,167,.18)`)
- Inline/table action icons: 16px, stroke 2
- Never mix in emoji, never mix in a second icon set (Heroicons/Feather) even for one-off pieces

---

## 5. Dark Mode Toggle Behavior
- Toggle lives top-right, sun/moon icon swap, animate icon rotation 200ms.
- Respect `prefers-color-scheme` on first load, persist user override in localStorage.
- Every color token above is a CSS variable — dark mode is a `[data-theme="dark"]` attribute on `<html>` that swaps the variable block, not a Tailwind `dark:` class scattered on every element (far easier to keep consistent, and matches how the CrypCoin/Innova references clearly do it — one coherent dark surface system, not per-component overrides).

---

## 6. Recommended Libraries (additive only — none of these require touching business logic)

| Need | Library | Why |
|---|---|---|
| Charts | **Tremor** (`@tremor/react`) or **Recharts** | Tremor gives you dashboard-grade cards+charts pre-styled to Tailwind tokens fast; Recharts if you want full control to match §4.7 spec exactly |
| Animation / micro-interactions | **Framer Motion** | Card hover lift, stepper transitions, modal enter/exit — already partially used, extend it |
| Icons | **lucide-react** | Already standard, keep |
| Skeleton loading states | **react-loading-skeleton** or Tremor's built-in | Dashboards with 0-state (like your current "0 Total Employees") should show skeletons while fetching, not static zeros |
| Toasts/notifications | **sonner** | Minimal, matches "elegant" direction better than default browser alerts |
| Command palette (optional, premium touch) | **cmdk** | "⌘K search logs/threats/endpoints" — you already have a search bar in the header, this makes it functional and feels very premium (Linear/Vercel-style) |
| Data tables (if not custom) | **TanStack Table** headless + your own styling per §4.6 | Keeps your exact visual spec instead of a pre-styled table lib fighting your design |

---

## 7. Page-Specific Notes

- **Landing page:** rebuild hero in Outfit + `--blue-600`/`--navy-950`, remove violet/black condensed font entirely. Stat cards (99.8%, Zero, 15m, 100%) should become small `.card--stat`-style elements, not bare text, for consistency with dashboard.
- **Setup Engine:** already closest to on-brand — apply sidebar (§4.1), badge (§4.5), and stepper (§4.8) specs; remove uppercase-bold-wide button styling.
- **Dashboard (Admin/Employee):** apply dark sidebar even in light mode, restyle KPI row as `.card--stat`, add skeleton states for the current all-zero metrics, restyle "Threat Trends" chart per §4.7.
- **Employee table / Departments:** apply §4.6 exactly — remove any striping, tighten row height, restyle role/status pills as `.badge`.