# Redline design system: "Redline Dark"

Chosen by the owner on 2026-11-17 (`.impeccable/mocks/decision/calculator-options.html`, option 1), after rejecting a yellow "Price Card" redesign as off-brand, too big and too spaced out. Redline keeps its own look: opaque charcoal surfaces, hairline edges, one automotive red, the Geist font, compact sizing. Dark is the default; Light (white cards, the same red) is in Settings.

Source of truth: `src/styles.css` (tokens and shared classes). This file explains the rules.

## Principles

1. **Redline's own feel.** Charcoal and red, Geist, compact. No highlighter strokes, no gradients or glows.
2. **The monthly figure is the answer.** On quote screens it sits in a one-line strip ("Monthly · 9 yrs   RM 1,213.71"), bold, in the app colour (`.fig.hl`).
3. **One obvious next step.** At most one `btn-primary` (solid red) per screen; everything else is `btn-outline` or a quiet `btn`.
4. **Normal sizes, easy taps.** Body 16px, labels 14px, captions 13px (`text-xs` is nudged up from 12px). Everything pressable is at least 44px tall on touch screens (enforced in `styles.css` under `pointer: coarse`).
5. **Words beside icons.** Every menu item has its name.

## Colour

- Dark (default): page `oklch(0.13 …)`, cards `0.185`, popovers `0.215`, hairline borders `white / 8%`, field outlines `white / 14%`.
- Light: soft grey page, white cards, the same red.
- **One colour** (`--acc-*`): the account's single Colour (Settings → Appearance; Redline red by default, one of the eight poster colours) drives the posters *and* the app. `applyAppColour()` (src/app/shared/app-colour.ts) sets the tokens from the chosen poster colour; ThemeService keeps it in step with the account, the customer link uses the advisor's colour, and `public/theme-init.js` paints the last colour before the app starts. `--primary` is the fill (only under `--primary-foreground`); `text-brand` is the colour as readable text; `--shell-accent` is the colour as text on the menu; `bg-brand-soft` is a pale tint for selected tiles.
- WhatsApp keeps its own green (`btn-whatsapp`).
- Posters, the Live Screen and brochures keep their own fixed design and poster colour; app styling must not reach into them.

## Layout and navigation

- **Computer / tablet (md+)**: menu rail on the left (labelled, can be made narrow), title bar with Help on the right.
- **Phone**: title bar with a hamburger button on the left; it slides the same menu in from the left. No bottom bar (owner preference).
- The menu lists the work pages (Calculator to Price Settings). My Profile, Settings and Log out live in the account menu at the bottom of it (owner preference: nothing listed twice).
- **Calculator**: the page itself never scrolls. The monthly strip and the Preview/Customize and template tabs stay at the top, Save/Share stay at the bottom, and only the poster scrolls between them, at every screen size. On a computer the Customize panel scrolls on its own beside it.
- The start page is the Calculator unless changed in Settings → Make it yours.

## Components (classes in `styles.css`)

| Class | Use |
|---|---|
| `.btn` | Base button. Alone = quiet text button. |
| `.btn-primary` | The one main action (solid red). |
| `.btn-outline` | Every other pressable action. |
| `.btn-whatsapp` | Anything that opens WhatsApp. |
| `.btn-lg` | Bottom-of-screen actions (Save / Share). |
| `.fig` / `.hl` | Money figures / in the app colour. |
| `.hl-solid` | Filled number badges (guide steps). |
| `.hint` | Plain-language help under a heading or field. |
| `.empty-state` | First-use empty screens: what will be here, then what to do first. |

## Guidance (new users)

- **Welcome**: shown once per account per device to someone who hasn't shared a quote yet; "Show me around" runs the Calculator tour.
- **Help** on every signed-in page: what the page is for, numbered steps, "Show me on the screen" (spotlight tour using `data-tour` targets), and the First steps checklist.
- Page guides live in `src/app/shared/guide.service.ts` (`GUIDES`). A new page needs an entry there and `data-tour` attributes.
- All new wording has Bahasa Melayu entries in `i18n-ms.ts`.

## Where settings live

- **Price Settings**: two tabs. *Cars* (each car's price, rebates, rate, insurance) and *Quote defaults* (deposit, NCD, rate type, default rates, repayment table years; Advanced: additional rebate, loan rounding, cash back). Open the tab directly with `/price-settings?tab=defaults`.
- **My Profile**: your details, plus *Your brands* (Primary Brand, Brands I sell) and the customer link's *Book test drive* switch.
- **Settings**: Appearance (theme, Colour), Make it yours (Comfortable/Compact, Reduce motion, start page; saved on the device), Language, Account (export, reset, password, delete).
- Festive frames were removed (owner decision, 2026-11-18).

## Don'ts

- No yellow-highlighter "price card" look, no oversized type or spacing, no bottom tab bar on the phone (all rejected by the owner).
- No gradients, glows or glass on app chrome.
- Never use a real person's name, phone or email as placeholder or sample data.
- Don't style inside the poster canvases or the Live Screen.
