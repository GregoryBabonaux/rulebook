<div align="center">

# rulebook

**Machen Sie aus den Geschäftsregeln, die in Ihrem Code vergraben sind, eine Referenz, die alle lesen können, und halten Sie sie aktuell, während Sie programmieren.**

[![npm](https://img.shields.io/npm/v/rulebook-cli?color=6366f1&label=npm)](https://www.npmjs.com/package/rulebook-cli)
[![CI](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml/badge.svg)](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-8b5cf6)](https://github.com/GregoryBabonaux/rulebook/blob/main/LICENSE)
![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-06b6d4)

[English](https://github.com/GregoryBabonaux/rulebook/blob/main/README.md) · [Français](https://github.com/GregoryBabonaux/rulebook/blob/main/README.fr.md) · [Español](https://github.com/GregoryBabonaux/rulebook/blob/main/README.es.md) · **Deutsch** · [Português](https://github.com/GregoryBabonaux/rulebook/blob/main/README.pt.md) · [Italiano](https://github.com/GregoryBabonaux/rulebook/blob/main/README.it.md)

<img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/document.png" alt="Ein rulebook-Dokument: eine Erstattungsregel mit Kontext, Grenzfällen, widersprüchlichen Belegen und einer offenen Frage" width="900">

</div>

## Warum

Jedes Produkt versteckt seine Regeln im Code: eine Erstattungsfrist, eine Sperre nach fünf fehlgeschlagenen Anmeldungen, eine Rabattobergrenze. Niemand kann sie aufzählen, die Kommentare lügen und die Spezifikationen sind veraltet. **rulebook** gibt Ihrem Coding-Agenten die Skills, um den Code zu lesen, diese Regeln in klarer Sprache mit Belegen aufzuschreiben und zu bemerken, wenn eine Codeänderung eine davon berührt.

- **Für alle lesbar.** Jede Regel sagt, was das Produkt tut, warum, und welche Ausnahmen gelten, für Product Owner ebenso wie für Entwickler.
- **Belegt.** Jede Regel nennt die genauen Zeilen und Tests, die sie entscheiden, mit einer Vertrauensstufe. Es gilt der Code, nicht die Kommentare.
- **Lebendig.** Ein Begleiter verfolgt Ihre Änderungen und meldet Regeln, die sich geändert haben könnten. Nichts wird ohne Ihre Zustimmung umgeschrieben.
- **Jeder Agent.** Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Mistral Vibe und jeder Agent, der `SKILL.md`-Dateien liest, auch zusammen mit superpowers, spec-kit oder BMAD.

## Ein Dokument, drei Ansichten

Das Ergebnis ist eine einzige HTML-Datei: Sie funktioniert offline, lässt sich per E-Mail verschicken und als PDF drucken.

| Karte | Dashboard (Dunkelmodus) |
|---|---|
| <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/map.png" alt="Interaktive Karte: Domänen, Richtlinien und Regeln als Baum, den man aufklappen und umordnen kann" width="440"> | <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/dashboard-dark.png" alt="Dashboard: Kennzahlen, Regeln pro Domäne nach Vertrauensstufe eingefärbt, letzte Änderungen und offene Punkte" width="440"> |
| Domänen, Richtlinien, Regeln und Grenzfälle aufklappen. Einen Knoten ziehen verschiebt seinen Zweig. | Kennzahlen, Vertrauen pro Domäne, letzte Änderungen, offene Fragen. |

Die Screenshots stammen aus einem fiktiven Shop voller Fallen: ein Kommentar, der 30 Tage ankündigt, während der Code 7 anwendet, und toter Code. Das Beispieldokument ist auf Französisch; Ihres erscheint in der Sprache Ihres Projekts.

## So funktioniert es

| Ebene | Skill | Was Sie erhalten |
|---|---|---|
| 1 | `rulebook-map` | die Geschäftsdomänen, mit ihrem Umfang und dem Ort ihres Codes |
| 2 | `rulebook-extract` | die Regeln einer Domäne: Richtlinien (*warum*) und Betriebsregeln (*wie*), geprüft durch ein Blind-Audit |
| 3 | `rulebook-edge-cases` | was an den Grenzen einer Regel passiert (*Gegeben… wenn… dann…*) |
| — | `rulebook-sync` | verarbeitet den Posteingang nach Codeänderungen |
| — | `rulebook-publish` | erstellt das HTML-Dokument und bietet an, es zu veröffentlichen, wenn Sie einen Connector haben (Notion, Drive…) |

Jede Ebene wartet auf Ihre Freigabe, bevor sie schreibt. rulebook verändert nie Ihren Quellcode oder Ihre Tests.

Die **Skills** urteilen: Ihr Agent liest den Code. Der **Begleiter** erkennt: eine kleine CLI ohne KI, ausgeführt von den Hooks Ihres Agenten und von einem git-pre-commit-Hook.

## Installationsanleitung

**Voraussetzungen:** git sowie Node.js 22 oder neuer für den Begleiter und das HTML. Die Skills funktionieren ohne Node; dann erhalten Sie nur das Markdown.

### Schritt 1 — Skills installieren (eine Variante wählen)

| Sie nutzen | Ausführen | Sie erhalten |
|---|---|---|
| **Claude Code** (empfohlen) | `/plugin marketplace add GregoryBabonaux/rulebook`<br>`/plugin install rulebook@rulebook` | Skills + Hooks des Begleiters |
| **Jeden Agenten** (Codex, Cursor, Gemini, Copilot, Vibe…) | `npx skills add GregoryBabonaux/rulebook` | Skills, im Projekt oder global (`-g`) |
| **Kein skills.sh** | `npx rulebook-cli skills --yes` | Skills kopiert nach `~/.agents/skills` und `~/.claude/skills` |

### Schritt 2 — Den Begleiter im Projekt aktivieren

Im Projektordner:

```bash
npx rulebook-cli init
```

Der Befehl zeigt, was er schreiben wird: Hooks für die erkannten Agenten, einen Block in `AGENTS.md` und einen git-pre-commit-Hook. Geschrieben wird erst nach Ihrer Bestätigung:

```bash
npx rulebook-cli init --yes
```

Mit dem Claude-Code-Plugin ist dieser Schritt optional: Das Plugin bringt die Hooks bereits mit.

### Schritt 3 — Prüfen

```bash
npx rulebook-cli doctor
```

Jede Zeile beginnt mit `✓` (in Ordnung) oder `!` (zu beheben, mit dem passenden Befehl).

### Unterstützte Agenten

| Agent | Erkennung nach einer Änderung | Hinweise |
|---|---|---|
| Claude Code | `PostToolUse` + `Stop` | durchgängig verifiziert |
| GitHub Copilot | `postToolUse` | `.github/hooks/rulebook.json`, wird auch vom Cloud-Agenten gelesen |
| Gemini CLI | `AfterTool` | |
| Codex | `PostToolUse` + `Stop` | einmal mit `/hooks` freigeben |
| Cursor | `postToolUse` | |
| Mistral Vibe | `post_tool` | |
| Kiro, OpenCode, Windsurf | — | nur `AGENTS.md` + pre-commit |

Außer bei Claude Code folgen die Hook-Formate der Dokumentation des jeweiligen Anbieters, Stand Oktober 2026. Rückmeldungen sind willkommen.

## Schnellstart

Sprechen Sie mit Ihrem Agenten:

1. *„Erfasse die Geschäftsdomänen dieser Codebasis.“* → `rulebook-map`, dann `rulebook/rulebook.html` öffnen
2. *„Extrahiere die Geschäftsregeln der Domäne ORD.“* → `rulebook-extract`
3. *„Finde die Grenzfälle von ORD-R001.“* → `rulebook-edge-cases`
4. Programmieren Sie weiter. Ändert sich der Code einer Regel, erscheint eine einzige Zeile:
   `rulebook: ORD-R001 may have changed (refund.js) → rulebook/inbox.md`
5. *„Verarbeite den rulebook-Posteingang.“* → `rulebook-sync`, dann *„Veröffentliche das Rulebook.“* → `rulebook-publish`

Was in Ihrem Projekt landet:

```
rulebook/
├── index.md              # die Geschäftsdomänen
├── ORD-bestellungen.md   # eine Datei pro Domäne: Richtlinien und Regeln mit ihren Belegen
├── inbox.md              # vom Begleiter erkannte Änderungen, die auf Freigabe warten
└── rulebook.html         # das Dokument, eine eigenständige Datei
```

## Update-Anleitung

Skills, CLI und Hooks teilen sich **eine Versionsnummer**. Die CLI meldet höchstens einmal am Tag, wenn eine neue erscheint: `rulebook 0.2.0 available — …`. Abschalten mit `RULEBOOK_NO_UPDATE_CHECK=1`; in CI ist die Meldung aus.

### 1. Skills so aktualisieren, wie Sie sie installiert haben

| Installiert mit | Aktualisieren mit |
|---|---|
| Claude-Code-Plugin | `claude plugin update rulebook@rulebook`, oder `/plugin` → Marketplaces → rulebook → *Enable auto-update*, um nicht mehr daran denken zu müssen |
| skills.sh | `npx skills update` im Projektordner (`npx skills update -g` bei globaler Installation) |
| npm | `npx rulebook-cli@latest update` |

### 2. Das Projekt auffrischen

In jedem Projekt, das rulebook nutzt:

```bash
npx rulebook-cli@latest update
```

Der Befehl frischt nur auf, was rulebook installiert hat (Hooks, Skill-Kopien), und installiert nie überraschend etwas Neues. Erstellen Sie danach das Dokument mit der neuen Vorlage neu:

```bash
npx rulebook-cli@latest build
```

### 3. Prüfen

```bash
npx rulebook-cli@latest doctor
```

`doctor` meldet Hooks einer älteren Version und ein `rulebook.html`, das von einer anderen Version erstellt wurde.

## CLI

```
rulebook index      # Beleg-Index neu aufbauen, Probleme melden
rulebook scan       # Entscheidungspunkte auflisten, die noch keine Karte abdeckt
rulebook check      # Regeländerungen erkennen, den Posteingang schreiben
rulebook build      # rulebook/rulebook.html erzeugen
rulebook export okf  # das Rulebook als Open-Knowledge-Format-Bundle
rulebook data       # einen SQL-Dump oder JSON-Export lesen, nur lesend
rulebook doctor     # die Installation prüfen
rulebook update     # die von der CLI installierten Hooks und Skill-Kopien auffrischen
rulebook --help
```

Keine Abhängigkeiten. Nutzen Sie sie mit `npx rulebook-cli <Befehl>` oder installieren Sie sie mit `npm i -g rulebook-cli`.

## Dasselbe Dokument für alle

Der Agent schreibt `rulebook.html` nie selbst. Nur `rulebook build` erzeugt die Datei, aus einer im Paket mitgelieferten Vorlage, ohne KI. Dieselbe Version und dieselben Karten ergeben dieselbe Datei, Byte für Byte; `SOURCE_DATE_EPOCH` legt das Datum fest. Die Datei ist mit `<meta name="generator" content="rulebook-cli x.y.z">` signiert, und `rulebook doctor` meldet eine, die nicht von der CLI stammt.

## FAQ

**Verändert es meinen Code?** Nein. Die Skills schreiben nur unter `rulebook/`. `init --yes` schreibt die Hook-Dateien, die Sie freigegeben haben, `update` frischt nur auf, was rulebook installiert hat, und `skills --yes` kopiert die Skills in Ihr Home-Verzeichnis.

**Welche Sprachen?** Die Skills sind auf Englisch geschrieben. Die Referenz wird in der Sprache Ihres Projekts verfasst (`rulebook/config.json` → `language`). Die Beschriftungen des HTML-Dokuments gibt es auf Englisch und Französisch.

**Woher weiß ich, dass eine Regel stimmt?** Jede Regel nennt die Zeilen, die sie entscheiden, und trägt eine Vertrauensstufe: *durch Code und Test belegt*, *im Code gelesen*, *abgeleitet* oder *widersprüchlich*. Ein Blind-Audit prüft sie: ein zweiter Durchgang, der nur die Karte und den zitierten Code sieht. `rulebook index --strict` schlägt fehl, wenn ein Zitat nicht mehr existiert. Er schlägt auch fehl, wenn ein zitiertes Symbol nicht in seinen Zeilen steht, und meldet Methoden, die nur Tests aufrufen. Um Regeln zu finden, die niemand aufgeschrieben hat, listet `rulebook scan` die Entscheidungspunkte des Codes (Ablehnungen, Bedingungen auf feste Werte, Berechtigungen, Limits, Zustandswechsel), die keine Karte abdeckt, und das Dokument zeigt diese Abdeckung pro Domäne.

**Wie wird es getestet?** Mit einer Test-App voller Fallen (ein lügender Kommentar, toter Code, eine als Regel getarnte technische Entscheidung) und einem Bewertungsskript. Jede Skill wurde zuerst *ohne* die Skill ausgeführt, um die Fehler zu beobachten, und dann so geschrieben, dass sie diese behebt. Siehe [`tests/skills/runs/`](https://github.com/GregoryBabonaux/rulebook/tree/main/tests/skills/runs).

**Kann es meine Daten lesen?** Ja, nur lesend. Beim ersten Aufruf einer Skill bietet rulebook an, eine Datenbank zu nutzen, die Ihr Agent über einen MCP-Server erreicht, einen SQL-Dump oder einen JSON-Export, und merkt sich Ihre Antwort in `rulebook/config.json`. Daten zeigen Regeln, die der Code allein verbirgt: einen pro Produkt gespeicherten Mehrwertsteuersatz, eine Frist in einer Einstellungstabelle oder ein Buch mit 20 %, obwohl die Regel 5,5 % sagt. Karten zitieren Tabellen, Anzahlen und IDs, nie personenbezogene Daten. `rulebook data` liest Dumps und Exporte ohne Datenbankserver.

**Kann ich die Regeln in anderen Werkzeugen nutzen?** `rulebook export okf` schreibt das Rulebook als [Open-Knowledge-Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)-Bundle: eine Markdown-Datei pro Domäne, Richtlinie und Regel, mit Quellen, Audit und Historie, für Datenkataloge, Wikis und andere Agenten. Die Skills lesen außerdem vorhandenes OKF-Wissen Ihres Projekts als Kontext.

**Wo ist das Kartenformat beschrieben?** In [`references/card-template.md`](https://github.com/GregoryBabonaux/rulebook/blob/main/references/card-template.md).

## Lizenz

MIT © Grégory Babonaux
