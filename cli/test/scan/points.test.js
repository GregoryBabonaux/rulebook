import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLine, findPoints, codePaths, domainsFor, parseNotRules } from '../../src/scan/points.js';

test('decision points are classified by family', () => {
  const cases = [
    ['        throw new RefundRefused();', 'guard'],
    ["        abort_unless($user->isAdmin(), 403);", 'authorization'],
    ["        Gate::authorize('manage', $session);", 'authorization'],
    ["            'password' => 'required|min:12',", 'validation'],
    ['        if (RateLimiter::tooManyAttempts($key, 20)) {', 'limit'],
    ['        if ($order->total > 500) {', 'condition'],
    ["        } elseif ($days <= 14) {", 'condition'],
    ["        if ($status === 'paid') {", 'condition'],
    ["        $session->update(['status' => SessionStatus::Completed]);", 'state'],
    ['        $order->status = "cancelled";', 'state'],
    ['    private const MAX_ATTEMPTS = 3;', 'constant'],
    ['MAX_DISCOUNT = 0.3', 'constant'],
    ["        $days = config('shop.refund_window_days');", 'config'],
    ['  const limit = process.env.REFUND_LIMIT;', 'config'],
    ["    $schedule->command('photos:purge')->daily();", 'schedule'],
  ];
  for (const [line, kind] of cases) assert.equal(classifyLine(line, 'app/X.php'), kind, line);
});

test('comments, blank lines and ordinary code are not decision points', () => {
  for (const line of ['', '   ', '// if ($a > 3) throw', '# MAX = 3', ' * @throws Foo', '        $x = $y + 1;', '        return $this->name;']) {
    assert.equal(classifyLine(line, 'app/X.php'), null, JSON.stringify(line));
  }
});

test('schema constraints are found only in schema files', () => {
  assert.equal(classifyLine("            $table->string('email')->unique();", 'database/migrations/2026_create_users.php'), 'schema');
  assert.equal(classifyLine('  email TEXT NOT NULL UNIQUE,', 'db/schema.sql'), 'schema');
  assert.equal(classifyLine("            $table->string('email')->unique();", 'app/Services/X.php'), null);
});

test('findPoints keys survive a line move and distinguish repeated lines', () => {
  const a = findPoints('app/A.php', 'if ($a > 3) {\n}\nif ($a > 3) {\n');
  assert.equal(a.length, 2);
  assert.notEqual(a[0].key, a[1].key);
  const moved = findPoints('app/A.php', '\n\nif ($a > 3) {\n}\nif ($a > 3) {\n');
  assert.deepEqual(moved.map((p) => p.key), a.map((p) => p.key));
  assert.deepEqual(moved.map((p) => p.line), [3, 5]);
});

test('Code details give paths, globs and brace sets; other tokens are ignored', () => {
  const paths = codePaths('`app/Services/{Game,Quiz}Service.php`, `app/Livewire/Gameplay/`, `config/gameplay.php`, table `orders`, `REFUND_DAYS`');
  assert.deepEqual(paths, ['app/Services/GameService.php', 'app/Services/QuizService.php', 'app/Livewire/Gameplay/**', 'config/gameplay.php']);
  const domains = [{ code: 'JEU', details: [{ label: 'Code', text: '`app/Services/{Game,Quiz}Service.php`, `app/Livewire/Gameplay/`' }] }, { code: 'PAY', details: [{ label: 'Code', text: '`app/Pay/*`' }] }];
  assert.deepEqual(domainsFor('app/Livewire/Gameplay/Hint.php', domains), ['JEU']);
  assert.deepEqual(domainsFor('app/Pay/Refund.php', domains), ['PAY']);
  assert.deepEqual(domainsFor('app/Other.php', domains), []);
});

test('not-rules.md lines give a key and a reason', () => {
  const map = parseNotRules('# Not rules\n- 3f9a1b2c4d5e · app/Geo.php:157 · Haversine constant\n- junk line\n');
  assert.deepEqual([...map.entries()], [['3f9a1b2c4d5e', 'Haversine constant']]);
});

test('imports and event names are not decision points', () => {
  for (const line of ['use Illuminate\Support\Facades\RateLimiter;', "import { throttle } from 'lodash';", "    #[On('position-confirmed')]", "from app.limits import rate_limit"]) {
    assert.equal(classifyLine(line, 'app/X.php'), null, line);
  }
  assert.equal(classifyLine("            'reviewComment' => ['nullable', 'string', 'max:5000'],", 'app/X.php'), 'validation');
});

test('comparisons with constants or configuration, calculations, booleans and state tables are found', () => {
  const cases = [
    ['  return (now - order.deliveredAt) / DAY <= config.REFUND_WINDOW_DAYS;', 'condition'],
    ['  const lockedUntil = failed >= MAX_ATTEMPTS ? now + LOCK_MINUTES : null;', 'condition'],
    ['        if ($attempts > self::MAX_ATTEMPTS) {', 'condition'],
    ['  if (request.body.isStaff === true) {', 'condition'],
    ['  const rate = Math.min(coupon.rate, config.MAX_DISCOUNT);', 'calculation'],
    ['  return Math.round(amount * 100) / 100;', 'calculation'],
    ['    return { ...order, total: order.total * 0.8 };', 'calculation'],
    ['        $fee = max($amount * 0.02, 1);', 'calculation'],
    ["  pending: ['paid', 'cancelled'],", 'state'],
    ["        'paid' => ['shipped', 'cancelled'],", 'state'],
    ['const TRANSITIONS = {', 'constant'],
  ];
  for (const [line, kind] of cases) assert.equal(classifyLine(line, 'src/X.js'), kind, line);
  for (const line of ['  if (value !== null) {', '  const items = [];', '  const total = a + b;']) {
    assert.equal(classifyLine(line, 'src/X.js'), null, line);
  }
});

test('in templates, styling is not a decision point, but template conditions are', () => {
  const view = 'resources/views/gameplay/end.blade.php';
  for (const line of [
    '<div style="padding:12px 20px max(env(safe-area-inset-bottom,24px),24px);">',
    `<div style="font-size:22px;font-weight:800;color:{{ $n === 0 ? 'green' : 'red' }}">`,
    `<p class="text-sm">{{ $count }} énigme{{ $count > 1 ? 's' : '' }}</p>`,
  ]) assert.equal(classifyLine(line, view), null, line);
  assert.equal(classifyLine(`@if($stats['puzzles_revealed'] > 0)`, view), 'condition');
  assert.equal(classifyLine("  {% if order.total >= 50 %}", 'src/views/cart.njk'), 'condition');
  assert.equal(classifyLine("if ($ratio >= 1) $badges[] = ['label' => 'Parcours parfait'];", view), 'condition');
});
