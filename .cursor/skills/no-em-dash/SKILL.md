---
name: no-em-dash
description: >-
  Hard gate: never use Unicode em dash (U+2014) or en dash (U+2013) in
  OfficeTracker. Use when writing UI copy, comments, errors, docs, agent
  scripts, commit messages, or reviewing diffs that might introduce fancy
  dashes. Prefer ASCII hyphen-minus (-), commas, colons, or parentheses.
---

# No em dash / en dash

Office Tracker forbids Unicode em dash (U+2014) and en dash (U+2013) **everywhere** in the repo: UI strings, comments, commit messages, error text, docs, skills, and agent scripts.

## Why

1. **UI consistency** - product copy must stay plain ASCII punctuation.
2. **Agent safety (BUG-017)** - em/en dashes in `agent/**/*.ps1` can mojibake when published to `.txt` and break `Invoke-Expression`, silencing the fleet.
3. **Regression** - `tests/bugs/BUG-029-no-em-dash-in-repo.test.ts` fails the build if these code points reappear in scanned paths.

## Allowed replacements

| Instead of | Use |
|---|---|
| sentence break with U+2014 | ` - `, `: `, or `, ` |
| numeric range with U+2013 (`1` to `30`) | `1-30` |
| empty / missing placeholder | `-` or `n/a` |
| title "Phase 1 ... Quick wins" | `Phase 1 - Quick wins` |

## NEVER

- Paste Word/Outlook/ChatGPT punctuation that inserts U+2014 / U+2013
- Use smart quotes or other non-ASCII punctuation in `agent/**/*.ps1`
- "Fix" a failing BUG-029 test by deleting the test

## Before shipping copy or agent changes

```powershell
npm test -- tests/bugs/BUG-029-no-em-dash-in-repo.test.ts tests/bugs/BUG-017-agent-iex-txt-must-parse.test.ts
```

If either fails, replace the glyphs with ASCII `-` (or rephrase) and re-run.

## Related

- Project skill: **office-tracker** (UI / copy style)
- Project skill: **agent-auto-update** (ASCII-only agent scripts)
- Catalog: BUG-017, BUG-029
