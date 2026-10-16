export const LABELS = {
  en: {
    kind: 'Kind', category: 'Category', implements: 'Implements', status: 'Status',
    confidence: 'Confidence', audit: 'Audit', verifiedAt: 'Verified at', nature: 'Nature',
    statement: 'Statement', rule: 'Rule', context: 'Context', parameters: 'Parameters',
    evidence: 'Evidence', edgeCases: 'Edge cases', openQuestions: 'Open questions',
    history: 'History', implementedBy: 'Implemented by',
  },
  fr: {
    kind: 'Type', category: 'Catégorie', implements: 'Applique', status: 'Statut',
    confidence: 'Confiance', audit: 'Audit', verifiedAt: 'Vérifié sur', nature: 'Nature',
    statement: 'Énoncé', rule: 'La règle', context: 'Contexte', parameters: 'Paramètres',
    evidence: 'Preuves', edgeCases: 'Cas limites', openQuestions: 'Questions ouvertes',
    history: 'Historique', implementedBy: 'Appliquée par',
  },
};

const norm = (s) => s.normalize('NFC').trim().toLowerCase();
const LOOKUP = new Map();
for (const labels of Object.values(LABELS)) {
  for (const [key, label] of Object.entries(labels)) LOOKUP.set(norm(label), key);
}

export function labelToKey(label) {
  return LOOKUP.get(norm(label)) ?? null;
}
