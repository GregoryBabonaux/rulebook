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
