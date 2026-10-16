<div align="center">

# rulebook

**Transformez les règles métier enfouies dans votre code en un référentiel lisible par tous, et gardez-le juste pendant que vous codez.**

[![npm](https://img.shields.io/npm/v/rulebook-cli?color=6366f1&label=npm)](https://www.npmjs.com/package/rulebook-cli)
[![CI](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml/badge.svg)](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml)
[![Licence : MIT](https://img.shields.io/badge/licence-MIT-8b5cf6)](https://github.com/GregoryBabonaux/rulebook/blob/main/LICENSE)
![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-06b6d4)

[English](https://github.com/GregoryBabonaux/rulebook/blob/main/README.md) · **Français** · [Español](https://github.com/GregoryBabonaux/rulebook/blob/main/README.es.md) · [Deutsch](https://github.com/GregoryBabonaux/rulebook/blob/main/README.de.md) · [Português](https://github.com/GregoryBabonaux/rulebook/blob/main/README.pt.md) · [Italiano](https://github.com/GregoryBabonaux/rulebook/blob/main/README.it.md)

<img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/document.png" alt="Un document rulebook : une règle de remboursement avec son contexte, ses cas particuliers, des preuves contradictoires et une question ouverte" width="900">

</div>

## Pourquoi

Tout produit cache ses règles dans le code : un délai de remboursement, un verrouillage après cinq échecs de connexion, un plafond de remise. Personne ne sait les lister, les commentaires mentent et les specs ne sont plus à jour. **rulebook** donne à votre agent de code les skills pour lire le code, écrire ces règles en langage clair, preuves à l'appui, et remarquer quand une modification du code touche l'une d'elles.

- **Lisible par tous.** Chaque règle dit ce que fait le produit, pourquoi, et ses exceptions, pour les product owners comme pour les développeurs.
- **Prouvé.** Chaque règle cite les lignes et les tests qui la décident, avec un niveau de confiance. Le code fait foi, pas les commentaires.
- **Vivant.** Un compagnon suit vos modifications et signale les règles qui ont pu changer. Rien n'est réécrit sans votre accord.
- **Tout agent.** Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Mistral Vibe et tout agent qui lit les fichiers `SKILL.md`, aux côtés de superpowers, spec-kit ou BMAD.

## Un document, trois vues

Le résultat est un seul fichier HTML : il fonctionne hors ligne, s'envoie par e-mail et s'imprime en PDF.

| Carte | Tableau de bord (mode sombre) |
|---|---|
| <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/map.png" alt="Carte interactive : domaines, politiques et règles en arbre que l'on déplie et réorganise" width="440"> | <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/dashboard-dark.png" alt="Tableau de bord : chiffres clés, règles par domaine colorées selon la confiance, changements récents et points à valider" width="440"> |
| Dépliez domaines, politiques, règles et cas particuliers. Glissez un nœud pour déplacer sa branche. | Chiffres clés, confiance par domaine, changements récents, questions ouvertes. |

Les captures viennent d'une boutique fictive truffée de pièges : un commentaire qui annonce 30 jours quand le code en applique 7, et du code mort.

## Comment ça marche

| Niveau | Skill | Ce que vous obtenez |
|---|---|---|
| 1 | `rulebook-map` | les domaines métier, avec ce que chacun couvre et où vit son code |
| 2 | `rulebook-extract` | les règles d'un domaine : règles métier (*pourquoi*) et règles de gestion (*comment*), vérifiées par un audit à l'aveugle |
| 3 | `rulebook-edge-cases` | ce qui se passe aux limites d'une règle (*Étant donné… quand… alors…*) |
| — | `rulebook-sync` | traite la boîte de réception après des changements de code |
| — | `rulebook-publish` | construit le document HTML et, si vous avez un connecteur (Notion, Drive…), propose de le publier |

Chaque niveau s'arrête pour votre validation avant d'écrire. rulebook ne touche jamais à votre code source ni à vos tests.

Les **skills** jugent : votre agent lit le code. Le **compagnon** détecte : un petit CLI sans IA, lancé par les hooks de votre agent et par un hook git pre-commit.

## Guide d'installation

**Prérequis :** git, et Node.js 22 ou plus pour le compagnon et le HTML. Les skills fonctionnent sans Node ; vous obtenez alors seulement le Markdown.

### Étape 1 — Installer les skills (au choix)

| Vous utilisez | Lancez | Vous obtenez |
|---|---|---|
| **Claude Code** (recommandé) | `/plugin marketplace add GregoryBabonaux/rulebook`<br>`/plugin install rulebook@rulebook` | skills + hooks du compagnon |
| **Tout agent** (Codex, Cursor, Gemini, Copilot, Vibe…) | `npx skills add GregoryBabonaux/rulebook` | skills, dans le projet ou globalement (`-g`) |
| **Sans skills.sh** | `npx rulebook-cli skills --yes` | skills copiées dans `~/.agents/skills` et `~/.claude/skills` |

### Étape 2 — Activer le compagnon dans votre projet

Dans le dossier du projet :

```bash
npx rulebook-cli init
```

La commande montre ce qu'elle va écrire : les hooks des agents détectés, un bloc dans `AGENTS.md` et un hook git pre-commit. Rien n'est écrit avant votre confirmation :

```bash
npx rulebook-cli init --yes
```

Avec le plugin Claude Code, cette étape est facultative : le plugin apporte déjà les hooks.

### Étape 3 — Vérifier

```bash
npx rulebook-cli doctor
```

Chaque ligne commence par `✓` (tout va bien) ou `!` (à corriger, avec la commande à lancer).

### Agents pris en charge

| Agent | Détection après une modification | Remarques |
|---|---|---|
| Claude Code | `PostToolUse` + `Stop` | vérifié de bout en bout |
| GitHub Copilot | `postToolUse` | `.github/hooks/rulebook.json`, lu aussi par l'agent cloud |
| Gemini CLI | `AfterTool` | |
| Codex | `PostToolUse` + `Stop` | à approuver une fois avec `/hooks` |
| Cursor | `postToolUse` | |
| Mistral Vibe | `post_tool` | |
| Kiro, OpenCode, Windsurf | — | `AGENTS.md` + pre-commit seulement |

Hors Claude Code, les formats de hooks suivent la documentation de chaque éditeur en octobre 2026. Les retours sont bienvenus.

## Démarrage rapide

Parlez à votre agent :

1. *« Cartographie les domaines métier de ce code. »* → `rulebook-map`, puis ouvrez `rulebook/rulebook.html`
2. *« Extrais les règles métier du domaine ORD. »* → `rulebook-extract`
3. *« Trouve les cas particuliers de ORD-R001. »* → `rulebook-edge-cases`
4. Continuez à coder. Quand le code d'une règle change, une seule ligne apparaît :
   `rulebook: ORD-R001 may have changed (refund.js) → rulebook/inbox.md`
5. *« Traite la boîte de réception rulebook. »* → `rulebook-sync`, puis *« Publie le référentiel. »* → `rulebook-publish`

Ce qui arrive dans votre projet :

```
rulebook/
├── index.md            # les domaines métier
├── ORD-commandes.md    # un fichier par domaine : règles métier et de gestion, avec leurs preuves
├── inbox.md            # changements détectés par le compagnon, en attente de validation
└── rulebook.html       # le document, un seul fichier autonome
```

## Guide de mise à jour

Skills, CLI et hooks partagent **un seul numéro de version**. Le CLI vous prévient quand une nouvelle version sort, au plus une fois par jour : `rulebook 0.2.0 available — …`. Pour couper ce message : `RULEBOOK_NO_UPDATE_CHECK=1` ; il est coupé en CI.

### 1. Mettre à jour les skills, comme vous les avez installées

| Installées avec | Mettre à jour avec |
|---|---|
| Plugin Claude Code | `claude plugin update rulebook@rulebook`, ou `/plugin` → Marketplaces → rulebook → *Enable auto-update* pour ne plus y penser |
| skills.sh | `npx skills update` dans le dossier du projet (`npx skills update -g` pour une installation globale) |
| npm | `npx rulebook-cli@latest update` |

### 2. Rafraîchir le projet

Dans chaque projet qui utilise rulebook :

```bash
npx rulebook-cli@latest update
```

La commande rafraîchit seulement ce que rulebook a installé (hooks, copies des skills) et n'installe jamais rien de nouveau par surprise. Reconstruisez ensuite le document avec le nouveau gabarit :

```bash
npx rulebook-cli@latest build
```

### 3. Vérifier

```bash
npx rulebook-cli@latest doctor
```

`doctor` signale les hooks d'une ancienne version et un `rulebook.html` construit par une autre version.

## CLI

```
rulebook index      # reconstruit l'index des preuves, signale les problèmes
rulebook scan       # liste les points de décision qu'aucune fiche ne couvre encore
rulebook check      # détecte les changements de règles, écrit la boîte de réception
rulebook build      # produit rulebook/rulebook.html
rulebook doctor     # vérifie l'installation
rulebook update     # rafraîchit les hooks et les copies de skills installés par le CLI
rulebook --help
```

Aucune dépendance. Utilisez-le avec `npx rulebook-cli <commande>` ou installez-le avec `npm i -g rulebook-cli`.

## Le même document pour tous

L'agent n'écrit jamais `rulebook.html`. Seul `rulebook build` le produit, à partir d'un gabarit livré dans le paquet, sans IA. Même version et mêmes fiches donnent le même fichier, au caractère près ; `SOURCE_DATE_EPOCH` fige la date. Le fichier est signé par `<meta name="generator" content="rulebook-cli x.y.z">`, et `rulebook doctor` signale un fichier que le CLI n'a pas produit.

## FAQ

**Est-ce que ça modifie mon code ?** Non. Les skills n'écrivent que sous `rulebook/`. `init --yes` écrit les fichiers de hooks que vous avez approuvés, `update` ne rafraîchit que ce que rulebook a installé, et `skills --yes` copie les skills dans votre dossier personnel.

**Quelles langues ?** Les skills sont écrites en anglais. Le référentiel est rédigé dans la langue de votre projet (`rulebook/config.json` → `language`). Les libellés du document HTML existent en anglais et en français.

**Comment savoir si une règle est juste ?** Chaque règle cite les lignes qui la décident et porte un niveau de confiance : *prouvée par le code et un test*, *lue dans le code*, *déduite* ou *contradictoire*. Un audit à l'aveugle la vérifie : une seconde passe qui ne voit que la fiche et le code cité. `rulebook index --strict` échoue quand une citation n'existe plus. Il échoue aussi quand un symbole cité n'est pas dans ses lignes, et il signale les méthodes que seuls les tests appellent. Pour attraper les règles que personne n'a écrites, `rulebook scan` liste les points de décision du code (refus, conditions sur des valeurs fixes, droits, limites, changements d'état) qu'aucune fiche ne couvre, et le document affiche cette couverture par domaine.

**Comment est-ce testé ?** Avec une application de test pleine de pièges (un commentaire menteur, du code mort, un choix technique déguisé en règle) et un correcteur automatique. Chaque skill a d'abord été lancée *sans* la skill pour observer les échecs, puis écrite pour les corriger. Voir [`tests/skills/runs/`](https://github.com/GregoryBabonaux/rulebook/tree/main/tests/skills/runs).

**Où est le format des fiches ?** Dans [`references/card-template.md`](https://github.com/GregoryBabonaux/rulebook/blob/main/references/card-template.md).

## Licence

MIT © Grégory Babonaux
