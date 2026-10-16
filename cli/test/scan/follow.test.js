import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { referencedFiles } from '../../src/scan/follow.js';

test('references: PHP use statements, Laravel views, relative imports', () => {
  const files = ['app/Ai/CircuitBreaker.php', 'resources/views/gameplay/recap.blade.php', 'src/limits.js', 'src/lib/index.js'];
  const php = "<?php\nuse App\\Ai\\CircuitBreaker;\nclass C { function recap() { return view('gameplay.recap', []); } }\n";
  assert.deepEqual(referencedFiles('app/Http/C.php', php, files).sort(), ['app/Ai/CircuitBreaker.php', 'resources/views/gameplay/recap.blade.php']);
  const js = "const { LIMIT } = require('./limits');\nimport x from './lib';\n";
  assert.deepEqual(referencedFiles('src/orders.js', js, files).sort(), ['src/lib/index.js', 'src/limits.js']);
});

const INDEX_MD = `# Business domains

- **ORD** · Orders — Orders.
  - **Code**: \`app/Orders/\`
`;

test('scan follows a domain\'s references outside its paths and lists the decision points it finds there', async () => {
  const repo = makeRepo({
    'rulebook/index.md': INDEX_MD,
    'rulebook/config.json': JSON.stringify({ language: 'en', hotspots: ['app/Orders/**'] }),
    'app/Orders/Checkout.php': "<?php\nuse App\\Support\\Shipping;\nclass Checkout { function cart() { return view('cart', []); } }\n",
    'app/Support/Shipping.php': '<?php\nclass Shipping {\n    const FREE_FROM = 50;\n}\n',
    'resources/views/cart.blade.php': '@if ($order->total >= 50)\n<p>Free shipping</p>\n@endif\n',
    'app/Unrelated.php': '<?php\nif ($x > 3) { throw new E(); }\n',
  });
  const io = fakeIo(repo.dir);
  await run(['scan'], io);
  assert.match(io.out, /ORD · 0 decision points · 0 covered · 0 not rules · 0 to review · 2 reached outside its paths \(2 to review\)/);
  const md = fakeIo(repo.dir);
  await run(['scan', '--domain', 'ORD', '--format', 'md'], md);
  assert.match(md.out, /^### Reached from ORD's code, outside its paths$/m);
  assert.match(md.out, /resources\/views\/cart\.blade\.php:1/);
  assert.match(md.out, /app\/Support\/Shipping\.php:3/);
  assert.doesNotMatch(md.out, /Unrelated/);
  const saved = JSON.parse(fs.readFileSync(path.join(repo.dir, 'rulebook/.scan.json'), 'utf8'));
  assert.deepEqual(saved.points.find((p) => p.path === 'resources/views/cart.blade.php').reached, ['ORD']);
});
