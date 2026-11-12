# Design tokens

Source of truth: `src/index.css` (`@theme`). Motion values in seconds: `src/lib/motion.ts`.

## Colour

Colour carries meaning only: risk levels and the primary action. Everything else is grey.

| Token | Hex | Use |
|---|---|---|
| canvas | `#F5F6F7` | Page background |
| surface | `#FFFFFF` | Cards, tables |
| sunken | `#EEF0F2` | Skeletons, hover, disabled buttons |
| line / line-strong | `#DDE1E5` / `#B9C0C7` | Borders, dividers |
| ink / ink-2 / muted | `#14181D` / `#353C44` / `#535B64` | Text, primary to tertiary |
| accent | `#0B5566` (hover `#08414E`, soft `#E3EFF2`) | The one accent: primary action, focus ring, selection, headline figure |
| low | `#1D6B3C` on `#E6F2EA` | "On schedule" (with a check icon) |
| medium | `#8A4B00` on `#FCEFD9` | "At risk" (with a circled warning icon) |
| high | `#A3171C` on `#FBE6E6` | "Delayed" (with an octagon warning icon) |

Risk is always icon + word; the three icons have different shapes so the level reads without colour.

## Contrast (WCAG 2.x ratio, computed)

| Pair | Ratio |
|---|---|
| ink on surface / canvas | 17.82 / 16.47 |
| ink-2 on surface | 11.16 |
| muted on surface / canvas / sunken | 6.89 / 6.37 / 6.03 |
| white on accent, accent on surface | 8.38 |
| accent on accent-soft | 7.14 |
| low on low-soft | 5.67 |
| medium on medium-soft | 5.99 |
| high on high-soft / surface | 6.51 / 7.79 |
| ink-2 on sunken (disabled button) | above 10 |

## Type

One family, IBM Plex Sans (400, 500, 600), self-hosted. Tabular figures (`.tnum`) on every time, duration, distance and count.

| Token | Size / line height | Use |
|---|---|---|
| meta | 13 / 20 | Labels, captions |
| body | 15 / 24 | Default |
| lead | 17 / 26 | Headlines, emphasised lines |
| heading | 20 / 28 | Section and step titles |
| figure | 28 / 34 | ETA and page titles |
| driver | 40 / 46 | Driver screen figures and main button |

## Space, radius, motion

- Spacing: Tailwind 4 px scale, used at 1, 2, 3, 4, 5, 6, 8.
- Radius: 4 px (badges), 6 px (buttons, inputs), 10 px (cards). No pills on containers.
- No shadows, no gradients. 1 px borders separate surfaces.
- Motion: 150 ms (fast), 220 ms (base), 300 ms (slow); ease-out `cubic-bezier(0.22, 1, 0.36, 1)`. Nothing bounces or loops. Transforms off under `prefers-reduced-motion`; fades remain.
