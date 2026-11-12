# CostCalculator

**Live app:** https://olof-nymansson.github.io/CostCalculator/

A small web app that answers "who owes whom" when a group shares costs: a trip, a shared
flat, a dinner. Add participants and expenses, and get a balance per person plus a short list
of suggested transfers to settle up. The UI is in Swedish (SEK). The app builds to a static site
(suitable for GitHub Pages).

## What the app does

**Participants.** Add the people sharing the costs, rename them, or remove them. Names must be
unique, ignoring case.

**Expenses.** Register each expense with a description, an amount, who paid, and who shares
it. Expenses can be edited in place or removed. The cost can be split in four ways:

- equally,
- by shares (for example 2:1:1),
- by exact amount per person,
- by percentage.

Uneven splits are rounded to the öre so the shares always add up to the expense exactly.

**Summary.** The app shows the total cost, a donut chart of how the expenses are distributed,
and a balance per person (a chart plus text, so colour is never the only signal). It also
suggests a short list of transfers that settle everyone up.

**Sharing.** A share button in the header copies a link and confirms it with a toast. The link
contains the whole state, so whoever opens it sees the same group, expenses and result as a
snapshot.

**Works anywhere.** Everything runs in the browser, with no account and no server. The UI is in
Swedish (SEK) and designed for phones first, with keyboard support and screen-reader-friendly
labels.

### Deliberate limits

- No login, accounts, backend or database.
- No simultaneous editing. A shared link is a snapshot, and later changes are not synced.
- No actual payments.

Not built yet: offline support as a PWA.

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

### CI and deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) runs lint, typecheck, tests and the
production build on every push and pull request. Pushes to `main` are deployed automatically to
GitHub Pages.

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
  break in some chat apps). A group of six people with 25 expenses stays well below that (covered
  by a test). The app allows at most 30 participants and 200 expenses; the largest state it can
  create, with incompressible text and 30-way splits, is about 55 000 characters, so hashes up
  to 65 000 characters are accepted (a test guards that every allowed state fits). Longer
  hashes are rejected before decoding, and decompression is stopped at 512 KB of JSON, so a
  small malicious link cannot expand into a huge payload.
- **Participant names** must be unique, ignoring case, so that balances and transfers are
  unambiguous.
- Nothing is stored in `localStorage`; the URL is the only persistence. Bookmark the link to
  keep your data.

## Accessibility

Semantic HTML with labelled form fields, visible focus indicators, error messages announced via
`role="alert"` and linked to the field they concern (`aria-invalid`, focus moved to it), results shown as text rather than colour alone, and a layout designed for
360 px width first. WCAG AA is the goal; a full manual audit has not been done yet.

## Tech stack

TypeScript (strict), Vite, Vitest, React, ESLint and Prettier. The only runtime dependencies
besides React are `fflate` (about 8 KB, compression of the URL state). Testing the UI uses
jsdom and Testing Library as development dependencies.
