# Inline Draft Rows and .env Bulk Import for Secrets & Variables

Date: 2026-07-07

## Goal

Replace the add-secret / add-variable dialogs with inline draft rows at the
top of each list, and support pasting .env-formatted text to create many
drafts at once with one-click bulk save. Editing an existing entry also
happens inline in its row instead of a dialog.

## Design

### Inline drafts

- Each section (Secrets, Variables) keeps a local list of draft entries
  `{ id, name, value, error }`.
- The section header button starts as the current outline "+ Add secret" /
  "+ Add variable". Clicking it appends an empty draft row at the top of the
  list (name input + value input + a remove button).
- While at least one draft exists, the header button becomes a solid
  (primary) "Save" button that saves all drafts; a small ghost "+" icon
  button appears next to it to add another draft row. Removing every draft
  restores the plain add button.
- Draft name inputs are mono/uppercase like the existing dialogs; secret
  value inputs use `type="password"`, variable values are plain text.

### Bulk save

- Save validates each draft: secrets need name + value, variables need a
  name. Invalid rows stay with an inline error message; valid rows are saved
  sequentially via the existing upsert/create APIs.
- Saved rows disappear from the draft list; failed rows stay with the API
  error inline. Queries are invalidated once per batch. Secrets keep their
  success toast: the existing single-secret message for one save, a new
  count-based message for more.
- Switching the Actions / Codespaces / Dependabot scope tab clears all
  drafts, so entries can never be saved into a scope the user wasn't looking
  at when typing them.

### .env paste

- A muted hint line at the top of the panel says .env-formatted text can be
  pasted into a name field to add multiple entries at once.
- Paste is intercepted only on draft *name* inputs — secret values may
  legitimately contain `=` or newlines (certificates), so value inputs keep
  native paste.
- If the pasted text parses to at least one KEY=VALUE entry, the first entry
  fills the current row and the rest are appended as new draft rows;
  otherwise the paste falls through unchanged.
- Parser (`parse-env-entries.ts`): splits on newlines, skips blanks and `#`
  comments, strips an optional `export ` prefix, accepts
  `[A-Za-z_][A-Za-z0-9_]*` names, strips matching single/double quotes
  around values, cuts unquoted ` #` inline comments, and dedupes names with
  last-wins order.

### Inline editing

- The pencil button turns the row into an inline editor instead of opening a
  dialog: the name stays read-only text (the API updates by name, so rename
  is unsupported), and the value becomes an input — an empty write-only
  password field for secrets, the current value prefilled for variables.
- Check / X icon buttons replace pencil / trash while editing; Enter saves
  and Escape cancels. Errors show inline under the row. One row per section
  edits at a time; starting another edit switches rows, and switching scope
  tabs cancels edits and drafts alike.

### Components

- `settings/secrets/parse-env-entries.ts` — pure parser, unit-tested.
- `settings/secrets/env-draft-rows.vue` — renders the draft rows for one
  section; props `drafts` + `maskValues`, emits `update:name`,
  `update:value`, `remove`, and `paste-entries` (already-parsed entries).
- `secrets-panel.vue` — owns the two draft lists, the per-section inline
  edit state, header button states, and batch save; all dialogs are removed.
