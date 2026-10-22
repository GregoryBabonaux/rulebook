# OKF export and data sources — design

Date: 2026-10-22. Status: requested by Grégory, who left the choices to me ("fais toi même
les choix en pertinence avec ce que le pack propose"). Follows
`docs/specs/2026-10-15-rulebook-design.md` and `2026-10-16-detection-design.md` without
changing their decisions.

## Why

1. **OKF.** The Open Knowledge Format (Google Cloud, v0.2, June 2026) is a vendor-neutral
   way to ship knowledge as Markdown files with YAML frontmatter, with provenance
   (`sources`), trust (`generated`, `verified`) and lifecycle (`status`). A rulebook already
   holds exactly that: rules, the lines that prove them, an audit and a history. Exporting
   it as OKF lets data catalogs, wikis and other agents consume the reference without
   knowing rulebook.
2. **Data.** Some rules live in the data, not in the code: a VAT rate stored per product, a
   delay stored in a settings table, a status column with values the code never expects.
   And data can contradict the code: a product at 20 % VAT that the rule says should be at
   10 %. Reading a database (through an MCP server), a SQL dump or a JSON export makes those
   rules and contradictions visible.

## Decisions

### OKF

- `rulebook export okf [--out <dir>]` writes an OKF v0.2 bundle (default
  `rulebook/okf/`). Deterministic, no AI, like `rulebook build`: same cards, same files.
- Layout: `index.md` (root, `okf_version: "0.2"`), `log.md` (from card histories),
  one folder per domain with `index.md`, `overview.md` (type `Business Domain`),
  `policies/<ID>.md` (type `Business Policy`) and `rules/<ID>.md` (type `Business Rule`).
- Mapping: `title`, `description` (the statement), `tags` (domain, category, confidence),
  `status` (candidate → draft, active/changed → stable, retired → deprecated), `generated`
  (`rulebook-cli/<version>` at the card's `Verified at` date), `verified` (a passed audit →
  `process:rulebook-blind-audit`), `sources` (one per evidence line, with an `id` cited as a
  footnote in the body). Rulebook-specific keys (`rulebook_id`, `confidence`, `category`,
  `implements`) are kept as extensions. Bodies use `# Rule`, `# Context`, `# Parameters`,
  `# Evidence`, `# Edge cases`, `# Open questions`, `# History`, and link rule ↔ policy.
- `rulebook-publish` offers the OKF export next to the HTML; the README documents it.
- **OKF as input:** `rulebook-map` and `rulebook-extract` look for OKF bundles already in
  the project (an `index.md` with `okf_version`) and read them as context — what a table or
  a metric means — never as evidence: the code (and now the data) decides.
- The native card format does not change: OKF is an export, not a replacement.

### Data sources

- `rulebook/config.json` gains `data`: `{ "sources": [ { "name", "kind": "mcp" | "sql-dump" |
  "json", "path"?, "server"?, "note"? } ] }`, or `{ "declined": true }`.
- **When the skills are called** (map, extract, edge-cases, sync): if `config.json` has no
  `data` decision, the skill looks for candidates (a database MCP tool it can call, `*.sql`
  dumps, JSON exports in the repository) and asks **one** question: bring data, which
  source, or not now. The answer is recorded in `config.json`, so the question is asked
  once per project. A recorded source is used without asking again.
- **Read only, always.** SELECT queries only, with a LIMIT; never INSERT, UPDATE, DELETE,
  DDL, migrations or seeds; never against a database the user did not name. Project rules
  that forbid touching the database win over everything.
- **No personal data in the reference.** Cite tables, columns, counts and row ids; never
  names, e-mails, addresses, phone numbers or free text from user rows.
- `rulebook data <source> [tables | rows <table>] [--where col=value] [--columns a,b]
  [--limit n] [--count]` reads a SQL dump (`CREATE TABLE` and `INSERT` statements, MySQL or
  PostgreSQL style) or a JSON export (an array of rows, or an object of arrays keyed by
  table) without a database, so any agent can query them. Zero dependency, streaming.
- **Evidence kind `data`:** `- data — <source>:<table>[.<column>] `<filter>`` . It is not
  anchored to file lines; `rulebook index` checks that the source is declared in
  `config.json`. The HTML shows it as "data · source · table · filter"; OKF exports it as a
  `sources` entry whose `resource` is a scope descriptor.
- **What extract does with data:** confirm a parameter that lives in data (cite it in
  `Parameters.` with a `data` evidence), find rows that violate a rule (count, up to three
  ids), find data that contradicts the code or itself (the 10 % / 20 % VAT case). A
  contradiction makes the card `conflicting` or adds an open question; it never changes the
  statement of what the code does.
- `rulebook doctor` lists the declared sources and checks that file sources exist.

## Not changing

- The HTML stays produced only by `rulebook build`; the OKF bundle only by `rulebook export`.
- Zero dependencies.
- The code stays the reference for what the product does; data adds evidence and conflicts.
