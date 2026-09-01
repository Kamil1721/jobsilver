# Prompt — Redesign the JobSilver dashboard to the design system

**Date:** 2026-05-21
**Paste this whole document into Claude Design.** The *JobSilver Design System* is already attached to that project — this brief tells you how to apply it to the main dashboard. Token values are inlined so the brief is self-contained.

---

## The brief

Redesign the **JobSilver dashboard** — the authenticated landing screen: a drag-and-drop
Kanban board where users move curated jobs through `NEW MATCHES → APPLIED → OFFERS`.
Apply the JobSilver design system: deep-black surface, polished silver, one copper accent,
Fraunces + Inter, ambient drifting mesh and film grain.

This is the **app-page pass**. The design system was authored for marketing pages; the
dashboard is a dense working tool. Two rules govern the whole brief:

1. **Preserve the layout and every piece of functionality.** Same regions, same controls,
   same three-column board, same interactions. This is a re-skin, not a re-architecture.
2. **The product owner has chosen dark-only and full marketing motion.** Drop the
   light theme and its toggle entirely. Carry the chrome-sweep heading, button shimmer,
   and ambient mesh/grain onto the dashboard — tuned so motion never competes with the
   board itself (see Motion).

Deliver it as a clickable HTML/React prototype with a Tweaks panel (see Suggested Tweaks).

---

## Scope

- **Primary surface:** the dashboard page — header strip, search, the Kanban board, cards,
  bulk toolbar, all states.
- **Also in scope — the shared authenticated header.** The dashboard sits under a shared
  `(dashboard)` layout (fixed top header: wordmark, announcement banner, tester badge,
  theme toggle, user menu). Redesigning that header — and **removing the theme toggle**,
  since the app is now dark-only — rolls out to every authenticated page (`/jobs/[id]`,
  `/profile`, `/preferences`, etc.). That is intended. Design the header here; the rest of
  those pages are a later pass.
- **Out of scope to redesign (but must inherit the new palette):** the admin production-mode
  toggle, the floating Report button, the announcement-banner internals, `PublicFooter`.
  Leave their structure; just recolor them to the tokens below.

---

## Current state (what you are replacing)

A light/dark Tailwind dashboard. Page background `bg-zinc-50` / `#0a0a0b`. A 56px fixed
header with a theme-aware logo, announcement banner, theme toggle, and user dropdown.
Below it: a header strip with a "Dashboard" title, three stat badges, a search bar, and
Favorites/Selection-mode toggles. Then a three-column Kanban board (dnd-kit) of compact
job cards. The current palette leans on **cyan** (selection), **emerald** (offers/applied),
**blue** (an info banner), **violet/purple** (the upgrade teaser), amber and red — several
of which the design system forbids. This redesign keeps every region and behaviour and
re-skins the surface, type, colour, and motion.

## Hard constraints — preserve all functionality

Keep, unchanged in behaviour:

- The three-column Kanban board and **dnd-kit drag-and-drop** — cards sortable within and
  between columns; drop updates job status; optimistic update with rollback on error;
  realtime multi-tab sync.
- **Search + filters** — keyword and location inputs, the expandable filters panel
  (Job Type, Remote toggle, Clear), URL-param persistence, the admin/tester-only Search
  button.
- **Selection mode** — per-card checkboxes, column "select all", the floating bulk-actions
  toolbar (move-to, delete), and both confirmation dialogs.
- **Favorites** (premium-only), **PreferenceMatch** scores (premium-only), the **quota**
  display, the **upgrade teaser** and **job-limit warning** (Free users), realtime updates,
  loading skeletons, empty states, error states.
- The fixed header's wordmark, announcement banner, tester badge, and user menu.

The only behavioural change: **the theme toggle is removed** (dark-only). Everything else
is visual.

---

## Design tokens (inline these)

