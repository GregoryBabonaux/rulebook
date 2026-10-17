# Stronger rule detection — design

Date: 2026-10-16. Status: approved by Grégory ("fais tout"). Follows the main design,
`docs/specs/2026-10-15-rulebook-design.md`, without changing its decisions.

## Why

REA (morluto/rea) is powerful because deterministic tools do the reading and return facts
with their evidence, limitations and coverage; the agent orchestrates. rulebook did the
opposite: the agent read the code and decided alone what was a rule. The first real
extraction (a real Laravel project, domain JEU, 43 rules) showed the cost:
- 21 cards out of 43 failed the first blind audit, mostly for mechanical reasons
  (evidence outside the deciding lines, a cited test that does not assert the claim, a
  parameter at the wrong line);
- dead code (a method called only by tests) was found by luck;
- nothing proved that no decision had been missed.

## What changes

1. **Mechanical evidence checks** in `rulebook index`. A cited symbol must appear in the
   cited lines or above them, in the same file. A `test` evidence must point into a test
   file; an `enforcement` evidence must not. `--strict` fails on these, as on unresolved
   anchors.
2. **Reachability.** For each symbol cited as enforcement, the CLI counts references to its
   name in non-test files. A symbol referenced only by tests, or by nothing, is reported as
   possible dead code. Framework entry points (`handle`, `render`, `mount`, `__invoke`,
   constructors…) are exempt. It is a heuristic: it warns, it never fails `--strict`.
3. **`rulebook scan`**, a deterministic inventory of decision points in the hotspots:
   guards and refusals, conditions on literal values, authorization, validation rules,
   rate limits, configuration reads, state changes, named constants, schema constraints
   and schedules. Each point has a stable key (hash of path and normalised line) and is
   attributed to a domain through the `Code` detail of `rulebook/index.md`. A point is
   *covered* when a card's evidence range contains its line, *dismissed* when
   `rulebook/not-rules.md` lists its key with a reason, *to review* otherwise. The scan
   writes `rulebook/.scan.json` and prints the coverage per domain; `--domain` and
   `--format md|json` list the points to review.
4. **Search boundary.** A domain file may carry a `**Scope.**` paragraph under its title:
   what was read, what was not. With the scan coverage, the HTML shows for each domain
   how many decision points were examined, and its scope.
5. **Skills.** `rulebook-extract` runs the scan first and must account for every point (a
   card, or a line in `not-rules.md` with a reason); it ignores symbols the reachability
   check reports as dead code; it splits large domains between parallel readers with
   distinct scopes; it may run the cited tests only when they cannot touch a real database.
   `rulebook-map` writes `Code` details as backticked paths or globs, which the scan uses.
6. **Measure.** The shop fixture gains the traps seen on that project: client-trusted state, a
   method called only by tests, two contradictory thresholds, a rule decided in a view.
   The scorer checks them; the scan has its own deterministic recall test.

## Not changing

- The HTML stays produced only by `rulebook build`, reproducible, and readable without the
  scan (coverage is shown only when `.scan.json` exists).
- Zero dependencies: detection is line-based (regular expressions per family of
  languages), not a parser. Its limits are stated in the scan output.
- `rulebook-sync` keeps its validation before rewriting validated cards.

## `rulebook/not-rules.md`

```markdown
# Not rules
- 3f9a1b2c4d5e · app/Services/Geo.php:157 · Haversine constant, geometry, not a rule
```

One line per dismissed point: key, location at the time of the decision, reason. The key
survives line moves; the location is informative.
