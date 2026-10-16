# rulebook-extract — with skill, run 3 (after review fixes), sonnet, 2026-10-16

Score: 14/14 · recall 1.0 · precision 0.92 (extra ACC-R003 admin role) · 0 warnings after fixing
three evidence lines that listed two symbols/ranges.
- Ran `rulebook check` first, wrote files, blind audit by a sub-agent (ACC-R002 "in a row" wording
  failed and was fixed, ORD-R004 overstated FK claim removed, PRC-R004 evidence widened).
- Deviation reported by the agent: the audit needs the files, so they were written before the
  checkpoint. REFACTOR: steps reordered (write → audit → checkpoint → apply), and
  writing-style.md now says one range and one symbol per evidence line.
