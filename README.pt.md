<div align="center">

# rulebook

**Transforme as regras de negócio enterradas no seu código numa referência que todos conseguem ler, e mantenha-a correta enquanto programa.**

[![npm](https://img.shields.io/npm/v/rulebook-cli?color=6366f1&label=npm)](https://www.npmjs.com/package/rulebook-cli)
[![CI](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml/badge.svg)](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-8b5cf6)](https://github.com/GregoryBabonaux/rulebook/blob/main/LICENSE)
![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-06b6d4)

[English](https://github.com/GregoryBabonaux/rulebook/blob/main/README.md) · [Français](https://github.com/GregoryBabonaux/rulebook/blob/main/README.fr.md) · [Español](https://github.com/GregoryBabonaux/rulebook/blob/main/README.es.md) · [Deutsch](https://github.com/GregoryBabonaux/rulebook/blob/main/README.de.md) · **Português** · [Italiano](https://github.com/GregoryBabonaux/rulebook/blob/main/README.it.md)

<img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/document.png" alt="Um documento rulebook: uma regra de reembolso com o seu contexto, casos-limite, provas contraditórias e uma pergunta em aberto" width="900">

</div>

## Porquê

Todo o produto esconde as suas regras no código: um prazo de reembolso, um bloqueio após cinco tentativas de login falhadas, um teto de desconto. Ninguém as sabe enumerar, os comentários mentem e as especificações estão desatualizadas. O **rulebook** dá ao seu agente de código as skills para ler o código, escrever essas regras em linguagem clara com as provas em anexo, e perceber quando uma alteração no código toca numa delas.

- **Legível por todos.** Cada regra diz o que o produto faz, porquê, e quais são as exceções, tanto para product owners como para programadores.
- **Comprovado.** Cada regra cita as linhas e os testes exatos que a decidem, com um nível de confiança. Vale o código, não os comentários.
- **Vivo.** Um companheiro acompanha as suas alterações e assinala as regras que podem ter mudado. Nada é reescrito sem a sua aprovação.
- **Qualquer agente.** Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Mistral Vibe e qualquer agente que leia ficheiros `SKILL.md`, ao lado de superpowers, spec-kit ou BMAD.

## Um documento, três vistas

O resultado é um único ficheiro HTML: funciona offline, pode ser enviado por e-mail e impresso em PDF.

| Mapa | Painel (modo escuro) |
|---|---|
| <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/map.png" alt="Mapa interativo: domínios, políticas e regras numa árvore que se expande e reorganiza" width="440"> | <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/dashboard-dark.png" alt="Painel: números-chave, regras por domínio coloridas pela confiança, alterações recentes e pontos a validar" width="440"> |
| Expanda domínios, políticas, regras e casos-limite. Arraste um nó para mover o seu ramo. | Números-chave, confiança por domínio, alterações recentes, perguntas em aberto. |

As capturas vêm de uma loja fictícia cheia de armadilhas: um comentário que anuncia 30 dias quando o código aplica 7, e código morto. O documento de exemplo está em francês; o seu ficará na língua do seu projeto.

## Como funciona

| Nível | Skill | O que obtém |
|---|---|---|
| 1 | `rulebook-map` | os domínios de negócio, com o que cada um cobre e onde vive o seu código |
| 2 | `rulebook-extract` | as regras de um domínio: políticas (*porquê*) e regras operacionais (*como*), verificadas por uma auditoria às cegas |
| 3 | `rulebook-edge-cases` | o que acontece nos limites de uma regra (*Dado… quando… então…*) |
| — | `rulebook-sync` | processa a caixa de entrada após alterações no código |
| — | `rulebook-publish` | gera o documento HTML e, se tiver um conector (Notion, Drive…), propõe publicá-lo |

Cada nível para à espera da sua validação antes de escrever. O rulebook nunca toca no seu código-fonte nem nos seus testes.

As **skills** avaliam: o seu agente lê o código. O **companheiro** deteta: uma pequena CLI sem IA, executada pelos hooks do seu agente e por um hook git pre-commit.

## Guia de instalação

**Requisitos:** git, e Node.js 22 ou superior para o companheiro e o HTML. As skills funcionam sem Node; nesse caso obtém apenas o Markdown.

### Passo 1 — Instalar as skills (escolha uma opção)

| Usa | Execute | Obtém |
|---|---|---|
| **Claude Code** (recomendado) | `/plugin marketplace add GregoryBabonaux/rulebook`<br>`/plugin install rulebook@rulebook` | skills + hooks do companheiro |
| **Qualquer agente** (Codex, Cursor, Gemini, Copilot, Vibe…) | `npx skills add GregoryBabonaux/rulebook` | skills, no projeto ou globalmente (`-g`) |
| **Sem skills.sh** | `npx rulebook-cli skills --yes` | skills copiadas para `~/.agents/skills` e `~/.claude/skills` |

### Passo 2 — Ativar o companheiro no seu projeto

Na pasta do projeto:

```bash
npx rulebook-cli init
```

O comando mostra o que vai escrever: os hooks dos agentes detetados, um bloco em `AGENTS.md` e um hook git pre-commit. Nada é escrito antes da sua confirmação:

```bash
npx rulebook-cli init --yes
```

Com o plugin do Claude Code, este passo é opcional: o plugin já traz os hooks.

### Passo 3 — Verificar

```bash
npx rulebook-cli doctor
```

Cada linha começa por `✓` (tudo bem) ou `!` (a corrigir, com o comando a executar).

### Agentes suportados

| Agente | Deteção após uma alteração | Notas |
|---|---|---|
| Claude Code | `PostToolUse` + `Stop` | verificado de ponta a ponta |
| GitHub Copilot | `postToolUse` | `.github/hooks/rulebook.json`, lido também pelo agente na nuvem |
| Gemini CLI | `AfterTool` | |
| Codex | `PostToolUse` + `Stop` | aprove uma vez com `/hooks` |
| Cursor | `postToolUse` | |
| Mistral Vibe | `post_tool` | |
| Kiro, OpenCode, Windsurf | — | apenas `AGENTS.md` + pre-commit |

Fora do Claude Code, os formatos de hooks seguem a documentação de cada fornecedor em outubro de 2026. Os relatos são bem-vindos.

## Início rápido

Fale com o seu agente:

1. *«Mapeia os domínios de negócio deste código.»* → `rulebook-map`, e abra `rulebook/rulebook.html`
2. *«Extrai as regras de negócio do domínio ORD.»* → `rulebook-extract`
3. *«Encontra os casos-limite de ORD-R001.»* → `rulebook-edge-cases`
4. Continue a programar. Quando o código de uma regra muda, aparece uma única linha:
   `rulebook: ORD-R001 may have changed (refund.js) → rulebook/inbox.md`
5. *«Processa a caixa de entrada do rulebook.»* → `rulebook-sync`, depois *«Publica o rulebook.»* → `rulebook-publish`

O que fica no seu projeto:

```
rulebook/
├── index.md            # os domínios de negócio
├── ORD-encomendas.md   # um ficheiro por domínio: políticas e regras, com as suas provas
├── inbox.md            # alterações detetadas pelo companheiro, à espera de validação
└── rulebook.html       # o documento, um único ficheiro autónomo
```

## Guia de atualização

Skills, CLI e hooks partilham **um único número de versão**. A CLI avisa quando sai uma nova, no máximo uma vez por dia: `rulebook 0.2.0 available — …`. Desative o aviso com `RULEBOOK_NO_UPDATE_CHECK=1`; em CI está desativado.

### 1. Atualize as skills da forma como as instalou

| Instaladas com | Atualizar com |
|---|---|
| Plugin do Claude Code | `claude plugin update rulebook@rulebook`, ou `/plugin` → Marketplaces → rulebook → *Enable auto-update* para não pensar mais nisso |
| skills.sh | `npx skills update` na pasta do projeto (`npx skills update -g` para uma instalação global) |
| npm | `npx rulebook-cli@latest update` |

### 2. Atualize o projeto

Em cada projeto que usa o rulebook:

```bash
npx rulebook-cli@latest update
```

Só atualiza o que o rulebook instalou (hooks, cópias das skills) e nunca instala nada de novo de surpresa. Depois, gere novamente o documento com o novo modelo:

```bash
npx rulebook-cli@latest build
```

### 3. Verifique

```bash
npx rulebook-cli@latest doctor
```

O `doctor` assinala hooks de uma versão anterior e um `rulebook.html` gerado por outra versão.

## CLI

```
rulebook index      # reconstrói o índice de provas, reporta problemas
rulebook check      # deteta alterações de regras, escreve a caixa de entrada
rulebook build      # gera rulebook/rulebook.html
rulebook doctor     # verifica a instalação
rulebook update     # atualiza os hooks e as cópias de skills instalados pela CLI
rulebook --help
```

Sem dependências. Use-a com `npx rulebook-cli <comando>` ou instale-a com `npm i -g rulebook-cli`.

## O mesmo documento para todos

O agente nunca escreve o `rulebook.html`. Só o `rulebook build` o gera, a partir de um modelo incluído no pacote, sem IA. A mesma versão e as mesmas fichas dão o mesmo ficheiro, byte a byte; `SOURCE_DATE_EPOCH` fixa a data. O ficheiro é assinado com `<meta name="generator" content="rulebook-cli x.y.z">`, e o `rulebook doctor` assinala um que a CLI não tenha gerado.

## Perguntas frequentes

**Altera o meu código?** Não. As skills só escrevem em `rulebook/`. `init --yes` escreve os ficheiros de hooks que aprovou, `update` só atualiza o que o rulebook instalou e `skills --yes` copia as skills para a sua pasta pessoal.

**Que línguas?** As skills estão escritas em inglês. A referência é redigida na língua do seu projeto (`rulebook/config.json` → `language`). Os rótulos do documento HTML existem em inglês e francês.

**Como sei se uma regra está certa?** Cada regra cita as linhas que a decidem e tem um nível de confiança: *comprovada pelo código e por um teste*, *lida no código*, *deduzida* ou *contraditória*. Uma auditoria às cegas verifica-a: uma segunda passagem que só vê a ficha e o código citado. `rulebook index --strict` falha quando uma citação deixa de existir.

**Como é testado?** Com uma aplicação de teste cheia de armadilhas (um comentário que mente, código morto, uma escolha técnica disfarçada de regra) e um avaliador. Cada skill foi primeiro executada *sem* a skill para observar as falhas, e depois escrita para as corrigir. Veja [`tests/skills/runs/`](https://github.com/GregoryBabonaux/rulebook/tree/main/tests/skills/runs).

**Onde está o formato das fichas?** Em [`references/card-template.md`](https://github.com/GregoryBabonaux/rulebook/blob/main/references/card-template.md).

## Licença

MIT © Grégory Babonaux
