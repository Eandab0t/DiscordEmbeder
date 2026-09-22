# Changelog

All notable changes to DiscordEmbeder are documented here.
The project was built and hardened in short, focused passes; each entry below
matches a merged PR.

## [Unreleased]

### Added

- **Saved webhooks**: webhook URLs can be named and saved in the send-test
  modal (persisted to localStorage, surviving reloads), then re-used with
  one click — **Resend** fires the *current* design through a saved webhook
  without re-pasting the URL. Each preset shows its last-send status
  (✓/✗, timestamp, and Discord's own response detail) and can be deleted;
  Resend is disabled while the `attachment://` warning is active.
- Webhook test-send now warns **before** sending when the design references
  `attachment://` uploads — Discord always rejects such payloads from a browser
  POST (`400 {"components":["…"]}`), so the modal says so up front.
- Discord's error bodies surface verbatim on failed sends, including terse
  bodies without a `message` field (e.g. `400 {"components":["1"]}` names the
  offending top-level component).
- Webhook URL validation accepts `ptb.`/`canary.` subdomains, matching where
  real webhook URLs actually live.

### Verified

- Full send-test loop exercised against Discord's production API with a real
  webhook: `POST …?with_components=true` with `flags: 32768` and no `content`
  field → **204 No Content** through the app's own modal, plus Discord's real
  `404: Unknown Webhook` and client-side malformed-URL error paths driven in
  the running UI.

## [0.5.0] — Real builder exporters

### Changed

- **discord.js export** emits real Components V2 builder code
  (`ContainerBuilder.addTextDisplayComponents(...)`, `SectionBuilder`
  with `setButtonAccessory`/`setThumbnailAccessory`, gallery/file builders,
  `MessageFlags.IsComponentsV2`), with imports limited to classes actually used.
- **discord.py export** emits runnable `discord.ui.LayoutView` code
  (`ui.Container(accent_colour=…)`, positional `ui.Thumbnail(media, …)` /
  `ui.File(media, …)`, `view.add_item(...)`, `await channel.send(view=...)`).
  The previous `channel.send(payload=…)` output was not a real discord.py kwarg
  and could never have run.

### Fixed

- Animated custom emoji now export correctly: discord.py gets `<a:name:id>`
  (parsed as animated) and selects never emit an unsupported `emoji=` kwarg.
- Duplicate `custom_id` across interactive components is flagged in the
  validation banner.

### Verified

- All seven real captured messages in `ReferenceSources/` (including three
  forwarded-message snapshots and the camelCase-`customId` client dump) flow
  through import → both exporters, and every generated snippet was **executed
  against the real SDKs** — discord.js 14.x `toJSON()` and discord.py
  `to_component_dict()` round-trip semantically identical to the source payload.

## [0.4.0] — Import fidelity

- Forwarded messages (`flags: 16384` + `message_snapshots[0].message`) now
  unwrap to the snapshot with a visible warning; messages that already carry
  real components ignore snapshots entirely.
- Client-dump normalization (`customId` → `custom_id`, string component ids)
  pinned by regression tests against the captured payload that motivated it;
  media objects strip proxy/scan fields down to `{url}`.

## [0.3.0] — Accuracy and proof

- Exporter contract tests pin generated output; the suite doubled as the
  executable spec for later refactors.
- Tree surgery (move/duplicate/drop legality) consolidated into the model
  layer (`model/tree.ts`); store delegates instead of re-deriving.
- Rejected mutations surface as toasts (no more silent no-ops at the 40-cap).
- Discord Labs-style builder tools: timestamp token helper, entity mention
  insertion, accurate live preview for mentions, emoji, and timestamps.

## [0.2.0] — Usability

- **Simple/Advanced modes**: simple mode adds blocks with one click into the
  selected container; advanced mode is full drag-and-drop.
- Six new starter templates (10 total) and save-your-own custom templates.
- Undo coalescing: rapid edits to the same field collapse into one undo step.
- Export panel loads lazily (React.lazy) so first paint doesn't pay for
  CodeMirror; copy emits raw exporter output (no markdown fences).

## [0.1.1] — Single-file build

- `npm run build` inlines everything into one `dist/index.html` that runs from
  `file://` — no server needed after building.

## [0.1.0] — Initial release

- Visual nested canvas with drag-and-drop, legality enforced from
  `ALLOWED_CHILDREN` at drop time with inline rejection reasons.
- Inspector coverage for every field of all 13 message-legal component types.
- Live Discord-dark preview with bot identity and markdown.
- JSON / discord.js / discord.py / cURL export behind a pluggable interface.
- JSON import with path-precise validation errors.
- Project save/load (`.discordv2proj.json`), localStorage autosave, undo/redo.
- Validation banner: 40-component ceiling, 4000-char text cap, required-field
  and arity rules.
- Webhook test-send with `?with_components=true` and the V2 flag.
