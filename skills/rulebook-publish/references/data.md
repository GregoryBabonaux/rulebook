# Data sources

Some rules live in the data, not in the code: a VAT rate stored per product, a delay in a
settings table, the statuses a column really holds. And data can contradict the code: a
product at 20 % VAT when the rule says books are at 10 %. Reading the data finds those.

## Ask once per project

Look at `rulebook/config.json` → `data`:

- `{ "sources": [...] }` — use them, without asking again.
- `{ "declined": true }` — do not ask; work from the code alone.
- absent — look for candidates, then ask **one** question before reading the code:
  - a database tool you can call (an MCP server for MySQL, PostgreSQL, SQLite…);
  - SQL dumps (`*.sql` with `CREATE TABLE` or `INSERT`) and JSON exports in the repository,
    outside `vendor/`, `node_modules/` and test fixtures.

  Name what you found and ask whether to use it, or whether the user can provide a dump or
  an export. Record the answer in `config.json`, then go on:

```json
"data": { "sources": [
  { "name": "shopdb", "kind": "mcp", "server": "mysql", "note": "staging copy" },
  { "name": "dump", "kind": "sql-dump", "path": "storage/dumps/reference.sql" },
  { "name": "catalog", "kind": "json", "path": "exports/catalog.json" }
] }
```

or `"data": { "declined": true }`. In a non-interactive run, record nothing and work from the
code alone.

## Read only, always

- SELECT only, with a `LIMIT`. Never INSERT, UPDATE, DELETE, DDL, migrations, seeds or any
  command that resets a database — the project's own rules about its database win over
  everything.
- Only the database the user named. If the MCP server points at production and the user
  did not say so, ask first.
- A dump or an export: `rulebook data <source> tables`, then
  `rulebook data <source> rows <table> --where col=value --columns a,b --limit 20` or
  `--count`. It reads the file, never a server.

## No personal data in the reference

Cite tables, columns, counts and row ids. Never copy names, e-mails, addresses, phone
numbers, free text written by users, or any value that identifies a person into a card, an
open question or the report. Query only the columns a rule needs.

## What to look for

1. **Values that decide.** A rate, a threshold, a delay or a flag read from a table or a
   settings row: cite it in `Parameters.` with its data evidence; the code that reads it
   stays the enforcement evidence.
2. **Rows that break a rule.** For each rule the data can show: count the rows that violate
   it, and keep up to three ids. A violation is a fact for `Open questions.` — the rule still
   says what the code does.
3. **Data that contradicts the code or itself.** A value outside what the code accepts, two
   rows that should agree and do not (the 10 % / 20 % VAT case): the card becomes
   `conflicting`, describing both sides, or gets an open question.
4. **States the code does not know.** A status value present in the data that no branch
   handles: an edge case and an open question.

## Writing it

```markdown
- data — shopdb:products.vat_rate `category = 'book' AND vat_rate <> 10`
```

`<source>` is a declared source name, then a table or `table.column`, then the filter or
query that shows it, in backticks. Put the count in the text that uses it ("12 books are at
20 %"), not a row's personal data.
