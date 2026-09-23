# Bug / regression catalog

Durable catalog of important past bugs and core behaviors for Office Pulse. Agents and humans should re-check these even when the change looks unrelated.

## Run

```bash
npm run test:bugs
```

Also included in `npm test` (Vitest picks up `tests/bugs/**`).

## Layout

| Path | Role |
|---|---|
| `catalog.json` | Machine-readable index (id, area, status, test path, fixtures) |
| `fixtures/` | Anonymized past-shaped data (no PII, no secrets) |
| `BUG-*.test.ts` / `CORE-*.test.ts` | Executable guards |
| `MANUAL-*.test.ts` | Skipped placeholders so manual cases stay visible |

## Add a new case

1. Reproduce with sanitized fixture data under `fixtures/` (names like UserA, serial `SN-DEMO-001`).
2. Add an entry to `catalog.json` with `status: "open"`.
3. Write a failing test under `tests/bugs/` that encodes the assertion.
4. Fix the product code until the test passes; set `status` to `guarded` (or `fixed` if no ongoing guard yet).
5. If it cannot run in Vitest (needs a live Windows agent), set `status: "manual"`, fill `skipReason`, and keep a skipped test that documents the check.
6. Prefer linking `relatedTests` to existing suites instead of copying large tests.

## Status values

- `open` - known issue, guard not green yet
- `fixed` - fixed historically, optional thin guard
- `guarded` - automated test must stay green
- `manual` - listed so it is not forgotten; Vitest skips with reason

## Areas

`agent-update`, `alerts`, `visits`, `admin`, `wifi`, `auth`, `core`
