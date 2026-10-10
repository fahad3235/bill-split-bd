# Bill Split BD — বিল স্প্লিট বিডি

A free, fully offline, bilingual (English/বাংলা) group bill splitter for Bangladesh.
Enter the bill, add people, and split it equally, by fixed amounts, or by
percentages — with optional service charge and VAT, per-person breakdowns,
honest rounding modes, and localStorage persistence.

## The problem

Splitting a restaurant bill in Bangladesh means mental math over service charge
(usually 5–10%) and VAT (15%), plus the classic argument about who ordered the
extra kebab. Bill Split BD does it in seconds, on any phone, without an account
or an internet connection.

## Features

- Bill input in BDT with optional **service charge %** and **VAT %** (each toggleable).
  VAT is applied on subtotal + service charge (the BD restaurant standard).
- Add/remove people with names; each person can take an **equal** share,
  a **fixed amount**, or a **percentage** of the subtotal.
- Custom fixed/percent people take their cut first; equal-share people split
  the remainder — the remaining amount is shown live.
- Service charge + VAT are distributed across people **proportionally** to
  each person's base share, with a per-person breakdown (base + charges = total).
- **Rounding modes**: exact (to the paisa), nearest ৳10, nearest ৳50 — with the
  rounding difference displayed honestly (collected over/under), never dropped.
- Full **EN ⇄ বাংলা** UI toggle.
- `localStorage` persistence: your last split is restored on reload.
- Input validation with clear messages (bill > 0, ≥1 person, percentages ≤ 100%,
  custom shares must not exceed the subtotal).
- Responsive: single-column mobile layout, verified at 390px.

## Stack

- Vanilla HTML/CSS/JS — no frameworks, no build step, no dependencies.
- `js/app.js` — all split math in ONE commented function (`computeSplit`),
  rendering, validation, i18n wiring, persistence.
- `js/i18n.js` — full EN/BN UI strings.

## Prerequisites

Any modern browser (Chrome, Firefox, Safari, Edge). No install needed.

## Install

Clone the repo (or download the ZIP), then open `index.html` in a browser:

```bash
git clone https://github.com/fahad3235/bill-split-bd.git
cd bill-split-bd
# open index.html
```

Or serve locally:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Dev commands

None — it is a static site. Edit files and refresh.

## Environment

None. There is no backend, no API key, no `.env`. The app makes zero network
requests; state lives in the browser's `localStorage` under key `bill-split-bd`.

## Testing

Headless-Chromium Playwright suite (`/tmp/bs-test/test.py` in the dev machine;
serves the build dir on localhost and drives real interactions).

Run (needs `playwright` python package + the cached headless shell):

```bash
python3 -m http.server 8000 -d builds/bill-split-bd &
python3 /tmp/bs-test/test.py
```

Results (2026-10-10): **22/22 checks passed, 0 console/page errors**, including
hand-verified math:

- ৳1000 / 3 equal → ৳333.33 each, sum ≈ ৳1000
- 10% service + 5% VAT on ৳1000 → grand total ৳1155; 3 equal → ৳385 each
- custom 50%/30%/20% on ৳1000 → ৳500 / ৳300 / ৳200
- nearest-৳10 rounding on ৳333.33 → ৳330, with ৳10 under-collection shown
- invalid inputs rejected: bill ৳0, percentages > 100%, fixed amounts > subtotal,
  empty name, duplicate name, removing all people
- remove-person rebalances equal shares (3→2 people: ৳333.33 → ৳500)
- bill + people persist across reload; BN/EN toggle rewrites labels both ways;
  390px viewport has 0px horizontal overflow

## Deployment

GitHub Pages compatible: the site is a static root — enable Pages with source
"Deploy from a branch", branch `main`, folder `/ (root)`.

## Limitations

- **Rounding distribution is per-person, not optimized**: with nearest-৳10/৳50
  modes each share is rounded independently and the difference is only *shown* —
  the app does not re-allocate the difference to specific people (e.g. "largest
  remainder" method). The collected over/under is always visible, never hidden.
- Charges are split proportionally to base shares; there is no "itemized"
  mode (assigning specific dishes to specific people).
- VAT rule is fixed (VAT on subtotal + service charge); some restaurants apply
  VAT on subtotal only — toggle/adjust percentages manually if needed.
- Data is per-browser `localStorage` (no sync, no export); clearing browser
  data wipes saved splits.
- Amounts round to 2 decimals; percentages are not capped per-person until the
  100% total check.

## Status

Built and verified 2026-10-10 (run #10 of MUSE PROJECT FACTORY Ω).
Status: awaiting publication by the factory parent (repo creation + Pages).
