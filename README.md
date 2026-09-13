# DiscordEmbeder

A visual, drag-and-drop builder for **Discord's Components V2** message system —
"structured Scratch": blocks snap only into legal Discord parent/child slots,
with multi-language code export, live preview, and local project files.

![stack](https://img.shields.io/badge/Vite-React-TypeScript-blue) ![tailwind](https://img.shields.io/badge/Tailwind_v4-dark_theme-38bdf8)

## Run it

```bash
npm install
npm run dev        # http://localhost:5188
npm run build      # typecheck + production build to dist/
```

No backend, no bot token. The only network call is the optional webhook
test-send, which POSTs straight from your browser to the webhook URL you paste.

## What's inside

| Area | Details |
| --- | --- |
| **Palette** | All 13 message-legal component types as draggable blocks; entries dim live when illegal for the slot under the cursor |
| **Canvas** | Nested drop zones driven by `ALLOWED_CHILDREN` — invalid drops are rejected visually at drag time with a reason, never silently accepted |
| **Inspector** | Every schema field on every type (button styles/emoji/custom_id/url, select options, markdown content, gallery items, separator spacing, container accent/spoiler, …) |
| **Preview** | Discord-dark message with APP badge, bot identity, GFM markdown, accent-color containers, galleries, buttons, selects, spoiler blur |
| **Export** | JSON (byte-exact `ComponentsV2Message`), discord.js, discord.py, cURL — raw payload literals per guardrails, behind a pluggable `Exporter` interface |
| **Import** | Paste/upload JSON; schema-validated with per-path error messages (e.g. `$.components[1].type — This type only exists inside a Section`) |
| **Projects** | `.discordv2proj.json` save/load (tree + identity + metadata), localStorage autosave every keystroke burst, undo/redo (Ctrl+Z / Ctrl+Shift+Z) |
| **Validation** | Live banner: 40-component ceiling (recursive), 4000-char text cap, link-button URL / custom_id requirements, section/action-row arity, attachment:// rules |
| **Templates** | Announcement card, patch notes, release card, simple welcome — one click |

## Architecture

```
src/
  model/                  # the schema file is the payload shape — do not renumber
    discord-components-v2-schema.ts   (canonical, copied from ReferenceSources)
    node.ts               # canvas node wrappers (key/children/accessory slot)
    tree.ts               # dataToNode / nodeToData / buildPayload / counters
    defaults.ts           # palette items + per-type default data
  store/useBuilderStore.ts# Zustand: tree, selection, history, session, autosave
  validation/rules.ts     # checkDrop (drop-time) + validateTree (banner); reads ALLOWED_CHILDREN
  exporters/              # types.ts interface; json/discordjs/discordpy/curl + index registry
  import/parse.ts         # JSON validation with path-precise errors
  templates/              # starter layouts as ComponentsV2Message literals
  components/             # Palette / Canvas / Inspector / Preview / ExportPanel / Toolbar / Outline / ValidationBanner / Modals / ui
```

Key invariants:

- `node.data` always matches the schema interfaces; serialization is
  `JSON.stringify` of that data, so export is byte-perfect by construction.
- Nesting legality has exactly one source: `ALLOWED_CHILDREN` (+ the Section
  accessory special case in `validation/rules.ts`). The canvas, palette dimming,
  and store mutations all delegate to it.
- Exporters are pure functions of `(payload, context)`. A new language is one
  file + one line in `exporters/index.ts` — no UI changes.

## Dev notes

- Dev-only store hook: `window.__builderStore` (see `main.tsx`) for console
  smoke tests.
- Verified against https://docs.discord.com/developers/components/reference
  (September 2026): type ids 1–14/17, `IS_COMPONENTS_V2 = 1 << 15`, 40-component
  ceiling, 4000-char total text, Section 1–3 texts + one accessory (button or
  thumbnail), gallery 1–10 items, File requires `attachment://`.
