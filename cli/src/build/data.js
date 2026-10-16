const CHANGE_TYPE = { created: 'new', changed: 'changed', retired: 'retired' };

function sinceItems(cards, from) {
  if (!from) return [];
  const items = [];
  for (const card of cards) {
    for (const h of card.history) {
      if (h.date > from && CHANGE_TYPE[h.change]) {
        items.push({ type: CHANGE_TYPE[h.change], id: card.id, title: card.title, date: h.date, note: h.note });
      }
    }
  }
  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function toValidate(cards, inboxText) {
  const out = [];
  for (const card of cards) {
    if (card.sections.openQuestions) out.push({ type: 'question', id: card.id, title: card.title, text: card.sections.openQuestions });
    if (card.meta.audit?.startsWith('failed')) out.push({ type: 'audit', id: card.id, title: card.title, text: card.meta.audit });
    if (card.meta.confidence === 'conflicting') out.push({ type: 'conflicting', id: card.id, title: card.title, text: card.sections.rule ?? card.title });
  }
  for (const line of (inboxText ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    if (line.startsWith('- [ ] ')) out.push({ type: 'inbox', id: null, title: null, text: line.slice(6) });
  }
  return out;
}

export function buildData({ name, commit, today, version, config, domainsMap, domainFiles, inboxText, sinceFrom }) {
  const byCode = new Map();
  for (const entry of domainsMap) byCode.set(entry.code, { ...entry, file: null });
  for (const file of domainFiles) {
    if (!file.domain) continue;
    const known = byCode.get(file.domain.code);
    byCode.set(file.domain.code, {
      code: file.domain.code,
      title: known?.title ?? file.domain.title,
      description: file.domain.description || known?.description || '',
      file,
    });
  }

  const allCards = domainFiles.flatMap((f) => f.cards);
  const domains = [...byCode.values()].map((d) => {
    const cards = d.file?.cards ?? [];
    const policies = cards.filter((c) => c.kind === 'policy').map((card) => ({ card, rules: cards.filter((r) => r.kind === 'rule' && r.policy === card.id) }));
    return {
      code: d.code, title: d.title, description: d.description, extracted: Boolean(d.file),
      policies, otherRules: cards.filter((r) => r.kind === 'rule' && !r.policy),
    };
  });

  const rules = allCards.filter((c) => c.kind === 'rule');
  return {
    project: { name, commit, builtAt: today, version, language: config.language ?? 'en', repoUrl: config.repoUrl ?? null },
    since: { from: sinceFrom ?? null, items: sinceItems(allCards, sinceFrom) },
    counts: {
      domains: domains.length,
      extracted: domains.filter((d) => d.extracted).length,
      policies: allCards.filter((c) => c.kind === 'policy').length,
      rules: rules.length,
      edgeCases: rules.reduce((n, r) => n + r.edgeCases.length, 0),
    },
    domains,
    toValidate: toValidate(allCards, inboxText),
  };
}
