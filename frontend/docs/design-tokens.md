# Design tokens

Source of truth: `src/index.css` (CSS variables, light and dark). Motion values in seconds: `src/lib/motion.ts`. Theme switching: `src/lib/theme.ts`.

## Colour

Muted sage-slate neutrals with one contrasting accent. Colour carries meaning: cobalt is the primary action, focus and selection; muted green, amber and red are reserved for risk and always come with an icon and a word. Light is the default (projectors wash out dark themes); dark is a toggle.

| Token | Light | Dark | Use |
|---|---|---|---|
| canvas | `#E8ECE9` | `#111714` | Page background |
| surface / raised | `#F6F8F6` / `#FFFFFF` | `#18201C` / `#1D2622` | Panels, inputs, hover |
| sunken | `#DCE2DE` | `#212B26` | Tracks, skeletons, disabled |
| line / line-strong | `#CBD3CE` / `#A9B4AE` | `#2C3832` / `#44524B` | Borders |
| ink / ink-2 / muted | `#18211E` / `#34403B` / `#56635D` | `#E6ECE8` / `#C3CEC8` / `#93A29A` | Text |
| accent | `#2F45C8` (soft `#DFE4F7`) | `#9AAAFF` (soft `#232C55`) | Primary action, focus ring, selection, routes |
| rail | `#17201D` | `#0C110F` | Coordinator navigation, login panel, headline impact tile |
| low | `#2E6A4C` on `#D6E8DC` | `#8CCBA5` on `#1C3327` | On schedule |
| medium | `#7A4C00` on `#F1E2C2` | `#E3B66A` on `#3A2E15` | At risk |
| high | `#9A3228` on `#F2D8D3` | `#F0A096` on `#3D201C` | Delayed |

## Contrast (WCAG ratio, computed)

| Pair | Light | Dark |
|---|---|---|
| ink on surface | 15.43 | 13.89 |
| muted on surface / sunken | 5.89 / 4.79 | 6.24 / 5.48 |
| accent on surface | 7.01 | 7.58 |
| on-accent on accent | 7.48 | 8.18 |
| low / medium / high on their soft | 5.01 / 5.73 / 5.43 | 7.22 / 7.06 / 7.16 |
| rail text / rail muted on rail | 10.86 / 5.43 | |

## Type

Geist (variable) for everything; Geist Mono for shipment IDs and the replay clock. Tabular figures (`.tnum`) on every time, duration and distance.

| Token | Size / line height | Use |
|---|---|---|
| meta | 13 / 20 | Labels, captions |
| body | 15 / 24 | Default |
| lead | 17 / 26 | Headlines, emphasised lines |
| heading | 21 / 28 | Section titles, queue ETAs |
| figure | 30 / 36 | ETA, page titles |
| driver | 44 / 48 | Driver figures and main button |

## Shape, space, motion

- Radius rule: badges 6 px, controls 8 px, panels 14 px. Journey bar and factor bar are fully rounded tracks.
- No shadows or gradients. 1 px borders separate surfaces; the dark rail gives the coordinator view its structure.
- Motion: 150 / 220 / 300 ms, ease-out `cubic-bezier(0.22, 1, 0.36, 1)`; nothing bounces or loops. Animated: page fade-in, sliding rail indicator, queue rows re-ordering, value cross-fades, factor bar growing in, journey marker gliding, option rows staggering, toasts, theme icon. Transforms switch off under `prefers-reduced-motion`; fades remain.
