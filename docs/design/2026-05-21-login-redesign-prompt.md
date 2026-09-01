# Prompt — Redesign the login screen to the JobSilver design system

**Date:** 2026-05-21
**Target file:** `src/app/login/page.tsx` (single file — both `LoginPageContent` and the `LoginLoading` fallback)
**Source of truth:** the *JobSilver Design System* handoff bundle (Claude Design). Token values are inlined below so this prompt is self-contained — you do not need the bundle to execute it.

---

## Hand this prompt to a coding agent verbatim

> Redesign the JobSilver login page (`src/app/login/page.tsx`) to match the JobSilver
> design system: deep-black surface, polished-silver and a single copper accent,
> Fraunces + Inter type, ambient drifting mesh and film grain. The current page is a
> generic dark-SaaS auth card (zinc gradient orbs, white CTA, purple invite banner).
> Replace the *visual layer only*. Do not touch authentication logic, Supabase calls,
> `searchParams` handling, the invite-code flow, or routing. Work region by region
> using the spec below. Every token value you need is inlined.

---

## Current state (what you are replacing)

The provided screenshot shows today's login page: `#0a0a0b` background with grey
gradient orbs and a faint grid, a centered "Welcome back" heading in a sans-serif,
a charcoal-to-zinc gradient card with Sign In / Sign Up tabs, icon-prefixed inputs,
a **white** "Sign In" CTA, an "Or continue with" divider, a Google button, and a
terms line. A tester-invite banner (when an `?invite=` code is present) renders in
**violet/purple**. This is the "before". The redesign keeps the same layout skeleton
and every interactive behaviour — only the surface treatment, type, colour, motion,
and a few strings change.

## Hard constraints — do not cross these

- **Do not change** `handleLogin`, `handleSignUp`, `validateInviteCode`,
  `applyTesterInvite`, the Google OAuth handler, `searchParams` reads, `router`
  calls, `toast` calls, or `localStorage` usage. Visual layer only.
- **Do not restyle the shared primitives** `src/components/ui/input.tsx`,
  `button.tsx`, or `label.tsx`. They are used across the whole app. Scope every
  change to `src/app/login/page.tsx` via `className` overrides and local markup.
- **Do not touch** `PublicFooter` — leave `<PublicFooter />` in place as-is.
- Keep the page a Client Component, keep the `Suspense` boundary, keep `framer-motion`
  for entrance animation and the tab indicator.
- Verify with `npm run lint` and `npm run build` before declaring done.

## Fonts — already available

`next/font` already loads Fraunces and Inter (`src/app/layout.tsx`), exposed through
Tailwind as `font-serif` (Fraunces) and `font-sans` (Inter). Use `font-serif` for
display type. No font setup needed.

---

## Design tokens (inline these — Tailwind arbitrary values or a local `<style>` block)

```
Surfaces
  --bg-base        #0A0A0A   page background (warm-undertoned black, not #000)
  --bg-raised      #111114   charcoal card
  --bg-raised-2    #16161A   hover/active charcoal
  --input-bg       #0E0E11   form field fill

Hairlines
  --line-1         rgba(255,255,255,0.06)
  --line-2         rgba(255,255,255,0.10)
  --line-3         rgba(255,255,255,0.16)

Ink
  --fg-1           #F5F5F7   primary text on dark
  --fg-2           #B5B5BA   secondary
  --fg-3           #7A7A80   tertiary / captions / eyebrows

Copper accent (CTAs and directional cues ONLY — never labels, never body text)
  --copper         #B87333
  --copper-glow    rgba(184,115,51,0.35)
  copper-face gradient (primary CTA fill):
    linear-gradient(180deg,#E8A87C 0%,#D2904A 18%,#B87333 40%,#6E4220 60%,#B87333 82%,#8E5A28 100%)

Silver
  silver scale     #FFFFFF / #F5F5F7 / #E8E8EB / #C8C8CC / #8A8A90 / #6A6A70 / #4A4A52 / #2A2A30
  metal-gradient-h (animated heading fill, 90deg):
    linear-gradient(90deg,#FFFFFF 0%,#E8E8EB 15%,#C8C8CC 40%,#2A2A30 60%,#C8C8CC 85%,#FFFFFF 100%)

Semantic
  --err            #B5483F   (invalid-invite state only)

Radii            r-2 10px (inputs) · r-3 14px (card) · r-pill 999px (buttons)
Elevation        --elev-2: 0 0 0 1px rgba(255,255,255,0.05), 0 30px 80px rgba(0,0,0,0.6)
Motion           chrome-sweep 6s · shimmer 2.8s · mesh 90s · ease-out-expo cubic-bezier(0.16,1,0.3,1)
```

