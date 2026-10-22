import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { readTables } from '../../src/data/read.js';

const MYSQL = `-- MySQL dump
CREATE TABLE \`products\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`category\` varchar(32) NOT NULL,
  \`vat_rate\` decimal(4,2) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
INSERT INTO \`products\` VALUES (1,'Le Petit Prince','book',5.50),(2,'L\\'Étranger','book',20.00),(3,'Stylo; bleu','office',20.00);
CREATE TABLE \`settings\` (
  \`key\` varchar(64) NOT NULL,
  \`value\` text
);
INSERT INTO \`settings\` (\`key\`, \`value\`) VALUES ('hint_delay_seconds','90'),('maintenance',NULL);
`;

const PG = `CREATE TABLE public.orders (
    id integer NOT NULL,
    status text NOT NULL,
    total numeric(10,2)
);
COPY public.orders (id, status, total) FROM stdin;
1\tpaid\t42.00
2\tweird\t\\N
\\.
`;

const JSON_EXPORT = JSON.stringify({ products: [{ id: 1, category: 'book', vat_rate: 5.5 }, { id: 2, category: 'book', vat_rate: 20 }] });

test('a MySQL dump gives its tables, columns and rows, quotes and escapes included', () => {
  const tables = readTables('dump.sql', MYSQL);
  assert.deepEqual(tables.products.columns, ['id', 'name', 'category', 'vat_rate']);
  assert.equal(tables.products.rows.length, 3);
  assert.deepEqual(tables.products.rows[1], { id: '2', name: "L'Étranger", category: 'book', vat_rate: '20.00' });
  assert.equal(tables.products.rows[2].name, 'Stylo; bleu');
  assert.deepEqual(tables.settings.rows, [{ key: 'hint_delay_seconds', value: '90' }, { key: 'maintenance', value: null }]);
});

test('a PostgreSQL dump with COPY blocks gives its rows, \\N as null', () => {
  const tables = readTables('dump.sql', PG);
  assert.deepEqual(tables['public.orders'].rows, [{ id: '1', status: 'paid', total: '42.00' }, { id: '2', status: 'weird', total: null }]);
});

test('a JSON export: an object of arrays, or one array named after the file', () => {
  assert.deepEqual(readTables('shop.json', JSON_EXPORT).products.columns, ['id', 'category', 'vat_rate']);
  assert.equal(readTables('exports/products.json', JSON.stringify([{ id: 1 }])).products.rows.length, 1);
});

const repoWith = () => makeRepo({
  'db/dump.sql': MYSQL,
  'rulebook/config.json': JSON.stringify({ language: 'en', hotspots: [], data: { sources: [{ name: 'shopdb', kind: 'sql-dump', path: 'db/dump.sql' }] } }),
});

test('rulebook data <source> tables lists tables with their columns and row counts', async () => {
  const io = fakeIo(repoWith().dir);
  assert.equal(await run(['data', 'shopdb', 'tables'], io), 0, io.err);
  assert.match(io.out, /^products · 3 rows · id, name, category, vat_rate$/m);
  assert.match(io.out, /^settings · 2 rows · key, value$/m);
});

test('rulebook data <source> rows <table> filters, projects, limits and counts', async () => {
  const repo = repoWith();
  const io = fakeIo(repo.dir);
  await run(['data', 'shopdb', 'rows', 'products', '--where', 'category=book', '--where', 'vat_rate!=5.50', '--columns', 'id,vat_rate'], io);
  assert.deepEqual(io.out.trim().split('\n').map((l) => JSON.parse(l)), [{ id: '2', vat_rate: '20.00' }]);
  const count = fakeIo(repo.dir);
  await run(['data', 'shopdb', 'rows', 'products', '--where', 'vat_rate=20.00', '--count'], count);
  assert.equal(count.out.trim(), '2');
  const limited = fakeIo(repo.dir);
  await run(['data', 'db/dump.sql', 'rows', 'products', '--limit', '1'], limited);
  assert.equal(limited.out.trim().split('\n').length, 1);
});

test('rulebook data refuses an unknown table or source clearly', async () => {
  const repo = repoWith();
  const io = fakeIo(repo.dir);
  assert.equal(await run(['data', 'shopdb', 'rows', 'nope'], io), 1);
  assert.match(io.err, /no table "nope" in db\/dump\.sql \(tables: products, settings\)/);
  const missing = fakeIo(repo.dir);
  assert.equal(await run(['data', 'other', 'tables'], missing), 1);
  assert.match(missing.err, /"other" is neither a declared data source nor a file/);
});
