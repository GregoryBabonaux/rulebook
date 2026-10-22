# Open Knowledge Format (OKF)

OKF v0.2 (Google Cloud, `GoogleCloudPlatform/knowledge-catalog/okf/SPEC.md`) is a
vendor-neutral way to ship knowledge: a folder of Markdown files with YAML frontmatter
(`type`, `title`, `description`, `tags`), provenance (`sources`), trust (`generated`,
`verified`) and lifecycle (`status`).

## Export

`rulebook export okf [--out <dir>]` writes the rulebook as an OKF bundle (default
`rulebook/okf/`): one `Business Domain`, `Business Policy` and `Business Rule` concept per
domain, policy and rule, with the evidence lines as sources, a passed audit as `verified`,
`index.md` files and a `log.md` from the histories. Like `rulebook build`, it is
deterministic and written by the CLI only: never write or edit the bundle yourself. It
replaces its own previous export and refuses a folder it did not write.

Offer it whenever the rulebook is shared with other tools: a data catalog, a wiki, another
agent, a documentation connector. The HTML stays the document people read.

## Reading OKF that is already there

A project may already ship knowledge in OKF: look for an `index.md` whose frontmatter
holds `okf_version`. Read the concepts that touch the domain — what a table, a metric or a
process means — as **context**: to name domains, to understand a column, to phrase a rule.
Never as evidence: a concept can be stale, and the code (with the data) decides. A useful
concept may be cited as a `doc` evidence line next to the code that proves the rule.