---

## Region-by-region spec

### 1. Page shell + ambient background

- Root wrapper background: `#0A0A0A` (replace `bg-[#0a0a0b]`).
- **Delete** the three grey gradient orbs and the `0.02`-opacity metallic grid.
- Replace them with two fixed, full-bleed, `pointer-events-none` layers:
  - **Drifting mesh** behind content (`z-0`): a blurred multi-radial silver-to-charcoal
    field at `opacity: 0.13`, animated on a **90s** ease-in-out loop. Use this exact
    background and keyframe:
    ```css
    .login-mesh {
      position: fixed; inset: -10%; z-index: 0; pointer-events: none;
      filter: blur(48px); opacity: 0.13;
      background:
        radial-gradient(58% 48% at 18% 28%, rgba(210,210,215,0.22), transparent 62%),
        radial-gradient(52% 42% at 82% 18%, rgba(245,245,247,0.16), transparent 60%),
        radial-gradient(70% 55% at 62% 88%, rgba(138,138,144,0.18), transparent 62%),
        radial-gradient(46% 38% at 8% 78%, rgba(180,180,186,0.12), transparent 60%);
      animation: login-mesh-drift 90s ease-in-out infinite;
    }
    @keyframes login-mesh-drift {
      0%,100% { transform: translate(0,0) rotate(0) scale(1); }
      50%     { transform: translate(-5%,4%) rotate(2.5deg) scale(1.04); }
    }
    ```
  - **Film grain** above everything (`z-[999]`), `opacity: 0.05`, `mix-blend-mode: overlay`,
    `pointer-events: none`, using an inline SVG `feTurbulence` data-URI:
    ```css
    .login-grain {
      position: fixed; inset: 0; z-index: 999; pointer-events: none;
      opacity: 0.05; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
    }
    ```
- Ensure `<main>` and `<nav>` sit above the mesh (`relative z-10`).

### 2. Top nav

- Keep it fixed, 64px tall, logo on the left.
- Background: `rgba(10,10,10,0.6)` with `backdrop-filter: blur(16px) saturate(140%)`.
- Bottom hairline border: `1px solid rgba(255,255,255,0.08)`.
- Wordmark stays **`/logo-dark.svg`, static** — no glint, no shimmer, no chrome-sweep
  on the mark itself. (The design system explicitly removed wordmark animation; the
  mark earns its keep by being well-drawn type.)

### 3. Heading block

- `"Welcome back"` / `"Create an account"` → render in **`font-serif` (Fraunces)**,
  weight 600, tight tracking (`-0.025em`), `font-variation-settings: 'opsz' 144`.
  Bump size up from `text-3xl` — aim ~`clamp(40px,5vw,56px)`.
- **Heading treatment — animated liquid-chrome.** Fill the heading text with the
  `metal-gradient-h` gradient clipped to the glyphs, sweeping horizontally on a **6s**
  linear loop:
  ```css
  .login-h1-chrome {
    background: linear-gradient(90deg,#FFFFFF 0%,#E8E8EB 15%,#C8C8CC 40%,#2A2A30 60%,#C8C8CC 85%,#FFFFFF 100%);
    background-size: 200% 100%;
    -webkit-background-clip: text; background-clip: text;
    color: transparent;
    animation: login-chrome-sweep 6s linear infinite;
  }
  @keyframes login-chrome-sweep { 0% { background-position:0% 50%; } 100% { background-position:200% 50%; } }
  ```
  > **Intentional exception — do not revert this.** The design system reserves the
  > 6s chrome-sweep for the landing-page hero H1 only. The product owner explicitly
  > chose animated liquid-chrome for this auth heading. Keep it animated. Under
  > `prefers-reduced-motion` it freezes to a static silver gradient (see §11).
- Subtitle below the heading: `font-sans`, colour `--fg-2` (`#B5B5BA`).
  - Login subtitle: keep `"Sign in to continue to your dashboard"`.
  - Signup subtitle: **rewrite** `"Start your AI-powered job search journey"` — "journey"
    is the exact AI-SaaS cliché the voice rules ban. Use:
    `"Make an account. Curated job matches start landing the same day."`
    (Editorial, specific, no banned words. The owner may tweak the exact words.)

### 4. Auth card

