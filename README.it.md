<div align="center">

# rulebook

**Trasforma le regole di business sepolte nel tuo codice in un riferimento che tutti possono leggere, e mantienilo corretto mentre programmi.**

[![npm](https://img.shields.io/npm/v/rulebook-cli?color=6366f1&label=npm)](https://www.npmjs.com/package/rulebook-cli)
[![CI](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml/badge.svg)](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml)
[![Licenza: MIT](https://img.shields.io/badge/licenza-MIT-8b5cf6)](https://github.com/GregoryBabonaux/rulebook/blob/main/LICENSE)
![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-06b6d4)

[English](https://github.com/GregoryBabonaux/rulebook/blob/main/README.md) · [Français](https://github.com/GregoryBabonaux/rulebook/blob/main/README.fr.md) · [Español](https://github.com/GregoryBabonaux/rulebook/blob/main/README.es.md) · [Deutsch](https://github.com/GregoryBabonaux/rulebook/blob/main/README.de.md) · [Português](https://github.com/GregoryBabonaux/rulebook/blob/main/README.pt.md) · **Italiano**

<img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/document.png" alt="Un documento rulebook: una regola di rimborso con il suo contesto, i casi limite, prove contraddittorie e una domanda aperta" width="900">

</div>

## Perché

Ogni prodotto nasconde le sue regole nel codice: un termine di rimborso, un blocco dopo cinque accessi falliti, un tetto agli sconti. Nessuno sa elencarle, i commenti mentono e le specifiche sono superate. **rulebook** dà al tuo agente di programmazione le skill per leggere il codice, scrivere quelle regole in linguaggio chiaro con le prove allegate, e accorgersi quando una modifica al codice ne tocca una.

- **Leggibile da tutti.** Ogni regola dice cosa fa il prodotto, perché e quali sono le eccezioni, sia per i product owner sia per gli sviluppatori.
- **Provato.** Ogni regola cita le righe e i test esatti che la decidono, con un livello di affidabilità. Fa fede il codice, non i commenti.
- **Vivo.** Un compagno segue le tue modifiche e segnala le regole che potrebbero essere cambiate. Niente viene riscritto senza la tua approvazione.
- **Qualsiasi agente.** Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Mistral Vibe e qualsiasi agente che legga file `SKILL.md`, insieme a superpowers, spec-kit o BMAD.

## Un documento, tre viste

Il risultato è un unico file HTML: funziona offline, si può inviare per e-mail e stampare in PDF.

| Mappa | Cruscotto (modalità scura) |
|---|---|
| <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/map.png" alt="Mappa interattiva: domini, politiche e regole in un albero da espandere e riordinare" width="440"> | <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/dashboard-dark.png" alt="Cruscotto: cifre chiave, regole per dominio colorate in base all'affidabilità, modifiche recenti e punti da validare" width="440"> |
| Espandi domini, politiche, regole e casi limite. Trascina un nodo per spostare il suo ramo. | Cifre chiave, affidabilità per dominio, modifiche recenti, domande aperte. |

Gli screenshot vengono da un negozio fittizio pieno di trappole: un commento che annuncia 30 giorni mentre il codice ne applica 7, e codice morto. Il documento di esempio è in francese; il tuo sarà nella lingua del tuo progetto.

## Come funziona

| Livello | Skill | Cosa ottieni |
|---|---|---|
| 1 | `rulebook-map` | i domini di business, con cosa copre ciascuno e dove si trova il suo codice |
| 2 | `rulebook-extract` | le regole di un dominio: politiche (*perché*) e regole operative (*come*), verificate da un audit alla cieca |
| 3 | `rulebook-edge-cases` | cosa succede ai limiti di una regola (*Dato… quando… allora…*) |
| — | `rulebook-sync` | elabora la casella di posta dopo le modifiche al codice |
| — | `rulebook-publish` | genera il documento HTML e, se hai un connettore (Notion, Drive…), propone di pubblicarlo |

Ogni livello si ferma per la tua convalida prima di scrivere. rulebook non tocca mai il tuo codice sorgente né i tuoi test.

Le **skill** valutano: il tuo agente legge il codice. Il **compagno** rileva: una piccola CLI senza IA, eseguita dagli hook del tuo agente e da un hook git pre-commit.

## Guida all'installazione

**Requisiti:** git, e Node.js 22 o successivo per il compagno e l'HTML. Le skill funzionano senza Node; in quel caso ottieni solo il Markdown.

### Passo 1 — Installa le skill (scegline una)

| Usi | Esegui | Ottieni |
|---|---|---|
| **Claude Code** (consigliato) | `/plugin marketplace add GregoryBabonaux/rulebook`<br>`/plugin install rulebook@rulebook` | skill + hook del compagno |
| **Qualsiasi agente** (Codex, Cursor, Gemini, Copilot, Vibe…) | `npx skills add GregoryBabonaux/rulebook` | skill, nel progetto o globalmente (`-g`) |
| **Senza skills.sh** | `npx rulebook-cli skills --yes` | skill copiate in `~/.agents/skills` e `~/.claude/skills` |

### Passo 2 — Attiva il compagno nel tuo progetto

Nella cartella del progetto:

```bash
npx rulebook-cli init
```

Il comando mostra cosa scriverà: gli hook degli agenti rilevati, un blocco in `AGENTS.md` e un hook git pre-commit. Non scrive nulla finché non confermi:

```bash
npx rulebook-cli init --yes
```

Con il plugin di Claude Code questo passo è facoltativo: il plugin porta già gli hook.

### Passo 3 — Verifica

```bash
npx rulebook-cli doctor
```

Ogni riga inizia con `✓` (tutto a posto) o `!` (da correggere, con il comando da eseguire).

### Agenti supportati

| Agente | Rilevamento dopo una modifica | Note |
|---|---|---|
| Claude Code | `PostToolUse` + `Stop` | verificato da capo a fondo |
| GitHub Copilot | `postToolUse` | `.github/hooks/rulebook.json`, letto anche dall'agente cloud |
| Gemini CLI | `AfterTool` | |
| Codex | `PostToolUse` + `Stop` | da approvare una volta con `/hooks` |
| Cursor | `postToolUse` | |
| Mistral Vibe | `post_tool` | |
| Kiro, OpenCode, Windsurf | — | solo `AGENTS.md` + pre-commit |

Al di fuori di Claude Code, i formati degli hook seguono la documentazione di ciascun fornitore a ottobre 2026. Le segnalazioni sono benvenute.

## Avvio rapido

Parla con il tuo agente:

1. *«Mappa i domini di business di questo codice.»* → `rulebook-map`, poi apri `rulebook/rulebook.html`
2. *«Estrai le regole di business del dominio ORD.»* → `rulebook-extract`
3. *«Trova i casi limite di ORD-R001.»* → `rulebook-edge-cases`
4. Continua a programmare. Quando il codice di una regola cambia, compare una sola riga:
   `rulebook: ORD-R001 may have changed (refund.js) → rulebook/inbox.md`
5. *«Elabora la casella di posta di rulebook.»* → `rulebook-sync`, poi *«Pubblica il rulebook.»* → `rulebook-publish`

Cosa finisce nel tuo progetto:

```
rulebook/
├── index.md          # i domini di business
├── ORD-ordini.md     # un file per dominio: politiche e regole, con le loro prove
├── inbox.md          # modifiche rilevate dal compagno, in attesa di convalida
└── rulebook.html     # il documento, un unico file autonomo
```

## Guida all'aggiornamento

Skill, CLI e hook condividono **un unico numero di versione**. La CLI ti avvisa quando ne esce una nuova, al massimo una volta al giorno: `rulebook 0.2.0 available — …`. Disattiva l'avviso con `RULEBOOK_NO_UPDATE_CHECK=1`; in CI è disattivato.

### 1. Aggiorna le skill nel modo in cui le hai installate

| Installate con | Aggiorna con |
|---|---|
| Plugin di Claude Code | `claude plugin update rulebook@rulebook`, oppure `/plugin` → Marketplaces → rulebook → *Enable auto-update* per non pensarci più |
| skills.sh | `npx skills update` nella cartella del progetto (`npx skills update -g` per un'installazione globale) |
| npm | `npx rulebook-cli@latest update` |

### 2. Aggiorna il progetto

In ogni progetto che usa rulebook:

```bash
npx rulebook-cli@latest update
```

Aggiorna solo ciò che rulebook ha installato (hook, copie delle skill) e non installa mai nulla di nuovo a sorpresa. Poi rigenera il documento con il nuovo modello:

```bash
npx rulebook-cli@latest build
```

### 3. Verifica

```bash
npx rulebook-cli@latest doctor
```

`doctor` segnala gli hook di una versione precedente e un `rulebook.html` generato da un'altra versione.

## CLI

```
rulebook index      # ricostruisce l'indice delle prove, segnala i problemi
rulebook check      # rileva le modifiche alle regole, scrive la casella di posta
rulebook build      # genera rulebook/rulebook.html
rulebook doctor     # verifica l'installazione
rulebook update     # aggiorna gli hook e le copie delle skill installati dalla CLI
rulebook --help
```

Nessuna dipendenza. Usala con `npx rulebook-cli <comando>` o installala con `npm i -g rulebook-cli`.

## Lo stesso documento per tutti

L'agente non scrive mai `rulebook.html`. Solo `rulebook build` lo genera, da un modello incluso nel pacchetto, senza IA. La stessa versione e le stesse schede danno lo stesso file, byte per byte; `SOURCE_DATE_EPOCH` fissa la data. Il file è firmato con `<meta name="generator" content="rulebook-cli x.y.z">`, e `rulebook doctor` segnala un file che la CLI non ha generato.

## Domande frequenti

**Modifica il mio codice?** No. Le skill scrivono solo in `rulebook/`. `init --yes` scrive i file di hook che hai approvato, `update` aggiorna solo ciò che rulebook ha installato e `skills --yes` copia le skill nella tua cartella personale.

**Quali lingue?** Le skill sono scritte in inglese. Il riferimento viene redatto nella lingua del tuo progetto (`rulebook/config.json` → `language`). Le etichette del documento HTML esistono in inglese e francese.

**Come so se una regola è giusta?** Ogni regola cita le righe che la decidono e ha un livello di affidabilità: *provata dal codice e da un test*, *letta nel codice*, *dedotta* o *contraddittoria*. Un audit alla cieca la verifica: un secondo passaggio che vede solo la scheda e il codice citato. `rulebook index --strict` fallisce quando una citazione non esiste più.

**Come viene testato?** Con un'applicazione di prova piena di trappole (un commento che mente, codice morto, una scelta tecnica travestita da regola) e un valutatore. Ogni skill è stata prima eseguita *senza* la skill per osservare gli errori, poi scritta per correggerli. Vedi [`tests/skills/runs/`](https://github.com/GregoryBabonaux/rulebook/tree/main/tests/skills/runs).

**Dov'è il formato delle schede?** In [`references/card-template.md`](https://github.com/GregoryBabonaux/rulebook/blob/main/references/card-template.md).

## Licenza

MIT © Grégory Babonaux
