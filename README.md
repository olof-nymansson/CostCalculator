# CostCalculator

A small web app that answers "who owes whom" when a group shares costs: a trip, a shared
flat, a dinner. Add participants and expenses, and get a balance per person plus a short list
of suggested transfers to settle up. The UI is in Swedish (SEK).

- No account, no backend, no server-side storage. All data stays in the browser.
- The whole state is encoded in the URL hash, so a link is a shareable snapshot.
- Builds to a static site (suitable for GitHub Pages).

## Scope

**In scope:** participants (add, rename, remove), expenses (description, amount, payer, who
shares it), four split modes (equal, shares, exact amounts, percentages), balances, suggested
transfers, sharing the result as a link, mobile-friendly and accessible UI.

**Deliberately out of scope:**

- Login, accounts, backend or database.
- Simultaneous editing by several people. Each shared link is a snapshot; changes made after
  sharing are not synced.
- Actual payments.

Not built yet: editing an existing expense (remove it and add it again), offline support as a
PWA, and automatic deployment.

## Getting started

```
npm install        # install dependencies
npm run dev        # start dev server
npm run build      # production build
npm run preview    # preview the build
npm test           # run all tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier
```

Run `npm run lint && npm run typecheck && npm test` before committing.

## Architecture

```
src/
  core/    Pure domain logic. No DOM, framework, or other layer imports.
  state/   Data model, validation, migrations, URL encoding, actions, and the hook that
           reads and writes the URL hash. The only layer that touches window or the clipboard.
  ui/      React components and form-text parsing/formatting.
  strings.ts  All user-facing (Swedish) text.
tests/     Mirrors src/core, src/state and src/ui.
```

State flows in one direction: state → UI → events → new state. Data from the URL or from user
input is validated once when it enters the app (`state/validate.ts`, `state/actions.ts`), and
trusted after that.

## Domain rules

### Money

Amounts are integers of öre (SEK × 100), typed as `Money`, so 123.45 SEK is stored as `12345`.
Floating point is never used for money. Amounts are parsed and formatted only in `ui/`.
A single amount is limited to 10 billion SEK so that sums of untrusted values cannot overflow
a safe integer.

### Splitting and rounding

When a split is uneven (100 SEK among 3 people) the largest remainder method is used:

1. Each person gets `floor(total × weight / sum of weights)`.
2. The öre left over are handed out one at a time to the people with the largest fractional
   remainder.
3. Ties are broken by ascending participant id.

The result is deterministic and the shares always add up to the expense exactly. 100 SEK among
three people gives 33.34, 33.33 and 33.33 (to the lowest ids first). Equal splits are shares
with weight 1, and percentages are stored as basis points (25.5 % = 2550) to avoid fractions.
Intermediate products use BigInt so very large amounts stay exact.

### Balances

A balance is what the person paid minus what they owe. Positive means they should receive
money. The balances of a group always sum to exactly 0 (covered by invariant tests).

### Settlement

A greedy algorithm: repeatedly match the largest debtor with the largest creditor and transfer
the smaller of the two amounts, until everyone is at 0. Ties are broken by participant id, so
the output is deterministic. It produces at most (participants − 1) transfers but does **not**
guarantee the absolute minimum number of transfers in every case; finding the minimum is
NP-hard and not worth the complexity for groups this small.

## Sharing and the URL format

The state is serialized as JSON, compressed with deflate (`fflate`), and encoded as base64url
in `location.hash`. The hash is updated after every change, so the address bar always holds a
link to the current state.

- **Versioning:** the first field of the JSON is `version` (currently `1`). Old links must keep
  working: when the format changes, bump `CURRENT_VERSION` and add a migration in
  `state/migrate.ts`. Supported versions: 1.
- **Untrusted input:** everything read from the hash is validated (types, ranges, ids, that
  every split adds up and references existing participants). A corrupt, oversized, or
  unsupported link shows a clear message and starts with an empty group; it never crashes.
- **Size limits:** the app warns when the hash exceeds 2000 characters (links that long may
  break in some chat apps) and refuses to open hashes over 8000 characters. A group of six
  people with 25 expenses stays well below the soft limit (covered by a test). Hard caps of 30 participants and
  200 expenses keep links in a workable range.
- Nothing is stored in `localStorage`; the URL is the only persistence. Bookmark the link to
  keep your data.

## Accessibility

Semantic HTML with labelled form fields, visible focus indicators, error messages announced via
`role="alert"`, results shown as text rather than colour alone, and a layout designed for
360 px width first. WCAG AA is the goal; a full manual audit has not been done yet.

## Tech stack

TypeScript (strict), Vite, Vitest, React, ESLint and Prettier. The only runtime dependencies
besides React are `fflate` (about 8 KB, compression of the URL state). Testing the UI uses
jsdom and Testing Library as development dependencies.
