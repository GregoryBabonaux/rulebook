document.documentElement.classList.add('js');

// The hero: pointing at a piece of evidence lights up the line of code it cites.
const lines = new Map([...document.querySelectorAll('.ln')].map((el) => [el.dataset.line, el]));
const proofs = [...document.querySelectorAll('.proof button')];
function highlight(line) {
  for (const [n, el] of lines) {
    el.classList.toggle('on', n === line);
    el.classList.toggle('warn', n === line && line === '6');
  }
  for (const b of proofs) b.classList.toggle('on', b.dataset.hl === line);
}
for (const b of proofs) {
  b.addEventListener('mouseenter', () => highlight(b.dataset.hl));
  b.addEventListener('focus', () => highlight(b.dataset.hl));
  b.addEventListener('click', () => highlight(b.dataset.hl));
  b.addEventListener('mouseleave', () => highlight(null));
  b.addEventListener('blur', () => highlight(null));
}

// Languages: English is the page itself; the others come from i18n.js. The choice comes from
// ?lang=, then the last one picked, then the browser's languages.
const LANGS = ['en', 'fr', 'es', 'de', 'pt', 'it'];
const README = 'https://github.com/GregoryBabonaux/rulebook/blob/main/';
const english = {
  title: document.title,
  description: document.querySelector('meta[name="description"]').content,
};
for (const el of document.querySelectorAll('[data-i18n]')) english[el.dataset.i18n] = el.innerHTML;
english.level = 'Level';
english.copied = 'Copied';
let words = english;

function setLanguage(lang) {
  const t = window.I18N?.[lang];
  words = t ? { ...english, ...t } : english;
  document.documentElement.lang = t ? lang : 'en';
  document.title = t?.['meta.title'] ?? english.title;
  document.querySelector('meta[name="description"]').content = t?.['meta.description'] ?? english.description;
  for (const el of document.querySelectorAll('[data-i18n]')) el.innerHTML = words[el.dataset.i18n];
  document.documentElement.style.setProperty('--level-word', JSON.stringify(words.level));
  document.getElementById('readme').href = t ? `${README}README.${lang}.md` : `${README}README.md`;
  document.getElementById('lang').value = t ? lang : 'en';
}

function pickLanguage() {
  const asked = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(asked)) return asked;
  try {
    const saved = localStorage.getItem('rulebook-lang');
    if (LANGS.includes(saved)) return saved;
  } catch { /* storage blocked: fall through */ }
  for (const l of navigator.languages ?? []) {
    const short = l.slice(0, 2).toLowerCase();
    if (LANGS.includes(short)) return short;
  }
  return 'en';
}

setLanguage(pickLanguage());
document.getElementById('lang').addEventListener('change', (e) => {
  const lang = e.target.value;
  setLanguage(lang);
  try { localStorage.setItem('rulebook-lang', lang); } catch { /* not remembered */ }
  const url = new URL(location.href);
  if (lang === 'en') url.searchParams.delete('lang'); else url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
});

// Copy buttons.
for (const box of document.querySelectorAll('[data-copy]')) {
  const button = box.querySelector('.copy');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(box.querySelector('code').textContent.trim());
      button.textContent = words.copied;
      button.classList.add('done');
      setTimeout(() => { button.textContent = words.copy; button.classList.remove('done'); }, 1600);
    } catch {
      box.querySelector('code').focus();
    }
  });
}

// Install tabs, with arrow keys.
const tabs = [...document.querySelectorAll('[role="tab"]')];
function select(tab) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  }
  tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length]);
    if (e.key === 'ArrowLeft') select(tabs[(i - 1 + tabs.length) % tabs.length]);
  });
});