- Replace the zinc gradient fill + the absolutely-positioned "shine line" with a
  flat **charcoal card**: `background: #111114`, `border: 1px solid rgba(255,255,255,0.06)`,
  `border-radius: 14px`, box-shadow `--elev-2`
  (`0 0 0 1px rgba(255,255,255,0.05), 0 30px 80px rgba(0,0,0,0.6)`).
- Keep the `framer-motion` fade-up entrance. Keep `max-w-md`, padding ~`p-8`.

### 5. Sign in / Sign up tabs

- Keep the segmented control and the `framer-motion` `layoutId` sliding indicator.
- Track background `rgba(255,255,255,0.03)`, hairline `1px rgba(255,255,255,0.10)`.
- **Active** segment: indicator fill `rgba(255,255,255,0.06)` with a `rgba(255,255,255,0.16)`
  hairline; label colour `--fg-1`. **Inactive** label: `--fg-3`.
  (Silver tint, not copper — copper is reserved; an inactive↔active toggle is not a CTA.)
- Labels in **sentence case**: `"Sign in"`, `"Sign up"` (not "Sign In" / "Sign Up").

### 6. Form fields (login + signup)

- Keep the `Input` component, the icon prefixes (`Mail`, `Lock`, `User` — all Lucide,
  all fine), and the `Label`s.
- Field fill `#0E0E11`, border `1px solid rgba(255,255,255,0.10)`, radius `10px`,
  text `--fg-1`, placeholder `--fg-3`.
- **Focus state — copper, never the browser blue:** border → `#B87333`, plus
  `box-shadow: 0 0 0 3px rgba(184,115,51,0.18)`. Apply via `className` overrides on
  the login page only.
- Labels: `font-sans`, 12px, `--fg-3`, weight 500. The "Must be at least 6 characters"
  hint stays — colour `--fg-3`.

### 7. Primary CTA ("Sign in" / "Create account")

- This is *the* CTA — give it the copper treatment. Replace the white-block button with
  a **pill** (`border-radius: 999px`), full width, ~44–48px tall.
- Fill: the **copper-face** gradient
  `linear-gradient(180deg,#E8A87C 0%,#D2904A 18%,#B87333 40%,#6E4220 60%,#B87333 82%,#8E5A28 100%)`.
- Box-shadow:
  `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.35), 0 0 0 1px rgba(110,66,32,0.55), 0 18px 40px rgba(184,115,51,0.35)`.
- Label `#FFFFFF`, `text-shadow: 0 1px 0 rgba(0,0,0,0.35)`, weight 500.
- **Shimmer sweep on hover** (2.8s) — wrap the button as a shimmer host:
  ```css
  .login-shimmer { position: relative; overflow: hidden; isolation: isolate; }
  .login-shimmer::after {
    content:''; position:absolute; top:0; left:0; width:35%; height:100%;
    background: linear-gradient(100deg,transparent 0%,rgba(255,255,255,0) 30%,rgba(255,255,255,0.55) 50%,rgba(255,255,255,0) 70%,transparent 100%);
    transform: translateX(-120%) skewX(-12deg); mix-blend-mode: screen; opacity:0; pointer-events:none;
  }
  .login-shimmer:hover::after { opacity:1; animation: login-shimmer 2.8s ease-out 1; }
  @keyframes login-shimmer { 0%{transform:translateX(-120%) skewX(-12deg);} 100%{transform:translateX(220%) skewX(-12deg);} }
  ```
- Press state: `transform: scale(0.985)` over ~100ms. No colour flash.
- **Copy:** login button `"Sign in"` (keep the trailing `ArrowRight` — directional, allowed).
  Signup button `"Create account"` (was "Get Started"). **Remove the `Sparkles` icon
  entirely** — sparkle / twinkle / wand iconography is a hard system ban. Drop `Sparkles`
  from the `lucide-react` import too. Keep the `Loader2` spinner for the loading state.

### 8. Divider

- Keep the "Or continue with" rule. Treat the label as an **eyebrow**: uppercase,
  ~12px, letter-spacing `0.14em`, colour `--fg-3`. Rule line `1px rgba(255,255,255,0.06)`.
- The label's background chip currently uses `bg-zinc-900` to mask the rule — change it
  to `#111114` so it matches the new card fill.

### 9. Continue with Google

- Render as a **ghost pill**: transparent fill, `1px solid rgba(255,255,255,0.16)`
  border, `border-radius: 999px`, label `--fg-1`.
