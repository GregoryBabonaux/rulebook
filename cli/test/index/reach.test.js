import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { baseFiles } from '../helpers/fixture.js';

const CONTROLLER = [
  '<?php',
  'class RefundController {',
  '    public function store($user, $order) {',
  '        return (new OrderPolicy)->refund($user, $order);',
  '    }',
  '}',
  '',
].join('\n');

const TEST_CALLING_VIEW = [
  '<?php',
  'class RefundTest {',
  '    public function test_refund_refused_after_window() {',
  '        $this->assertFalse((new OrderPolicy)->view(1, 2));',
  '    }',
  '}',
  '',
].join('\n');

const cardsCiting = (symbol) => `# PAY · Payments
How the shop refunds money.

## Other operating rules

### PAY-R001 · Rule
- **Kind:** rule · **Category:** timing
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** Something.

**Evidence.**
- enforcement — app/Policies/OrderPolicy.php:4-7 \`${symbol}\`
`;

test('a symbol referenced only by tests is reported as possible dead code', async () => {
  const repo = makeRepo({ ...baseFiles(), 'tests/RefundTest.php': TEST_CALLING_VIEW, 'rulebook/PAY-payments.md': cardsCiting('OrderPolicy::view') });
  const io = fakeIo(repo.dir);
  assert.equal(await run(['index', '--strict'], io), 0, 'a heuristic never fails --strict');
  assert.match(io.err, /PAY-R001 "view" is only referenced by tests — possible dead code/);
});

test('a symbol never referenced is reported; a referenced one is not', async () => {
  const repo = makeRepo({ ...baseFiles(), 'rulebook/PAY-payments.md': cardsCiting('OrderPolicy::view') });
  const io = fakeIo(repo.dir);
  await run(['index'], io);
  assert.match(io.err, /PAY-R001 "view" is never referenced — possible dead code/);

  const used = makeRepo({ ...baseFiles(), 'app/Http/RefundController.php': CONTROLLER, 'rulebook/PAY-payments.md': cardsCiting('OrderPolicy::refund').replace(':4-7', ':9-13') });
  const io2 = fakeIo(used.dir);
  await run(['index'], io2);
  assert.doesNotMatch(io2.err, /dead code/);
});

test('framework entry points and class names are not reported', async () => {
  const src = baseFiles()['app/Policies/OrderPolicy.php'].replace('public function view(', 'public function handle(');
  const repo = makeRepo({ ...baseFiles(), 'app/Policies/OrderPolicy.php': src, 'rulebook/PAY-payments.md': cardsCiting('OrderPolicy::handle') });
  const io = fakeIo(repo.dir);
  await run(['index'], io);
  assert.doesNotMatch(io.err, /dead code/);
});

test('a reference from a template counts (wire:click, routes)', async () => {
  const repo = makeRepo({ ...baseFiles(), 'resources/views/refund.blade.php': '<button wire:click="view">See</button>\n', 'rulebook/PAY-payments.md': cardsCiting('OrderPolicy::view') });
  const io = fakeIo(repo.dir);
  await run(['index'], io);
  assert.doesNotMatch(io.err, /dead code/);
});

test('framework naming conventions count: a Laravel scopeActive is called as active()', async () => {
  const src = baseFiles()['app/Policies/OrderPolicy.php'].replace('public function view(', 'public function scopeVisible(');
  const repo = makeRepo({ ...baseFiles(), 'app/Policies/OrderPolicy.php': src, 'app/Http/List.php': '<?php Order::query()->visible()->get();\n', 'rulebook/PAY-payments.md': cardsCiting('OrderPolicy::scopeVisible') });
  const io = fakeIo(repo.dir);
  await run(['index'], io);
  assert.doesNotMatch(io.err, /dead code/);
});
