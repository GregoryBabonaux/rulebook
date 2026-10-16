# rulebook-extract — with skill, run 1, sonnet, 2026-10-16

Incomplete: the agent started the blind audit as a background sub-agent and handed back before it
returned. Cards stayed in `rulebook/.drafts/` with `Audit: pending`; `rulebook index --strict` never ran.
Content of the drafts looked right (3 domains, 6 policies, 15 rules, lying comment and dead code handled).

REFACTOR: the skill now says to wait for the audit result and never hand back with `Audit: pending`,
and to write the domain files directly in `rulebook/`.
