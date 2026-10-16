# Identifiers

- **Domain code:** three uppercase letters chosen at mapping time (`PAY`, `ORD`, `ACC`). Never renamed afterwards.
- **Policy:** `<CODE>-P<nn>` — `PAY-P03`.
- **Operating rule:** `<CODE>-R<nnn>` — `PAY-R012`.
- **Edge case:** `<rule id>.E<n>` — `PAY-R012.E2`.

## Numbering
- Take the next free number in the domain. Read every `rulebook/<CODE>-*.md` first.
- Numbers are **never reused**, even after a rule is retired or deleted from the code.
- A rule that disappears gets `**Status:** retired` and keeps its ID and history.
- Moving a rule to another domain: retire the old ID, create a new one, and say "moved from PAY-R012" in its history note.

## Files
- One file per domain: `rulebook/<CODE>-<slug>.md`, starting with `# <CODE> · <Title>`.
- The domain map is `rulebook/index.md` (see `card-template.md`).
