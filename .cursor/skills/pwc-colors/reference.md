# PwC colors reference

Evidence for agents. Prefer `SKILL.md` recipes and `src/app/globals.css` over third-party hex lists.

## Confirmed (public)

| Claim | Status | Source |
|---|---|---|
| Apr 2025 brand refresh keeps / emphasizes orange as signature colour | Confirmed | [Time for change](https://www.pwc.com/gx/en/news-room/time-for-change.html) (Antonia Wade, 29 Apr 2025); network press releases (e.g. [PwC South Africa](https://www.pwc.co.za/en/press-room/pwc-new-brand-positioning.html)) |
| New visual identity: momentum mark, signature orange, bold / collaborative / optimistic voice | Confirmed | Same press materials; campaign "So You Can" |
| Official digital brand portal exists | Confirmed (login-walled) | https://brand.pwc.com/key-brand-guidelines.html (no public hex dump) |
| Black + orange remain primary | Confirmed (trade press) | e.g. consultancy.eu coverage of the 2025 refresh |

Public press does **not** publish a digital hex for the 2025 signature orange.

## Inferred / observed (not official brandbook)

| Claim | Status | Notes |
|---|---|---|
| `#FD5108` as live digital orange | Observed | Matches this app (`globals.css`, icons); also extracted from pwc.com favicon on third-party favicon tools. Treat as **app + web observation**, not a published Pantone sheet |
| `--pwc-orange-hover` `#E04A07` | App-defined | Darker step of `#FD5108` for button hover |
| Muted alphas 0.15 / 0.12 | App-defined | Soft wash liked on the welcome / greetings bar |

## Legacy public palette (pre-2025 style guides)

Older Visual Identity materials and aggregator sites list a warm print/digital set. Useful historically; **do not swap UI orange to these without an explicit ask**.

| Name | HEX (typical) | Notes |
|---|---|---|
| Yellow | `#FFB600` | PMS 130 |
| Tangerine | `#EB8C00` | PMS 144 |
| Orange | `#D04A02` | PMS 1665 (legacy signature orange on many public lists) |
| Rose | `#DB536A` | PMS 710 |
| Red | `#E0301E` | PMS 179 |
| Black | `#000000` | |
| Dark grey | `#2D2D2D` | Process black 90% (aligns with app elevated dark) |
| Medium grey | `#464646` | |
| Grey | `#7D7D7D` | |
| Light grey | `#DEDEDE` | |

Cited examples (third-party / older guidance, not 2025 portal):

- Intersect Digital AU PDF excerpt circulating as "Visual Identity Guidance" (warm five + greys, includes `#2D2D2D`)
- Aggregators: brandcolorcode.com, colorcodeshub.com (repeat `#D04A02` orange)

## Gaps

1. Exact 2025 digital hex, Pantone, and tint/shade ramps are behind **brand.pwc.com** (internal login).
2. No public confirmation that `#FD5108` is the official 2025 signature orange; it is the **Office Pulse source of truth**.
3. Do not invent secondary brand hues from AI defaults. If marketing supplies an updated token list, update `globals.css` first, then this skill.

## App file map

| File | Why |
|---|---|
| `src/app/globals.css` | Token definitions, theme overrides, `.card-wash` / `.page-hero` / `.auth-shell` |
| `src/components/dashboard/WelcomeBanner.tsx` | Canonical muted wash + left rail |
| `src/app/icon.svg`, `apple-icon.svg` | Hardcoded `#FD5108` / `#1A1A1A` for favicons |

## Secondary warm accents (optional)

Public 2025 press confirms a multi-color visual system around signature orange (red / rose / yellow / tangerine family). Exact 2025 digital hexes are not public; this app maps secondary tokens to the well-circulated legacy VI warm set (`--pwc-yellow`, `--pwc-tangerine`, `--pwc-rose`, `--pwc-red`) for charts and rare series only. Do not promote them to primary chrome.
