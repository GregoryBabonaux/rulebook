import path from 'node:path';

const JS_EXTENSIONS = ['', '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '.vue', '/index.js', '/index.ts'];

// Repository files a file refers to: PHP `use` statements (PSR-4, App\Foo → app/Foo.php),
// Laravel views (view('a.b') → resources/views/a/b.blade.php, @include) and relative
// JavaScript imports. Line-based, like the scan: a reference built at run time is missed.
export function referencedFiles(file, text, paths) {
  const known = paths instanceof Set ? paths : new Set(paths);
  const list = paths instanceof Set ? [...paths] : paths;
  const found = new Set();

  for (const [, ns] of text.matchAll(/^\s*use\s+([A-Z][\w\\]+)(?:\s+as\s+\w+)?\s*;/gm)) {
    const segs = ns.split('\\');
    if (segs.length < 2) continue;
    const suffix = `${segs.slice(1).join('/')}.php`;
    const exact = `${segs[0].toLowerCase()}/${suffix}`;
    if (known.has(exact)) { found.add(exact); continue; }
    const ends = list.filter((p) => p.endsWith(`/${suffix}`));
    if (ends.length === 1) found.add(ends[0]);
  }

  for (const [, name] of text.matchAll(/(?:\bview\(|View::make\(|->view\(|@include(?:If|When)?\()\s*['"]([\w.\-/]+)['"]/g)) {
    const view = `resources/views/${name.replace(/\./g, '/')}.blade.php`;
    if (known.has(view)) found.add(view);
  }

  const dir = path.posix.dirname(file);
  for (const [, rel] of text.matchAll(/(?:require\(\s*|\bfrom\s+|\bimport\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const base = path.posix.normalize(path.posix.join(dir, rel));
    const hit = JS_EXTENSIONS.map((ext) => base + ext).find((p) => known.has(p));
    if (hit) found.add(hit);
  }

  found.delete(file);
  return [...found];
}