- Hover: border → `rgba(255,255,255,0.24)`, fill → `rgba(255,255,255,0.03)`.
- Keep the inline Google `G` SVG and the `"Continue with Google"` label.

### 10. Tester-invite banner — recolour off the forbidden palette

The banner currently uses **violet/purple** gradients and chips. Purple is explicitly
forbidden. Recolour both states (keep all conditional logic and the `framer-motion`
height animation):

- **Valid invite** → neutral silver-tinted charcoal panel, *not* copper (an invite
  notice is a status surface, not a CTA — copper would dilute its meaning):
  - Panel `background: #16161A`, border `1px solid rgba(255,255,255,0.10)`, radius `10px`.
  - Icon tile `background: rgba(255,255,255,0.06)`; `FlaskConical` icon in `--fg-1`.
  - Title `--fg-1`; sub-line `--fg-3`. Replace the `CheckCircle2` tick colour with `--fg-2`.
- **Invalid invite** → `--err` (`#B5483F`) tint:
  - Panel `background: rgba(181,72,63,0.10)`, border `1px solid rgba(181,72,63,0.22)`.
  - Icon tile `background: rgba(181,72,63,0.18)`; `XCircle` icon `#B5483F`.
  - Title and sub-line in `#B5483F` / a lighter `#D98A82`.
- `FlaskConical` and `XCircle` are Lucide line icons — keep both.

### 11. Terms line

- Keep the copy. Body text `--fg-3`; the `Terms` and `Privacy Policy` links `--fg-2`,
  hover → `--fg-1`. No copper here — these are not CTAs.

### 12. `LoginLoading` Suspense fallback

Update it too, or it flashes the old palette on load:
- Background `#0A0A0A` (replace `bg-[#0a0a0b]`).
- Spinner ring: base track `#2A2A30` (silver-7), spinning arc top-border `#C8C8CC`
  (silver-3) — replace the `zinc-800` / `zinc-400` borders.

---

## Focus, motion, and accessibility

- **Focus rings are copper, never blue.** Inputs use the copper border + 3px copper
  glow from §6. Buttons, tabs, and links use `outline: 2px solid #B87333;
  outline-offset: 2px` on `:focus-visible`.
- **`prefers-reduced-motion: reduce`** — every loop has a static fallback:
  - Heading chrome-sweep: `animation: none`; the `metal-gradient-h` stays as a static
    clipped silver fill (the text must never lose its fill).
  - Drifting mesh: `animation: none` (the field stays, frozen).
  - CTA shimmer: `::after { display: none }`.
  - Honour it for the `framer-motion` entrance too (e.g. `useReducedMotion()` to skip
    the fade-up, or render at rest).
- Maintain text contrast: copy on `#111114` / `#0A0A0A` stays at `--fg-1`/`--fg-2`;
  do not drop body text onto a metal gradient.
- All animation cycles stay in the system's 4–8s band (mesh is the documented
  ambient exception at 90s). Do not speed the shimmer below 2.5s.

## Voice / copy changes — summary

| Where | From | To |
|---|---|---|
| Signup subtitle | "Start your AI-powered job search journey" | "Make an account. Curated job matches start landing the same day." |
| Login CTA | "Sign In" | "Sign in" |
| Signup CTA | "Get Started" + `Sparkles` icon | "Create account" (no icon) |
| Tabs | "Sign In" / "Sign Up" | "Sign in" / "Sign up" |

Sentence case for all headings, buttons, tabs, eyebrows. No emoji. No sparkle iconography.

## Acceptance checklist

- [ ] No grey gradient orbs / grid; drifting mesh (13%, 90s) + film grain (5%) instead.
- [ ] Heading is Fraunces with the animated 6s liquid-chrome fill; static under reduced motion.
- [ ] Card is flat charcoal `#111114` with a `rgba(255,255,255,0.06)` hairline, 14px radius.
- [ ] Primary CTA is a copper-face pill with the 2.8s hover shimmer; press scales to 0.985.
- [ ] Google button is a ghost pill; tabs use silver tint, not copper.
- [ ] Inputs focus to a copper border + 3px copper glow — never browser blue.
- [ ] Tester banner has zero purple: valid = silver-charcoal, invalid = `--err` red.
- [ ] `Sparkles` removed from markup and the `lucide-react` import; wordmark static.
- [ ] `LoginLoading` fallback uses `#0A0A0A` + silver spinner.
- [ ] No change to auth logic, Supabase calls, invite flow, routing, or `PublicFooter`.
- [ ] `npm run lint` and `npm run build` both pass.
