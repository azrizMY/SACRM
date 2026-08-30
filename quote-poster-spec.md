# Quotation Poster â Design Spec

Rebuild the quotation preview to match this spec exactly. All values are in
design pixels on a **900 Ã 1168** canvas (ratio 1 : 1.298). Export at **2Ã**
â 1800 Ã 2336 PNG.

Left/right margin `M = 56` everywhere. Full-bleed bands ignore `M`.

---

## Colour tokens

| Token | Hex | Used for |
|---|---|---|
| `--acc` | `#D61E2A` | red accent: slash, 2026 tag, rules, spines, 9-Yrs row, phone label |
| `--acc-dark` | `#960E1A` | reserved (gradient partner) |
| `--paper` | `#FFFFFF` | header + car area background |
| `--ink` | `#121214` | headline, logo, dark text on white |
| `--gray` | `#707078` | eyebrow, sub-labels on white |
| `--gray-d` | `#9898A0` | date, section labels on white |
| `--panel-a` | `#151519` | price panel gradient start (left) |
| `--panel-b` | `#0C0C0F` | price panel gradient end (right) |
| `--panel-card` | `#2C2C32` | downpayment / loan / avatar tiles |
| `--panel-gray` | `#9E9EA8` | labels inside dark areas |
| `--panel-gray-d` | `#767680` | section labels on dark |
| `--data-bg` | `#101013` | background of the whole lower data section |
| `--hairline` | `#26262C` | 1px divider under the price panel |
| `--block` | `#1E1E23` | breakdown table body, tenure cards |
| `--block-total` | `#0D0D10` | total-amount strip |
| `--partition` | `#36363D` | 1px lines between breakdown rows |
| `--green` | `#34C77B` | rebate figure + "you save" tag |
| `--amber` | `#F0B040` | insurance figure (additive cost) |
| `--wa-green` | `#25D366` | WhatsApp icon |
| `--footer-a` | `#0D0D10` | footer gradient start |
| `--footer-b` | `#08080A` | footer gradient end |

---

## Typography

Two families only.

- **Display** â a condensed grotesque at weight 700. Used for the headline,
  every currency figure, names, and the CTA. Use `Barlow Semi Condensed 700`
  or `Roboto Condensed 700`.
- **Label** â a neutral sans (`Inter`, `Arial`, `Helvetica`). Used for row
  labels, small caps labels, sub-text.

All-caps micro labels use the Label family, weight 700, with the
letter-spacing given per element.

---

## Vertical map

| Band | y range | Height |
|---|---|---|
| Header (white) | 0 â 168 | 168 |
| Car hero (white) | 168 â 466 | 298 |
| Price panel (dark, full-bleed) | 492 â 742 | 250 |
| Data section (dark, full-bleed) | 742 â 1048 | 306 |
| Footer (dark, full-bleed) | 1048 â 1168 | 120 |

---

## 1. Header â background `--paper`

- **Red slash**: parallelogram, 4px wide, 16px tall, 6px skew. Left edge from
  `(M, 56)` to `(M+6, 40)`. Fill `--acc`.
- **Eyebrow** "VEHICLE LOAN ESTIMATE": Label 700, **9.5px**, letter-spacing
  **2.8px**, colour `--gray`, left `M+16`, vertical centre `y=48`.
- **Chery logo**: width **104px** (height auto â 44px), top `y=34`, right edge
  flush to `WâM = 844`. Use the official logo asset in `--ink`.
- **Headline** "Tiggo Cross Turbo": Display 700, **46px**, `--ink`, left `M`,
  baseline `y=108`.
- **2026 tag**: parallelogram 76 Ã 24, top-left `(M+8, 122)`, bottom-left
  `(M, 146)`, fill `--acc`. Text "2026" Label 700 **12px** white, centred.
- **Date**: Label 400 **12.5px**, `--gray-d`, right-aligned to `844`,
  centre `y=134`. Keep it on its own line under the logo.

## 2. Car hero â background `--paper`

- Car image **528 Ã 298**, horizontally centred (x = 186), top `y=168`.
- Requires a **transparent-background PNG**. Do not put the car in a card,
  panel, or bordered box.
- **Contact shadow** only â no reflection, no glow. Ellipse from
  `(x+74, y+278)` to `(x+454, y+304)`, fill `rgba(70,70,78,0.43)`,
  Gaussian blur **8px**. Renders as `box-shadow`/blurred div beneath the car.

## 3. Price panel â full-bleed, `y = 492 â 742`

- Background: horizontal linear-gradient `--panel-a` â `--panel-b`.
- **Top rule**: 3px `--acc`, full width, at `y=492`.
- **Accent bar**: 38 Ã 3, `--acc`, at `(M, 522)`.
- **"SELLING PRICE"**: Label 700 9.5px, ls 2.8px, `--panel-gray`,
  left `M`, centre `y=550`.
- **Selling price**: Display 700 **50px**, white, left `M`, baseline `y=610`.
- **Two stat boxes**, `y=634`, height **74**, width **196**,
  x = `M` and `M+210`:
  - Top-right corner notched **14px** (`clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)`).
  - Fill `--panel-card`. **Left spine 3px `--acc`**, full height.
  - Label ("DOWNPAYMENT" / "LOAN AMOUNT"): Label 700 9px, ls 2.2px,
    `--panel-gray`, left `box+18`, centre `box_y+24`.
  - Value: Display 700 **22px**, white, left `box+18`, centre `box_y+54`.
