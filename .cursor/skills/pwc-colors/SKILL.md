---
name: pwc-colors
description: >-
  Applies PwC Office Pulse brand colors using existing CSS tokens
  (--pwc-orange, --pwc-orange-muted, dark/light neutrals). Use when styling UI,
  welcome/greeting banners, accent rails, chips, buttons, borders, muted orange
  washes, light/dark theme tints, or when the user asks for PwC colors /
  pwc-colors / brand palette in OfficeTracker.
---

# PwC colors (Office Pulse)

Canonical palette for this app lives in `src/app/globals.css`. Prefer those CSS variables. Do not invent new brand hues.

## Source of truth (repo)

| Token | Value | Role |
|---|---|---|
| `--pwc-orange` | `#FD5108` | Signature accent (buttons, text-accent, rails, icons) |
| `--pwc-orange-hover` | `#E04A07` | Primary button hover; unmet chart bars |
| `--pwc-orange-muted` | `rgba(253, 81, 8, 0.15)` dark; `0.12` light | Soft wash / badge fill |
| `--pwc-yellow` | `#FFB600` | Secondary warm (charts / rare accents only) |
| `--pwc-tangerine` | `#EB8C00` | Secondary warm (e.g. "not in office" series) |
| `--pwc-rose` | `#DB536A` | Secondary warm (rare series accents) |
| `--pwc-red` | `#E0301E` | Secondary warm (prefer semantic danger red for errors) |
| `--background` | `#1A1A1A` dark; `#F4F4F4` light | Page |
| `--background-elevated` | `#2D2D2D` dark; `#FFFFFF` light | Cards / panels |
| `--foreground` | `#FFFFFF` dark; `#1A1A1A` light | Body text |
| `--muted` | `#B3B3B3` dark; `#5C5C5C` light | Secondary text |
| `--border` | `#404040` dark; `#D4D4D4` light | Hairlines |
| `--success` | `#2ECC71` | Met / positive only |

Hex case in CSS may be lowercase (`#fd5108`); treat as identical to `#FD5108`.

Secondary warm tokens mirror the 2025 multi-color family (orange / red / rose / yellow / tangerine) as documented in [reference.md](reference.md). They are **not** chrome colors. Keep primary UI on `--pwc-orange` + neutrals.

**Anchor pattern** (user-preferred greetings bar): `WelcomeBanner.tsx` left rail + muted wash.

```tsx
className="card card-brand card-wash relative overflow-hidden p-0"
```

## When to apply

| Pattern | Use |
|---|---|
| Soft wash | `.card-wash` or `.page-hero` on welcome strips, page intros, highlighted primary panels |
| Left accent rail | `.card-brand` or `border-l-4 border-l-[var(--pwc-orange)]` |
| Chips / badges | Pending or brand-tagged chips: `bg-[var(--pwc-orange-muted)] text-[var(--pwc-orange)]` (see `.badge-pending`) |
| Primary buttons | `.btn-primary` (uses `--pwc-orange` / `--pwc-orange-hover`) |
| Secondary / outline | `.btn-secondary`; hover border + text to `--pwc-orange` |
| Borders | Attention callouts: `border-[var(--pwc-orange)]/40` to `/50`; selected rings: `ring-[var(--pwc-orange)]` |
| Text accent | `.text-accent` or `text-[var(--pwc-orange)]` for links, active nav, key numbers |
| Progress | `.progress-fill` uses orange; met state uses `--success` |
| Auth shell | `.auth-shell` soft page wash behind login |

## Recipes (copy these)

**Muted wash (preferred soft tint):**
```css
/* Prefer utility classes */
.card-wash { /* gradient + elevated fill */ }
.page-hero { /* wash + left rail for page titles */ }
```

Or raw:
```css
background:
  linear-gradient(105deg, var(--pwc-orange-muted) 0%, transparent 55%),
  var(--background-elevated);
```

**Solid muted fill (chips, alert strips):**
```html
class="bg-[var(--pwc-orange-muted)] text-[var(--pwc-orange)]"
```

**Subtle selected / hover fills (Tailwind alpha on orange):**
```html
class="bg-[var(--pwc-orange)]/5 hover:bg-[var(--pwc-orange)]/10"
class="bg-[var(--pwc-orange)]/15 text-accent"
class="bg-[var(--pwc-orange)]/20"
```

**Callout border:**
```html
class="border border-[var(--pwc-orange)]/40 bg-[var(--pwc-orange-muted)]"
```

**Primary CTA:** use `.btn-primary`, not a one-off hex.

**Focus ring:** already `outline: 2px solid var(--pwc-orange)` on form controls in `globals.css`.

### Light vs dark muted alphas

- Dark (default): `--pwc-orange-muted` = `rgba(253, 81, 8, 0.15)`
- Light: overridden to `rgba(253, 81, 8, 0.12)` under `html[data-theme="light"]`
- Prefer the token over hardcoding `rgba(...)` so both themes stay correct
- If you need a one-off alpha, stay on the same RGB `(253, 81, 8)` and only change alpha
- Always layer wash **over** `--background-elevated` so light mode fades to white card, not page grey

### Clutter rule

Do **not** paint every nested card or KPI tile with `.card-wash`. Prefer: page-hero / welcome / one primary section card per view. Keep meters and dense tables readable.

### View-as banner (exception)

Uses amber wash `rgba(253, 176, 8, ...)`, not signature orange. Do not restyle it to `--pwc-orange` unless asked.

## When NOT to invent new hues

- Do **not** add purple, indigo, violet, or teal "AI" accents
- Do **not** replace orange with legacy print orange `#D04A02` in UI (see [reference.md](reference.md))
- Do **not** invent new CSS brand tokens beyond the warm secondary set above without an explicit product ask
- Do **not** use warm cream + terracotta or purple-on-white default AI looks
- Semantic status only: green = met/success; red = error/danger; amber = caution / view-as. Brand chrome stays orange + neutrals
- Desk clock LED (`--deskclock-accent`) is a local functional color, not a brand expansion
- Prefer `.text-accent` over Tailwind blue for admin action links

## Copy / style constraints (shared with office-tracker)

- **No em dashes** (the Unicode em dash character) in copy, comments, commits, or docs. Use a hyphen (`-`), comma, colon, or parentheses
- Direct internal IT voice; no ChatGPT filler

## Workflow

1. Read `src/app/globals.css` tokens before adding color
2. Match an existing pattern (WelcomeBanner, `.page-hero`, `.badge-pending`, `.btn-primary`, SectionNav active rail)
3. Use `var(--pwc-orange*)` / theme neutrals; avoid raw hex except SVGs/icons that already use `#FD5108` / `#1A1A1A`
4. Check light and dark if the surface is theme-sensitive

## Additional resources

- Sources, legacy palette, confirmed vs inferred: [reference.md](reference.md)
- Product skill: `../office-tracker/SKILL.md`
