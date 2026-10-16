#!/usr/bin/env bash
# End-to-end: rulebook init + a real Claude Code session editing a rule.
# Usage: cli/scripts/e2e-claude.sh   (needs `claude` on PATH, authenticated)
set -euo pipefail
CLI="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))"
BIN="node $CLI/bin/rulebook.js"
REPO="$(mktemp -d)"
cd "$REPO"
git init -q -b main && git config user.email e2e@example.com && git config user.name e2e
node --input-type=module -e "
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const { baseFiles } = await import(pathToFileURL('$CLI/test/helpers/fixture.js').href);
for (const [p, t] of Object.entries(baseFiles())) { fs.mkdirSync(p.split('/').slice(0, -1).join('/') || '.', { recursive: true }); fs.writeFileSync(p, t); }
"
$BIN init --agents claude --bin "$BIN" --yes >/dev/null
$BIN index >/dev/null
git add -A && git commit -qm init
RULEBOOK_NO_UPDATE_CHECK=1 claude -p "In app/Policies/OrderPolicy.php change 14 to 7 using the Edit tool. Then quote verbatim any message starting with 'rulebook:' that a hook gave you, or say NONE." \
  --permission-mode acceptEdits --model sonnet > answer.txt 2>&1 || true
echo "--- answer"; tail -3 answer.txt
echo "--- inbox"; cat rulebook/inbox.md 2>/dev/null || echo "(no inbox)"
grep -q "modified? · PAY-R012" rulebook/inbox.md && grep -q "rulebook: PAY-R012 may have changed" answer.txt && echo "E2E PASS" || { echo "E2E FAIL"; exit 1; }