- **Consultant block** (right side, must stay in this band â it is the
  anti-crop anchor):
  - Avatar tile **64 Ã 64** at `(528, 550)`, notch 14px, fill `--panel-card`.
    Photo fills the tile; fall back to initials in Display 700 22px `--acc`.
  - Name: Display 700 **23px**, white, left `610`, centre `y=576`.
  - Role: Label 400 **12px**, `--panel-gray`, left `610`, centre `y=599`.
  - "WHATSAPP": Label 700 9px, ls 2.2px, `--panel-gray-d`, left `528`,
    centre `y=660`.
  - Phone: Display 700 **26px**, `--acc`, left `528`, centre `y=692`.

## 4. Data section â full-bleed, `y = 742 â 1048`, background `--data-bg`

1px `--hairline` across the top at `y=742`.

Two columns: **left x = 56, width 372** Â· **right x = 488, width 356**.
Both section labels sit at centre `y=788`, Label 700 9.5px, ls 2.8px,
`--panel-gray-d`. "2.3% FLAT" is right-aligned to `844` in `--acc`.

### Price breakdown (left)

Single block starting `y=816`, fill `--block`, width 372.

- **3 rows of 46px** each, separated by 1px `--partition` lines
  (no line above the first row, none below the last).
  - Label: Label 400 **14px**, `#ECECF0`, left `74`.
  - Sub-label in parentheses: Label 400 **11px**, `--panel-gray`, 6px after
    the label, same baseline.
  - Value: Label 700 **14.5px**, right-aligned to `410`.
  - **Row colours**: OTR price â white Â· Insurance â `--amber` Â·
    Rebate â `--green`, and its sub-label is the word "you save" in
    `--green` instead of a parenthetical.
- **Total strip**, 68px tall, directly below the rows, fill `--block-total`:
  - **4px `--acc` spine** on the left edge, full height.
  - "TOTAL AMOUNT DUE": Label 700 9px, ls 2.2px, `--panel-gray`,
    left `76`, centre `y=977`.
  - Figure: Display 700 **27px**, white, left `76`, centre `y=1002`.
  - The total is stacked (label above figure), not a left/right row â this is
    what separates it from the rows above.

### Monthly estimate (right)

Three cards, height **56**, gap **10**, starting `y=816`
(so 816 / 882 / 948). Each has a 14px notch on the top-right corner.

- **Lowest row (9 Yrs)**: fill `--acc`. Label Label 700 13px white, left
  `RX+18`. White pill 54 Ã 18 at `RX+74` containing "LOWEST" in Label 700
  7.5px, ls 1.3px, `--acc`. Figure Display 700 **23px** white, right-aligned
  to `826`.
- **Other rows**: fill `--block`, label `--panel-gray`, figure white,
  same sizes and positions.
- Tenure labels are abbreviated: "9 Yrs", "7 Yrs", "5 Yrs".

## 5. Footer â full-bleed, `y = 1048 â 1168`

- Background: horizontal gradient `--footer-a` â `--footer-b`.
- **Top rule**: 3px `--acc`, full width.
- **WhatsApp icon**: 44 Ã 44 at `(56, 1088)`. Use the official WhatsApp mark
  in `--wa-green`. Do not substitute a generic chat glyph.
- "WhatsApp me now": Display 700 **25px**, white, left `116`, centre `y=1100`.
- Sub-line "Check your eligibility before the current promotion ends":
  Label 400 **12px**, `--panel-gray`, left `116`, centre `y=1126`.
- Phone: Display 700 **30px**, **white** (not red), right-aligned to `844`,
  centre `y=1112`.

---

## Optional "What's included" section

Not rendered when the list is empty. When present it sits **between the price
panel and the data section**, and everything below shifts down by its height.

- Label "WHAT'S INCLUDED": Label 700 9.5px, ls 2.8px, `--panel-gray-d`,
  left `M`, at `panel_bottom + 42`.
- Chips 40px tall, 10px gap, starting 28px below the label. Fill `--block`,
  14px notch on the top-right corner, padding 18px, green check mark then
  the text in Label 400 13px white.
- Chips wrap to a new row when they exceed `900 â 2M`.
- Section height = `28 + rows Ã 40 + (rows â 1) Ã 10`, plus 32px before the
  data section. With the list empty, the gap between panel and data section
  is **46px** (the value baked into the map above).

---

## Rules that must not be broken

1. **Red is an accent, never a field.** It appears only as: the slash, the
   2026 tag, three 3â4px rules/spines, the 9-Yrs row, and the consultant's
   phone number. No large red fills â the footer is dark, not red.
2. **The consultant block stays inside the price panel**, at the vertical
   centre of the poster. It must not move to the footer: welding it to the
   selling price is what stops a customer cropping the SA out.
3. **Only two type families**, and every currency figure uses the condensed
   Display face.
4. **The car sits on white with a contact shadow only.**
5. Total height is derived, not fixed: `footer_y + 120`, where `footer_y`
   follows from the data section, which follows from the optional inclusions
   block.