```
Surfaces
  --bg-base       #0A0A0A   page background (warm-black, not pure #000)
  --bg-raised     #111114   charcoal — column panels
  --bg-raised-2   #16161A   charcoal — job cards, toolbar, dialogs
  --input-bg      #0E0E11   form fields, search inputs

Hairlines
  --line-1        rgba(255,255,255,0.06)   default panel/card border
  --line-2        rgba(255,255,255,0.10)   hover border / inputs
  --line-3        rgba(255,255,255,0.16)   ghost-button border

Ink
  --fg-1          #F5F5F7   primary text
  --fg-2          #B5B5BA   secondary text
  --fg-3          #7A7A80   tertiary / eyebrows / captions / meta
  --fg-4          #4A4A50   disabled / faint dividers

Silver scale     #FFFFFF · #F5F5F7 · #E8E8EB · #C8C8CC · #8A8A90 · #6A6A70 · #4A4A52 · #2A2A30

Copper accent — CTAs and directional cues ONLY (never labels, never body text)
  --copper        #B87333
  --copper-glow   rgba(184,115,51,0.35)
  copper-face (primary CTA fill):
    linear-gradient(180deg,#E8A87C 0%,#D2904A 18%,#B87333 40%,#6E4220 60%,#B87333 82%,#8E5A28 100%)
  metal-gradient-h (animated heading fill, 90deg):
    linear-gradient(90deg,#FFFFFF 0%,#E8E8EB 15%,#C8C8CC 40%,#2A2A30 60%,#C8C8CC 85%,#FFFFFF 100%)

Semantic (used sparingly — states only)
  --warn          #C28A3B   quota low, job-limit at-limit
  --err           #B5483F   delete, quota exhausted, destructive
  --ok            #6E8B6A   muted sage — the OFFERS/positive state ONLY

Radii      r-1 6px · r-2 10px (inputs, cards) · r-3 14px (columns, panels, dialogs) · r-pill 999px (buttons, chips)
Elevation  --elev-2: 0 0 0 1px rgba(255,255,255,0.05), 0 30px 80px rgba(0,0,0,0.6)
Type       Fraunces (display/serif) · Inter (body/UI). Tabular numerals for all counts/scores.
Motion     chrome-sweep 6s · shimmer 2.8s · mesh 90s · dealt-cards 600ms/80ms-stagger · count-up 1.6s
           ease-out-expo cubic-bezier(0.16,1,0.3,1)
```

---

## Palette remap — the most important table

Every forbidden colour in today's dashboard maps to a design-system token. Apply this
everywhere; do not carry a single cyan/blue/purple/teal pixel across.

