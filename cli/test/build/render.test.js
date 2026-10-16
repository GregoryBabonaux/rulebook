import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml, escapeHtml, inline, evidenceHref } from '../../src/build/render.js';
import { buildData } from '../../src/build/data.js';
import { parseDomainFile } from '../../src/parse/cards.js';
import { DOMAIN_MD } from '../helpers/fixture.js';

const data = (over = {}, md = DOMAIN_MD) => buildData({
  name: 'shop', commit: 'a1b2c3d', today: '2026-10-16', version: '0.1.0',
  config: { language: 'en', repoUrl: null, ...over },
  domainsMap: [{ code: 'PAY', title: 'Payments', description: '' }, { code: 'STK', title: 'Stock', description: 'Inventory.' }],
  domainFiles: [parseDomainFile(md)], inboxText: '', sinceFrom: '2026-10-10',
});

test('escaping and inline code', () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(inline('use `REFUND_DAYS` <b>now</b>'), 'use <code>REFUND_DAYS</code> &lt;b&gt;now&lt;/b&gt;');
});

test('evidence links: relative, GitHub, GitLab', () => {
  const ev = { path: 'app/A.php', start: 9, end: 13 };
  assert.equal(evidenceHref(null, 'abc', ev), '../app/A.php');
  assert.equal(evidenceHref('https://github.com/o/r', 'abc', ev), 'https://github.com/o/r/blob/abc/app/A.php#L9-L13');
  assert.equal(evidenceHref('https://gitlab.com/o/r/', 'abc', { ...ev, end: 9 }), 'https://gitlab.com/o/r/-/blob/abc/app/A.php#L9');
});

test('the document has every part, in reading order', () => {
  const html = renderHtml(data());
  const order = ['<h1', 'id="since"', 'id="toc"', 'id="PAY"', 'id="PAY-P03"', 'id="PAY-R012"', 'id="PAY-R020"', 'id="STK"', 'id="to-validate"', '<footer'];
  let last = -1;
  for (const marker of order) {
    const at = html.indexOf(marker);
    assert.ok(at > last, `${marker} out of order`);
    last = at;
  }
  assert.match(html, /<html lang="en">/);
  assert.match(html, /Proven by code and a test/);
  assert.match(html, /not extracted yet/);
  assert.match(html, /<a href="\.\.\/app\/Policies\/OrderPolicy\.php">OrderPolicy\.php:9<\/a>/);
  assert.match(html, /class="tag tag-changed"/);
});

test('labels follow the language, with English fallback', () => {
  assert.match(renderHtml(data({ language: 'fr' })), /Prouvée par le code et un test/);
  assert.match(renderHtml(data({ language: 'fr' })), /<html lang="fr">/);
  assert.match(renderHtml(data({ language: 'de' })), /Proven by code and a test/);
});

test('hostile card text never becomes markup or breaks the script', () => {
  const md = DOMAIN_MD.replace('A refund can be requested only if', '<script>alert(1)</script></script> A refund can be requested only if');
  const html = renderHtml(data({}, md));
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(html.match(/<\/script>/g).length, 2, 'only the labels and viewer scripts close a script tag');
});

test('self-contained: no external resources', () => {
  const html = renderHtml(data({ repoUrl: 'https://github.com/o/r' }));
  const urls = html.match(/https?:\/\/[^"'\s)]+/g) ?? [];
  assert.ok(urls.every((u) => u.startsWith('https://github.com/o/r/blob/')), urls.join(', '));
  assert.doesNotMatch(html, /<link |<img |@import|src="http/);
});
