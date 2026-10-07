# Cost calculator – shared expense splitter

## What the project is

A web app that solves "who owes whom" when a group shares costs (a trip, a shared flat, a dinner). The user adds participants and expenses and gets a balance per person plus a list of suggested transfers to settle up.

Key properties:
- No account, no backend, no server-side storage. All data stays in the browser.
- Sharing works through a URL where the whole state is encoded in the hash (`#...`).
- Deployable as a static site (GitHub Pages) and usable offline as a PWA.

Target audience: anyone who shares expenses with others, primarily Swedish-speaking users (SEK, Swish).

## Scope

### In scope
- Participants: add, rename, remove.
- Expenses: description, amount, who paid, who shares it.
- Split modes: equal, shares, exact amounts, percentages.
- Summary: balance per person and minimal transfers.
- Share the settlement as a link (state in the URL hash).
- Mobile friendly and accessible (WCAG AA as the goal).


### Out of scope (deliberate limits)
- Login, accounts, backend, database.
- Simultaneous editing by multiple users. Each shared link is a snapshot.
- Actual payments.

Document these limits in the README.

## Tech stack

- **TypeScript (strict mode):** money and settlement logic is easy to get subtly wrong. Static types catch whole classes of mistakes (mixing amounts and ids, missing cases in split modes) before they reach users.
- **Vite:** fast dev loop, zero-config static build output that fits GitHub Pages.
- **Vitest:** shares Vite's config and runs fast, which makes writing tests alongside code frictionless.
- **React:** the UI is small and state-driven (lists, forms, a summary view), which React handles well. It is widely used in the job market and has a large ecosystem. Plain React with Vite, no meta-framework (e.g. Next.js), since there is no server.
- **ESLint + Prettier:** consistent style without debate, enforced in CI.
- **GitHub Actions + GitHub Pages:** free, simple, and gives a public URL, which the course requires.
- **No backend:** keeps the project private by design (no user data leaves the browser), removes hosting cost and maintenance, and keeps the scope realistic for six part-time weeks.

No external runtime dependencies beyond the framework and, if needed, a small compression library for the URL state. No calls to third-party APIs.

## Commands

Update this list when the scripts exist in `package.json`.

```
npm install        # install dependencies
npm run dev        # start dev server
npm run build      # production build
npm run preview    # preview the build
npm test           # run all tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

Run `npm run lint && npm run typecheck && npm test` before every commit.

## Architecture

Keep a strict separation between pure logic and UI.

```
src/
  core/        # Pure domain logic. No DOM or framework dependencies.
    money.ts       # Amount handling (integer minor units)
    split.ts       # Distribute an expense among participants (equal/shares/exact/percent)
    balances.ts    # Compute balance per person
    settle.ts      # Settlement algorithm (minimize number of transfers)
  state/       # Data model, serialization, URL encoding, versioning
  ui/          # Components and pages
  main.ts
tests/         # Mirror src/core and src/state
```

Rules:
- `core/` must never import anything from `ui/` or `state/`.
- All business logic must be testable without a browser.

### Architecture principles

- **Pure core:** functions in `core/` are pure. Same input, same output, no side effects.
- **All I/O in one layer:** reading and writing the URL hash, localStorage and the service worker happens only in `state/` (and thin wiring in `main.ts`). Nothing else touches `window`, `document` or storage.
- **One responsibility per function and module.** If a function needs "and" in its description, split it.
- **No global mutable state.** State flows in one direction: state → UI → events → new state.
- **Make illegal states unrepresentable.** Use types (e.g. a discriminated union for split modes) instead of runtime flags and comments.
- **Validate at the boundary.** Data from the URL, localStorage or user input is validated once when it enters the app, then trusted inside.
- **Deterministic everywhere.** No hidden randomness or dependence on current time in `core/`.

## Domain rules (important)

### Money
- Amounts are always stored as **integers in öre** (SEK × 100). Never use floating-point `number` for calculation.
- Format and parse amounts only in the UI layer.
- When a split is uneven (e.g. 100 SEK among 3 people), the remaining öre must be distributed deterministically so that the sum of the shares always equals the expense exactly. Use a fixed rule (e.g. largest remainder method with a stable sort on participant id) and document it.
- The sum of all balances must always be exactly 0. Add an invariant test for this.

### Settlement algorithm
- Start with a greedy approach: match the largest debtor with the largest creditor until all balances are 0.
- The result must be deterministic for the same input.
- Document that it does not guarantee the absolute minimum number of transfers in every case.

### URL state
- The state is serialized to JSON, compressed and base64url-encoded in `location.hash`.
- The format has a **version number** as its first field. Old links must keep working: write a migration whenever the format changes, and never drop support for an older version without documenting it.
- An invalid or corrupt hash must produce a clear error message and an empty start, never a crash.
- Validate everything read from the URL. Treat it as untrusted input.
- Document a practical size limit (URL length).

## Code conventions

- TypeScript strict, no `any` without a comment justifying it.
- Small, pure functions. Prefer immutable data in `core/`.
- Code, comments, documentation and commit messages in English. User-facing UI text in Swedish.
- Keep all UI strings in one place (e.g. a `strings` module) so they can be swapped or translated later.
- No commented-out code blocks in commits.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). This is also used to generate the changelog.

## Testing

- All logic in `core/` and `state/` must have unit tests. Aim for high coverage there, but what matters most is that edge cases are tested.
- Required edge cases: uneven splits and rounding, participants without expenses, an expense where the payer does not share it, zero amounts, very large amounts, empty group, corrupt URL hash, old-version migration.
- Write tests first or together with the code, not afterwards.
- The UI is tested through a few central flows (add expense → see balance → share link → open link).

## Accessibility and UX

- Fully keyboard operable, visible focus indicator, sufficient contrast.
- Correct semantic HTML, labels on all form fields.
- Works on small screens (360 px width) first, then larger.
- Clear error messages

## What Claude must NOT do

- Do not add a backend, database, authentication or any server-side storage.
- Do not add external runtime dependencies without asking first and explaining why.
- Do not call third-party APIs or load external scripts, fonts or trackers.
- Do not use floating-point numbers for money calculations.
- Do not put business logic in UI components, or UI/DOM code in `core/`.
- Do not change the URL state format without bumping the version and writing a migration.
- Do not switch framework, build tool or test runner once chosen.
- Do not add features outside the scope above. Suggest them instead.
- Do not skip, delete or weaken tests to make a build pass.
- Do not commit commented-out code, `console.log` debugging or secrets.
- Do not rewrite large parts of the codebase in one go. Work in small, reviewable steps.

## How I want Claude to work in this repo

- Propose a short plan before larger changes, then make the change in small steps.
- Write or update tests together with every change in `core/` or `state/`.
- Run lint, typecheck and tests after changes and report the result.
- If a domain rule in this document seems wrong or insufficient, say so and propose a change to CLAUDE.md instead of silently deviating.
- Briefly explain trade-offs when there are several reasonable solutions, so I learn and can justify the choices in the README.