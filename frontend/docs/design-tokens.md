# Design tokens

Source of truth: `src/index.css` (CSS variables, light and dark). Motion values in seconds: `src/lib/motion.ts`. Theme switching: `src/lib/theme.ts`.

## Colour

Powder-blue base, pale-white surfaces, one green accent for the primary action, focus and selection. Risk has its own tones (blue "On schedule", amber "At risk", red "Delayed") and always comes with an icon and a word, so the green accent is never read as a risk level. Light is the default (projectors wash out dark themes); dark is a toggle.

| Token | Light | Dark | Use |
|---|---|---|---|
| canvas | `#D3E4F1` powder blue | `#0F1C28` | Page background, with a soft fixed daylight glow |
| surface / raised | `#FBFCFA` pale white / `#FFFFFF` | `#152535` / `#1A2D40` | Panels, inputs |
| sunken | `#E6EFF6` | `#1B3045` | Tracks, skeletons, disabled |
| line / line-strong | `#C4D6E4` / `#9DB6CA` | `#24394D` / `#3A5570` | Borders |
| ink / ink-2 / muted | `#14263A` / `#2B4258` / `#4B6074` | `#E3EDF5` / `#C2D3E2` / `#93A8BB` | Text |
| accent | `#17794A` green (soft `#DCF0E3`) | `#6FD19A` (soft `#15372A`) | Primary action, focus ring, selection, routes |
| rail | `#13283C` navy | `#0A1520` | Coordinator navigation, login panel, headline impact tile |
| low | `#24577C` on `#DBE8F3` | `#9CC6E8` on `#16324A` | On schedule |
| medium | `#7A4C00` on `#F6E7C6` | `#E3B66A` on `#3A2E15` | At risk |
| high | `#9A3228` on `#F6DCD7` | `#F0A096` on `#3D201C` | Delayed |

## Contrast (WCAG ratio, computed)

| Pair | Light | Dark |
|---|---|---|
| ink on canvas / surface | 11.80 / 14.92 | 14.54 |
| muted on surface / canvas / sunken | 6.33 / 5.00 / 5.60 | 6.35 |
| accent on surface | 5.27 | 8.36 |
| on-accent on accent | 5.43 | 9.14 |
| low / medium / high on their soft | 6.17 / 6.00 / 5.64 | 7.33 / 7.06 / 7.16 |
| rail text / muted / accent on rail | 11.60 / 6.32 / 8.63 | |

## Type

Bricolage Grotesque (variable) for headings and headline figures; Figtree (variable) for body and interface text; JetBrains Mono for shipment IDs and the replay clock. Tabular figures (`.tnum`) on every time, duration and distance.

| Token | Size / line height | Use |
|---|---|---|
| meta | 13 / 20 | Labels, captions |
| body | 15 / 24 | Default |
| lead | 17 / 26 | Headlines, emphasised lines |
| heading | 21 / 28 | Section titles, queue ETAs |
| figure | 30 / 36 | ETA, page titles |
| driver | 44 / 48 | Driver figures and main button |

## Shape, space, motion

- Radius rule: badges 6 px, controls 10 px, panels 16 px. Journey bar and factor bar are fully rounded tracks.
- Effects: panels sit on a blue-tinted soft shadow and lift on hover when clickable; primary buttons have an inner highlight and a green glow on hover; a fixed daylight glow and fine grain sit on the page (both fixed layers, never repainted on scroll). Summary and impact numbers count up.
- Motion: 150 / 220 / 300 ms, ease-out `cubic-bezier(0.22, 1, 0.36, 1)`; nothing bounces or loops. Animated: page fade-in, sliding rail indicator, queue rows re-ordering, value cross-fades, factor bar growing in, journey marker gliding, option rows staggering, toasts, theme icon. Transforms switch off under `prefers-reduced-motion`; fades remain.
