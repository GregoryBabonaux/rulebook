<div align="center">

# rulebook

**Convierte las reglas de negocio enterradas en tu código en una referencia que cualquiera puede leer, y mantenla al día mientras programas.**

[![npm](https://img.shields.io/npm/v/rulebook-cli?color=6366f1&label=npm)](https://www.npmjs.com/package/rulebook-cli)
[![CI](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml/badge.svg)](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-8b5cf6)](https://github.com/GregoryBabonaux/rulebook/blob/main/LICENSE)
![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-06b6d4)

[English](https://github.com/GregoryBabonaux/rulebook/blob/main/README.md) · [Français](https://github.com/GregoryBabonaux/rulebook/blob/main/README.fr.md) · **Español** · [Deutsch](https://github.com/GregoryBabonaux/rulebook/blob/main/README.de.md) · [Português](https://github.com/GregoryBabonaux/rulebook/blob/main/README.pt.md) · [Italiano](https://github.com/GregoryBabonaux/rulebook/blob/main/README.it.md)

<img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/document.png" alt="Un documento rulebook: una regla de reembolso con su contexto, sus casos límite, pruebas contradictorias y una pregunta abierta" width="900">

</div>

## Por qué

Todo producto esconde sus reglas en el código: un plazo de reembolso, un bloqueo tras cinco inicios de sesión fallidos, un tope de descuento. Nadie sabe enumerarlas, los comentarios mienten y las especificaciones están desactualizadas. **rulebook** da a tu agente de código las skills para leer el código, escribir esas reglas en lenguaje claro con las pruebas adjuntas, y detectar cuándo un cambio en el código toca alguna de ellas.

- **Legible para todos.** Cada regla dice qué hace el producto, por qué y cuáles son sus excepciones, tanto para product owners como para desarrolladores.
- **Probado.** Cada regla cita las líneas y los tests exactos que la deciden, con un nivel de confianza. Manda el código, no los comentarios.
- **Vivo.** Un compañero sigue tus cambios y señala las reglas que pueden haber cambiado. Nada se reescribe sin tu aprobación.
- **Cualquier agente.** Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Mistral Vibe y cualquier agente que lea archivos `SKILL.md`, junto a superpowers, spec-kit o BMAD.

## Un documento, tres vistas

El resultado es un único archivo HTML: funciona sin conexión, se puede enviar por correo y se imprime en PDF.

| Mapa | Panel (modo oscuro) |
|---|---|
| <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/map.png" alt="Mapa interactivo: dominios, políticas y reglas en un árbol que se despliega y reorganiza" width="440"> | <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/dashboard-dark.png" alt="Panel: cifras clave, reglas por dominio coloreadas según la confianza, cambios recientes y puntos por validar" width="440"> |
| Despliega dominios, políticas, reglas y casos límite. Arrastra un nodo para mover su rama. | Cifras clave, confianza por dominio, cambios recientes, preguntas abiertas. |

Las capturas proceden de una tienda ficticia llena de trampas: un comentario que anuncia 30 días cuando el código aplica 7, y código muerto. El documento de ejemplo está en francés; el tuyo estará en el idioma de tu proyecto.

## Cómo funciona

| Nivel | Skill | Qué obtienes |
|---|---|---|
| 1 | `rulebook-map` | los dominios de negocio, con lo que cubre cada uno y dónde vive su código |
| 2 | `rulebook-extract` | las reglas de un dominio: políticas (*por qué*) y reglas operativas (*cómo*), verificadas por una auditoría a ciegas |
| 3 | `rulebook-edge-cases` | qué ocurre en los límites de una regla (*Dado… cuando… entonces…*) |
| — | `rulebook-sync` | procesa la bandeja de entrada tras cambios en el código |
| — | `rulebook-publish` | genera el documento HTML y, si tienes un conector (Notion, Drive…), ofrece publicarlo |

Cada nivel se detiene para que lo valides antes de escribir. rulebook nunca toca tu código fuente ni tus tests.

Las **skills** juzgan: tu agente lee el código. El **compañero** detecta: una pequeña CLI sin IA, ejecutada por los hooks de tu agente y por un hook git pre-commit.

## Guía de instalación

**Requisitos:** git, y Node.js 22 o superior para el compañero y el HTML. Las skills funcionan sin Node; en ese caso solo obtienes el Markdown.

### Paso 1 — Instalar las skills (elige una opción)

| Usas | Ejecuta | Obtienes |
|---|---|---|
| **Claude Code** (recomendado) | `/plugin marketplace add GregoryBabonaux/rulebook`<br>`/plugin install rulebook@rulebook` | skills + hooks del compañero |
| **Cualquier agente** (Codex, Cursor, Gemini, Copilot, Vibe…) | `npx skills add GregoryBabonaux/rulebook` | skills, en el proyecto o globalmente (`-g`) |
| **Sin skills.sh** | `npx rulebook-cli skills --yes` | skills copiadas en `~/.agents/skills` y `~/.claude/skills` |

### Paso 2 — Activar el compañero en tu proyecto

En la carpeta del proyecto:

```bash
npx rulebook-cli init
```

El comando muestra lo que va a escribir: los hooks de los agentes detectados, un bloque en `AGENTS.md` y un hook git pre-commit. No se escribe nada hasta que confirmas:

```bash
npx rulebook-cli init --yes
```

Con el plugin de Claude Code este paso es opcional: el plugin ya incluye los hooks.

### Paso 3 — Comprobar

```bash
npx rulebook-cli doctor
```

Cada línea empieza por `✓` (todo bien) o `!` (por corregir, con el comando que hay que ejecutar).

### Agentes compatibles

| Agente | Detección tras un cambio | Notas |
|---|---|---|
| Claude Code | `PostToolUse` + `Stop` | verificado de principio a fin |
| GitHub Copilot | `postToolUse` | `.github/hooks/rulebook.json`, también lo lee el agente en la nube |
| Gemini CLI | `AfterTool` | |
| Codex | `PostToolUse` + `Stop` | apruébalo una vez con `/hooks` |
| Cursor | `postToolUse` | |
| Mistral Vibe | `post_tool` | |
| Kiro, OpenCode, Windsurf | — | solo `AGENTS.md` + pre-commit |

Salvo en Claude Code, los formatos de hooks siguen la documentación de cada proveedor a octubre de 2026. Se agradecen los comentarios.

## Inicio rápido

Habla con tu agente:

1. *«Mapea los dominios de negocio de este código.»* → `rulebook-map`, y abre `rulebook/rulebook.html`
2. *«Extrae las reglas de negocio del dominio ORD.»* → `rulebook-extract`
3. *«Busca los casos límite de ORD-R001.»* → `rulebook-edge-cases`
4. Sigue programando. Cuando cambia el código de una regla, aparece una sola línea:
   `rulebook: ORD-R001 may have changed (refund.js) → rulebook/inbox.md`
5. *«Procesa la bandeja de entrada de rulebook.»* → `rulebook-sync`, y luego *«Publica el rulebook.»* → `rulebook-publish`

Lo que se añade a tu proyecto:

```
rulebook/
├── index.md          # los dominios de negocio
├── ORD-pedidos.md    # un archivo por dominio: políticas y reglas, con sus pruebas
├── inbox.md          # cambios detectados por el compañero, pendientes de validar
└── rulebook.html     # el documento, un único archivo autónomo
```

## Guía de actualización

Skills, CLI y hooks comparten **un único número de versión**. La CLI te avisa cuando sale una nueva, como mucho una vez al día: `rulebook 0.2.0 available — …`. Desactiva el aviso con `RULEBOOK_NO_UPDATE_CHECK=1`; en CI está desactivado.

### 1. Actualiza las skills como las instalaste

| Instaladas con | Actualizar con |
|---|---|
| Plugin de Claude Code | `claude plugin update rulebook@rulebook`, o `/plugin` → Marketplaces → rulebook → *Enable auto-update* para olvidarte |
| skills.sh | `npx skills update` en la carpeta del proyecto (`npx skills update -g` para una instalación global) |
| npm | `npx rulebook-cli@latest update` |

### 2. Refresca el proyecto

En cada proyecto que use rulebook:

```bash
npx rulebook-cli@latest update
```

Solo refresca lo que rulebook instaló (hooks, copias de skills) y nunca instala nada nuevo por sorpresa. Después, regenera el documento con la nueva plantilla:

```bash
npx rulebook-cli@latest build
```

### 3. Comprueba

```bash
npx rulebook-cli@latest doctor
```

`doctor` señala los hooks de una versión anterior y un `rulebook.html` generado por otra versión.

## CLI

```
rulebook index      # reconstruye el índice de pruebas, informa de problemas
rulebook scan       # lista los puntos de decisión que ninguna ficha cubre todavía
rulebook check      # detecta cambios de reglas, escribe la bandeja de entrada
rulebook build      # genera rulebook/rulebook.html
rulebook export okf  # la referencia como bundle Open Knowledge Format
rulebook data       # lee un dump SQL o un export JSON, solo lectura
rulebook doctor     # comprueba la instalación
rulebook update     # refresca los hooks y las copias de skills instalados por la CLI
rulebook --help
```

Sin dependencias. Úsala con `npx rulebook-cli <comando>` o instálala con `npm i -g rulebook-cli`.

## El mismo documento para todos

El agente nunca escribe `rulebook.html`. Solo `rulebook build` lo genera, a partir de una plantilla incluida en el paquete, sin IA. La misma versión y las mismas fichas dan el mismo archivo, byte a byte; `SOURCE_DATE_EPOCH` fija la fecha. El archivo va firmado con `<meta name="generator" content="rulebook-cli x.y.z">`, y `rulebook doctor` señala uno que la CLI no haya generado.

## Preguntas frecuentes

**¿Modifica mi código?** No. Las skills solo escriben en `rulebook/`. `init --yes` escribe los archivos de hooks que aprobaste, `update` solo refresca lo que rulebook instaló y `skills --yes` copia las skills en tu carpeta personal.

**¿Qué idiomas?** Las skills están escritas en inglés. La referencia se redacta en el idioma de tu proyecto (`rulebook/config.json` → `language`). Las etiquetas del documento HTML existen en inglés y francés.

**¿Cómo sé si una regla es correcta?** Cada regla cita las líneas que la deciden y lleva un nivel de confianza: *probada por el código y un test*, *leída en el código*, *deducida* o *contradictoria*. Una auditoría a ciegas la verifica: una segunda pasada que solo ve la ficha y el código citado. `rulebook index --strict` falla cuando una cita ya no existe. También falla cuando un símbolo citado no está en sus líneas, y señala los métodos que solo llaman los tests. Para encontrar las reglas que nadie escribió, `rulebook scan` lista los puntos de decisión del código (rechazos, condiciones sobre valores fijos, permisos, límites, cambios de estado) que ninguna ficha cubre, y el documento muestra esa cobertura por dominio.

**¿Cómo se prueba?** Con una aplicación de prueba llena de trampas (un comentario que miente, código muerto, una decisión técnica disfrazada de regla) y un evaluador. Cada skill se ejecutó primero *sin* la skill para observar los fallos, y después se escribió para corregirlos. Consulta [`tests/skills/runs/`](https://github.com/GregoryBabonaux/rulebook/tree/main/tests/skills/runs).

**¿Puede leer mis datos?** Sí, en solo lectura. La primera vez que se ejecuta una skill, propone usar una base de datos a la que tu agente accede mediante un servidor MCP, un dump SQL o un export JSON, y guarda tu respuesta en `rulebook/config.json`. Los datos revelan reglas que el código solo esconde: un tipo de IVA guardado por producto, un plazo en una tabla de ajustes, o un libro al 20 % cuando la regla dice 5,5 %. Las fichas citan tablas, recuentos e ids, nunca datos personales. `rulebook data` lee dumps y exports sin servidor de base de datos.

**¿Puedo usar las reglas en otras herramientas?** `rulebook export okf` escribe la referencia como bundle [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf): un archivo Markdown por dominio, política y regla, con sus fuentes, su auditoría y su historial, para catálogos de datos, wikis y otros agentes. Las skills también leen, como contexto, el conocimiento OKF que ya tenga tu proyecto.

**¿Dónde está el formato de las fichas?** En [`references/card-template.md`](https://github.com/GregoryBabonaux/rulebook/blob/main/references/card-template.md).

## Licencia

MIT © Grégory Babonaux