| Today | Where it appears | Design-system replacement |
|---|---|---|
| **cyan** | selected-card ring + fill, premium accents | **copper** — selection is a directional/action cue |
| **emerald / green** | OFFERS column dot, "Applied" badge, top preference scores | **`--ok` `#6E8B6A`** (muted sage), used sparingly |
| **blue** | job-limit "high usage" info banner | **neutral** — charcoal panel + silver text, no hue |
| **violet / purple** | upgrade teaser banner | **copper-face** — the teaser is a CTA, so copper is correct here |
| **amber** | quota low, job-limit at-limit warning | **`--warn` `#C28A3B`** (this is the system's own semantic) |
| **red** | delete actions, quota exhausted | **`--err` `#B5483F`** (the system's own semantic) |
| ⚠️ / ℹ️ **emoji** | warning / info banners | **Lucide line icons** — `AlertTriangle`, `Info`. No emoji anywhere. |
| **`Sparkles` icon** | PreferenceMatch badge | **Hard ban** — sparkle/twinkle iconography is forbidden. Use `Target`, `Gauge`, or a plain silver `%` chip with no icon. |

Copper appears in exactly three places on this screen: the Search CTA, the upgrade
teaser's button, and the selected-card ring. Nowhere else. Hover states use the silver
hairline-lift, never copper.

---

## Region-by-region spec

### 1. Page shell + ambient background
- Background `#0A0A0A`. Replace the zinc/white surfaces entirely.
- Fixed full-bleed **drifting mesh** behind content (`z-index:0`): blurred silver-to-charcoal
  radials at `opacity:0.13`, 90s ease-in-out drift loop.
- Fixed full-bleed **film grain** above everything (`z-index:999`, `pointer-events:none`):
  `opacity:0.05`, `mix-blend-mode:overlay`, `feTurbulence` SVG.
- Board and chrome sit at `z-index:10`. The mesh must stay faint enough that job-card text
  is fully legible — this is a working tool first.

### 2. Shared top header (64px, fixed)
- Bump height to 64px. Background `rgba(10,10,10,0.6)`, `backdrop-filter: blur(16px) saturate(140%)`,
  bottom hairline `1px var(--line-1)`.
- **Left:** the JobSilver wordmark — static, no glint, no chrome-sweep. (The mark is well-drawn
  type; motion happens elsewhere.)
- **Centre:** the announcement banner — recolour per type to the palette: info → neutral
  charcoal + silver text, warning/maintenance → `--warn`, promo → copper hairline accent.
  No blue, no purple.
- **Right:** tester badge, then the user dropdown (avatar/name → menu). **Remove the theme
  toggle.** The dropdown menu is a charcoal `--bg-raised-2` popover, `--line-1` hairline,
  `--r-2`, items in `--fg-2` → `--fg-1` on hover.

### 3. Dashboard header strip
A horizontal strip below the fixed header, with a bottom hairline `--line-1`.
- **Title "Dashboard"** — Fraunces, weight 600, `clamp(28px, 3vw, 40px)`, tracking `-0.025em`.
  Fill it with the animated 6s liquid-chrome sweep (`metal-gradient-h`, background-clipped
  to the glyphs). Keep it this size — a tool heading, not a marketing hero.
- **Stat badges** — `NEW MATCHES 5 · APPLIED 12 · OFFERS 1`. Render each as an eyebrow:
  uppercase ~11px label in `--fg-3`, the number in `--fg-1` tabular numerals. The numbers
  **count up** (1.6s ease-out-expo) on first load. *(These duplicate the column counts —
  verify with the owner whether they should stay; collapse to nothing if redundant.)*
- **Search bar** (region 4), **Favorites toggle**, **Selection-mode toggle** — the two
  toggles are ghost pills (`--line-3` border, transparent; active state = `--line-2` fill
  `rgba(255,255,255,0.06)` + `--fg-1` label). Icons are Lucide line icons.
- The **quota display** lives here too — see region 9.

### 4. Search bar + filters
- Keyword and location inputs: fill `#0E0E11`, `1px var(--line-2)`, `--r-2`, text `--fg-1`,
  placeholder `--fg-3`, Lucide icon prefix in `--fg-3`. **Focus:** copper border +
  `box-shadow: 0 0 0 3px rgba(184,115,51,0.18)` — never browser-blue.
- **Filters** toggle — ghost pill; show a small copper dot when filters are active.
- **Search button** (admin/tester only) — the copper-face pill CTA: copper gradient,
  white label, `--r-pill`, 2.8s shimmer on hover, `scale(0.985)` on press. Spinner while loading.
- **Filters panel** (expands below): Job Type dropdown (charcoal popover, `--line-1`),
  Remote-only toggle (track `--line-2`, knob silver, **on-state copper**), and a quiet
  "Clear filters" text button in `--fg-3`.

### 5. Kanban board — three columns
- Horizontal flex, `gap` ~16–20px. Columns: **NEW MATCHES** (`discovered`), **APPLIED**
  (`applied`), **OFFERS** (`offer`).
- **Column shell:** a faint panel — fill `rgba(255,255,255,0.02)`, `1px var(--line-1)`,
  `--r-3`, internal padding ~12px, the job list scrollable.
- **Column header:** a status **dot** + the column name as an uppercase eyebrow
  (`--fg-3`, tracked `0.14em`) + a count chip (`--bg-raised-2`, `--fg-2`, tabular, `--r-pill`).
  Dot colours: NEW MATCHES `--fg-3` grey · APPLIED `--silver-3 #C8C8CC` · OFFERS `--ok #6E8B6A`.
- In **selection mode**, a "select all" checkbox appears in the column header.

### 6. Job card
- Surface: `--bg-raised-2 #16161A`, `1px var(--line-1)`, `--r-2`, padding `~10px 12px`.
  Sits raised against the fainter column panel.
- **Hover:** border lifts `--line-1 → --line-2`; a barely-there fill lift. Not copper.
- **Selected** (selection mode): a **copper ring** (`2px var(--copper)`) + a faint copper
  fill wash `rgba(184,115,51,0.06)`. This is the only card state that uses copper.
- **Dragging:** `opacity ~0.6`, slight `scale(1.02)`, border `--line-2`. The **drag overlay**
  shows a simplified card (company + title only).
- Card contents (single compact card, three text rows):
  - Left rail: selection checkbox (selection mode only) + a `GripVertical` drag handle
    (`--fg-3`, fades in on hover/selection).
  - Row 1: **company** — Inter 600, `--fg-1`, truncated. If `applied`, an "Applied" chip:
    `--ok`-tinted (`bg rgba(110,139,106,0.14)`, text `--ok`), Lucide `Check` icon.
  - Row 2: **job title** — Inter 400, `--fg-2`, truncated (full text in `title` tooltip).
  - Row 3: meta — location · job type (FT/PT/Contract/…) · applied date (relative, with a
    Lucide `Clock` icon when applied) — all `--fg-3`, tabular numerals.
  - Right: the **PreferenceMatch** chip (region 8) and a discard `X` button (`--err` on
    hover, `--fg-3` idle, hidden for `applied`/`offer` cards).
- Whole card is a link to `/jobs/{id}` (drag handle and action buttons excepted).

### 7. Bulk-actions toolbar (floating)
- Appears top-centre when any card is selected. Charcoal `--bg-raised-2`, `1px var(--line-1)`,
  `--elev-2`, `--r-3`, `--r-pill` ends are fine too.
- Contents: selection count (`--fg-1` tabular) + a "Move to" dropdown + a "Delete" button
  (`--err` text/border, `--err`-tinted fill on hover) + a clear-selection `X` (`--fg-3`).

### 8. PreferenceMatch badge (premium users)
- A compact `%` chip — tabular numerals, `--r-pill`, `--bg-raised` fill. **No sparkle icon.**
  If an icon is wanted, use Lucide `Target` or `Gauge`; a clean numeric chip with no icon
  is also fine.
- Score tiers: ≥85% → `--ok`-tinted chip; 70–84% → `--silver-2`; 55–69% → `--fg-2`;
  <55% → `--fg-3`. Optional reasons dropdown stays — charcoal popover.

### 9. Quota display
- A compact pill in the header strip: a label, a thin progress bar, and `used / limit`
  tabular numerals.
- Normal → bar fill `--silver-3`. Low → `--warn`. Exhausted → `--err`, and the pill shows
  the time-until-reset.

### 10. Upgrade teaser banner
- Appears above the board when a Free user hits the job limit. Charcoal `--bg-raised`
  panel, `--line-1` hairline, `--r-3`. Headline `--fg-1`, body `--fg-2`, the hidden-jobs
  count in tabular numerals.
- Its action is a **copper-face pill** ("See plans" → `/choose-plan`). Copper is correct
  here — it is a genuine CTA. **No purple, no gradient blob.**

### 11. Job-limit warning (NEW MATCHES column, Free users)
- **At limit:** `--warn`-tinted panel (`bg rgba(194,138,59,0.10)`, border `rgba(194,138,59,0.22)`),
  a Lucide `AlertTriangle` icon, e.g. "Limit reached: 50 jobs".
- **High usage (~90%):** a neutral charcoal panel (`--bg-raised`, `--line-1`), a Lucide
  `Info` icon, e.g. "45 / 50 jobs". **No blue.**
- Both end with a quiet copper text link "Upgrade for more →".

### 12. States
- **Loading skeleton:** three `JobCardSkeleton` placeholders per column — charcoal bars
  (`rgba(255,255,255,0.05)`) with a slow silver shimmer pulse, `--r-1`.
- **Empty column:** centred, quiet — a faint Lucide line icon, "No jobs yet" in `--fg-2`,
  and the column-specific hint in `--fg-3` ("Search to find new matches" / "Drag jobs here
  when you apply" / "Move jobs here when you get an offer").
- **Confirmation dialogs** (discard, bulk delete): charcoal `--bg-raised-2`, `--line-1`,
  `--r-3`, `--elev-2`. The destructive button is `--err`; cancel is a ghost button.

### 13. Footer
- `PublicFooter` stays. Recolour to the tokens — `--bg-base`, hairline top border, links
  `--fg-3 → --fg-1` on hover.

---

## Motion (full marketing motion, tuned for a tool)
- **Drifting mesh + film grain** — page-wide, as in region 1.
- **"Dashboard" heading** — 6s liquid-chrome sweep.
- **Stat numbers** — count-up (1.6s ease-out-expo) on first load only.
- **Job cards — dealt-cards entrance** — when a column first populates, cards fade +
  `translateY` in with an 80ms stagger and a ±2° rotation settle (600ms ease-out-expo).
  **Fire this once, on initial mount only.** Realtime inserts/moves and drag results after
  mount must use a quiet fade (no rotation, no stagger) — otherwise every realtime row
  event triggers a rotation cascade.
- **Copper CTAs** (Search, upgrade teaser) — 2.8s silver shimmer sweep on hover; press
  `scale(0.985)`.
- **Drag interaction itself stays snappy** — no decorative motion on the dragged card or
  the drag overlay beyond the slight scale. Drag feedback must feel instant.
- **`prefers-reduced-motion: reduce`** — freeze every loop: chrome-sweep becomes a static
  silver fill, mesh freezes, shimmer disabled, dealt-cards becomes a plain fade, count-up
  jumps to the final value.

## Voice / copy
- Keep the column names (`NEW MATCHES`, `APPLIED`, `OFFERS`) and the empty-state hints.
- Sentence case for buttons and controls. No emoji anywhere — warnings use Lucide icons.
- Don't introduce banned words (`effortless`, `seamless`, `powerful`, `smart`, `unlock`,
  `elevate`, `magic`, etc.). The dashboard is mostly labels and numbers — keep it plain.

## Suggested Tweaks panel
Expose these so the owner can step through the conditional surface:
- **Plan** — Free / Pro — gates PreferenceMatch badges, the Favorites control, the
  job-limit warning, and the upgrade teaser. Highest-leverage toggle.
- **Column state** — populated / empty / loading skeleton.
- **Selection mode** — off / on (checkboxes + bulk toolbar).
- **Quota** — normal / low / exhausted.
- **Upgrade teaser** — hidden / shown.
- **Reduce motion** — page-level freeze without changing OS prefs.

## Acceptance checklist
- [ ] Dark-only `#0A0A0A` surface; theme toggle removed; drifting mesh + film grain present.
- [ ] Zero cyan / blue / purple / teal / emerald-green pixels — all remapped per the table.
- [ ] Three-column Kanban, dnd-kit drag-and-drop, and every interaction preserved.
- [ ] "Dashboard" heading is Fraunces with the 6s chrome-sweep, sized `clamp(28px,3vw,40px)`.
- [ ] Job cards are charcoal with hairlines; selected = copper ring; hover = silver lift.
- [ ] Search CTA is a copper-face pill with shimmer; copper appears only on Search,
      the upgrade CTA, and the selection ring.
- [ ] PreferenceMatch badge has no `Sparkles` icon; warnings use Lucide icons, no emoji.
- [ ] Dealt-cards entrance fires once on mount; realtime updates use a quiet fade.
- [ ] All states covered: loading skeleton, empty columns, quota low/exhausted, job-limit
      at-limit/high-usage, upgrade teaser, confirmation dialogs.
- [ ] `prefers-reduced-motion` freezes every loop to a static fallback.
