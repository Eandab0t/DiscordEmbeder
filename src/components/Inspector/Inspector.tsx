import {
  ButtonStyle,
  ComponentType,
  SeparatorSpacing,
  type Emoji,
  type SelectOption,
} from '../../model/discord-components-v2-schema';
import { isSectionNode, nodeLabel, type ComponentNode, type DiscordData } from '../../model/node';
import { Button, Field, ColorInput, IconButton, NumberInput, SelectInput, TextArea, TextInput, Toggle } from '../ui/primitives';

interface InspectorProps {
  node: ComponentNode | null;
  updateData: (key: string, updater: (data: DiscordData) => void) => void;
  removeNode: (key: string) => void;
  duplicateNode: (key: string) => void;
}

export function Inspector({ node, updateData, removeNode, duplicateNode }: InspectorProps) {
  if (!node) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-discord-panel text-2xl">
            ⚙️
          </div>
          <h3 className="text-sm font-bold text-discord-text">Nothing selected</h3>
          <p className="mt-1 text-xs leading-relaxed text-discord-muted">
            Click a component on the canvas to edit its fields here.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-discord-sidebar px-3 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-discord-muted">
          {nodeLabel(node.type)}
        </span>
        <span className="ml-auto flex gap-1">
          <IconButton title="Duplicate component" onClick={() => duplicateNode(node.key)}>⧉</IconButton>
          <IconButton title="Delete component" danger onClick={() => removeNode(node.key)}>✕</IconButton>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <InspectorFields node={node} updateData={updateData} />
      </div>
    </div>
  );
}

function InspectorFields({ node, updateData }: { node: ComponentNode; updateData: InspectorProps['updateData'] }) {
  const upd = (fn: (d: DiscordData) => void) => updateData(node.key, fn);
  switch (node.type) {
    case ComponentType.Container:
      return <ContainerFields node={node} upd={upd} />;
    case ComponentType.Section:
      return <SectionFields node={node} upd={upd} />;
    case ComponentType.TextDisplay:
      return <TextDisplayFields node={node} upd={upd} />;
    case ComponentType.MediaGallery:
      return <MediaGalleryFields node={node} upd={upd} />;
    case ComponentType.File:
      return <FileFields node={node} upd={upd} />;
    case ComponentType.Separator:
      return <SeparatorFields node={node} upd={upd} />;
    case ComponentType.ActionRow:
      return <ActionRowFields node={node} upd={upd} />;
    case ComponentType.Button:
      return <ButtonFields node={node} upd={upd} />;
    case ComponentType.StringSelect:
      return <StringSelectFields node={node} upd={upd} />;
    case ComponentType.UserSelect:
    case ComponentType.RoleSelect:
    case ComponentType.MentionableSelect:
    case ComponentType.ChannelSelect:
      return <ResolvedSelectFields node={node} upd={upd} />;
    case ComponentType.Thumbnail:
      return <ThumbnailFields node={node} upd={upd} />;
    default:
      return <p className="text-xs text-discord-muted">No editable fields.</p>;
  }
}

type Upd = (fn: (d: DiscordData) => void) => void;

/** Bind a typed field setter for one component's data:
 *  `set('label', value)` applies the store update with the concrete data type preserved. */
function fieldSetter<D extends DiscordData>(upd: Upd, _data: D) {
  return <F extends keyof D>(field: F, value: D[F]) => upd((x) => { (x as D)[field] = value; });
}

// ---------------------------------------------------------------------------
// Per-type field groups
// ---------------------------------------------------------------------------

function ContainerFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<DiscordData, { type: ComponentType.Container }>;
  const set = fieldSetter(upd, d);
  return (
    <div className="flex flex-col gap-3">
      <Field label="Accent color" hint="RGB integer, like embed colors">
        <ColorInput value={d.accent_color ?? null} onChange={(v) => set('accent_color', v)} />
      </Field>
      <Toggle
        label="Spoiler (blur entire container)"
        checked={!!d.spoiler}
        onChange={(v) => set('spoiler', v)}
      />
      <p className="text-[11px] leading-relaxed text-discord-muted">
        Children are managed on the canvas — drop components into the container's zone.
      </p>
    </div>
  );
}

function SectionFields({ node }: { node: ComponentNode; upd: Upd }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] leading-relaxed text-discord-muted">
        A Section holds 1–3 Text Displays plus exactly one accessory (Button or Thumbnail).
        Children and the accessory are managed on the canvas.
      </p>
      {isSectionNode(node) && (
        <p className="text-[11px] text-discord-muted">
          Accessory: <span className="text-discord-text">{node.accessory ? nodeLabel(node.accessory.type) : 'none yet'}</span>
        </p>
      )}
      <div className="rounded border border-discord-sidebar bg-discord-sidebar/50 p-2 text-[11px] text-discord-muted">
        <code className="text-discord-text">type: 9</code>
      </div>
    </div>
  );
}

function TextDisplayFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<DiscordData, { type: ComponentType.TextDisplay }>;
  const set = fieldSetter(upd, d);
  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Content"
        hint={`${d.content.length}/4000`}
        error={d.content.length > 4000 ? 'Over the per-field sanity limit; total text cap is 4000 across the message.' : undefined}
      >
        <TextArea
          value={d.content}
          rows={10}
          onChange={(e) => set('content', e.target.value)}
          placeholder="Markdown supported: **bold**, *italic*, __underline__, # headings, lists, links…"
        />
      </Field>
      <div className="rounded border border-discord-sidebar bg-discord-sidebar/50 p-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-discord-muted">Markdown cheatsheet</p>
        <p className="text-[11px] leading-relaxed text-discord-muted">
          <code># H1</code> · <code>## H2</code> · <code>**bold**</code> · <code>*italic*</code> ·{' '}
          <code>__underline__</code> · <code>~~strike~~</code> · <code>`code`</code> ·{' '}
          <code>&gt; quote</code> · <code>- list</code> · <code>[text](url)</code> ·{' '}
          <code>&lt;url&gt;</code> auto-links
        </p>
      </div>
    </div>
  );
}

function MediaGalleryFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<DiscordData, { type: ComponentType.MediaGallery }>;
  const set = fieldSetter(upd, d);
  const setItems = (items: typeof d.items) => set('items', items);
  return (
    <div className="flex flex-col gap-2">
      {d.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-discord-sidebar bg-discord-base/60 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-discord-muted">Item {i + 1}</span>
            <span className="flex gap-0.5">
              <IconButton
                title="Remove item"
                danger
                onClick={() => setItems(d.items.filter((_, j) => j !== i))}
              >
                ✕
              </IconButton>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Field label="Media URL" hint="https:// or attachment://">
              <TextInput
                value={item.media.url}
                onChange={(e) =>
                  setItems(d.items.map((it, j) => (j === i ? { ...it, media: { url: e.target.value } } : it)))
                }
                placeholder="https://…"
              />
            </Field>
            <Field label="Description (alt text)">
              <TextInput
                value={item.description ?? ''}
                onChange={(e) =>
                  setItems(d.items.map((it, j) => (j === i ? { ...it, description: e.target.value || undefined } : it)))
                }
              />
            </Field>
            <Toggle
              label="Spoiler"
              checked={!!item.spoiler}
              onChange={(v) => setItems(d.items.map((it, j) => (j === i ? { ...it, spoiler: v } : it)))}
            />
          </div>
        </div>
      ))}
      <Button
        onClick={() => setItems([...d.items, { media: { url: '' } }])}
        disabled={d.items.length >= 10}
      >
        + Add item ({d.items.length}/10)
      </Button>
    </div>
  );
}

function FileFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<DiscordData, { type: ComponentType.File }>;
  const set = fieldSetter(upd, d);
  return (
    <div className="flex flex-col gap-3">
      <Field
        label="File URL"
        hint="must be attachment://filename.ext"
        error={!/^attachment:\/\//i.test(d.file?.url ?? '') ? 'Must start with attachment://' : undefined}
      >
        <TextInput
          value={d.file?.url ?? ''}
          onChange={(e) => set('file', { url: e.target.value })}
          placeholder="attachment://image.png"
        />
      </Field>
      <Toggle label="Spoiler" checked={!!d.spoiler} onChange={(v) => set('spoiler', v)} />
      <p className="text-[11px] leading-relaxed text-discord-muted">
        The file itself must be uploaded with the message (multipart form) and referenced here as{' '}
        <code>attachment://name.ext</code>. Webhooks can upload files alongside the Components V2
        payload via multipart form data.
      </p>
    </div>
  );
}

function SeparatorFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<DiscordData, { type: ComponentType.Separator }>;
  const set = fieldSetter(upd, d);
  return (
    <div className="flex flex-col gap-3">
      <Field label="Spacing">
        <SelectInput
          value={String(d.spacing ?? SeparatorSpacing.Small)}
          onChange={(v) => set('spacing', Number(v) as SeparatorSpacing)}
          options={[
            { value: SeparatorSpacing.Small, label: 'Small' },
            { value: SeparatorSpacing.Large, label: 'Large' },
          ]}
        />
      </Field>
      <Toggle label="Divider line" checked={d.divider !== false} onChange={(v) => set('divider', v)} />
    </div>
  );
}

function ActionRowFields(_: { node: ComponentNode; upd: Upd }) {
  return (
    <p className="text-[11px] leading-relaxed text-discord-muted">
      An Action Row holds up to 5 buttons or exactly one select menu. Its children are managed on
      the canvas.
    </p>
  );
}

function ButtonFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<DiscordData, { type: ComponentType.Button }>;
  const set = fieldSetter(upd, d);
  const isLink = d.style === ButtonStyle.Link;
  return (
    <div className="flex flex-col gap-3">
      <Field label="Style">
        <SelectInput
          value={String(d.style)}
          onChange={(v) => set('style', Number(v) as ButtonStyle)}
          options={[
            { value: ButtonStyle.Primary, label: 'Primary (blurple)' },
            { value: ButtonStyle.Secondary, label: 'Secondary (grey)' },
            { value: ButtonStyle.Success, label: 'Success (green)' },
            { value: ButtonStyle.Danger, label: 'Danger (red)' },
            { value: ButtonStyle.Link, label: 'Link (navigates to URL)' },
          ]}
        />
      </Field>
      <Field label="Label" hint="max 80 chars">
        <TextInput
          value={d.label ?? ''}
          maxLength={80}
          onChange={(e) => set('label', e.target.value || undefined)}
        />
      </Field>
      <EmojiField emoji={d.emoji} onChange={(emoji) => set('emoji', emoji)} />
      {isLink ? (
        <Field
          label="URL"
          hint="required for link buttons"
          error={!/^https?:\/\//i.test(d.url ?? '') ? 'Must start with http:// or https://' : undefined}
        >
          <TextInput
            value={d.url ?? ''}
            onChange={(e) => set('url', e.target.value || undefined)}
            placeholder="https://…"
          />
        </Field>
      ) : (
        <Field label="custom_id" hint="required for non-link buttons" error={!d.custom_id ? 'Required' : undefined}>
          <TextInput
            value={d.custom_id ?? ''}
            onChange={(e) => set('custom_id', e.target.value || undefined)}
            placeholder="my_button_click"
          />
        </Field>
      )}
      <Toggle label="Disabled" checked={!!d.disabled} onChange={(v) => set('disabled', v)} />
    </div>
  );
}

function StringSelectFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<DiscordData, { type: ComponentType.StringSelect }>;
  const set = fieldSetter(upd, d);
  const setOptions = (options: SelectOption[]) => set('options', options);
  return (
    <div className="flex flex-col gap-3">
      <Field label="custom_id" error={!d.custom_id ? 'Required' : undefined}>
        <TextInput
          value={d.custom_id}
          onChange={(e) => set('custom_id', e.target.value)}
        />
      </Field>
      <Field label="Placeholder">
        <TextInput
          value={d.placeholder ?? ''}
          onChange={(e) => set('placeholder', e.target.value || undefined)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Min values">
          <NumberInput value={d.min_values} min={0} max={25} onChange={(v) => set('min_values', v)} />
        </Field>
        <Field label="Max values">
          <NumberInput value={d.max_values} min={1} max={25} onChange={(v) => set('max_values', v)} />
        </Field>
      </div>
      <Toggle label="Disabled" checked={!!d.disabled} onChange={(v) => set('disabled', v)} />
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold">Options ({d.options.length}/25)</span>
          <Button onClick={() => setOptions([...d.options, { label: `Option ${d.options.length + 1}`, value: `option_${d.options.length + 1}` }])} disabled={d.options.length >= 25}>
            + Add
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {d.options.map((opt, i) => (
            <div key={i} className="rounded-lg border border-discord-sidebar bg-discord-base/60 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-discord-muted">Option {i + 1}</span>
                <IconButton title="Remove option" danger onClick={() => setOptions(d.options.filter((_, j) => j !== i))}>✕</IconButton>
              </div>
              <div className="flex flex-col gap-1.5">
                <TextInput
                  value={opt.label}
                  placeholder="Label"
                  maxLength={100}
                  onChange={(e) => setOptions(d.options.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))}
                />
                <TextInput
                  value={opt.value}
                  placeholder="value (dev-facing)"
                  maxLength={100}
                  onChange={(e) => setOptions(d.options.map((o, j) => (j === i ? { ...o, value: e.target.value } : o)))}
                />
                <TextInput
                  value={opt.description ?? ''}
                  placeholder="Description (optional)"
                  maxLength={100}
                  onChange={(e) => setOptions(d.options.map((o, j) => (j === i ? { ...o, description: e.target.value || undefined } : o)))}
                />
                <EmojiField
                  emoji={opt.emoji}
                  onChange={(emoji) => setOptions(d.options.map((o, j) => (j === i ? { ...o, emoji } : o)))}
                />
                <Toggle
                  label="Default"
                  checked={!!opt.default}
                  onChange={(v) => setOptions(d.options.map((o, j) => (j === i ? { ...o, default: v } : o)))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResolvedSelectFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<
    DiscordData,
    { type: ComponentType.UserSelect | ComponentType.RoleSelect | ComponentType.MentionableSelect | ComponentType.ChannelSelect }
  >;
  const set = fieldSetter(upd, d);
  const isChannel = node.type === ComponentType.ChannelSelect;
  const setChannelTypes = (raw: string) => {
    const list = raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0);
    upd((x) => {
      if (x.type !== ComponentType.ChannelSelect) return;
      x.channel_types = list.length ? list : undefined;
    });
  };
  return (
    <div className="flex flex-col gap-3">
      <Field label="custom_id" error={!d.custom_id ? 'Required' : undefined}>
        <TextInput
          value={d.custom_id}
          onChange={(e) => set('custom_id', e.target.value)}
        />
      </Field>
      <Field label="Placeholder">
        <TextInput
          value={d.placeholder ?? ''}
          onChange={(e) => set('placeholder', e.target.value || undefined)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Min values">
          <NumberInput value={d.min_values} min={0} max={25} onChange={(v) => set('min_values', v)} />
        </Field>
        <Field label="Max values">
          <NumberInput value={d.max_values} min={1} max={25} onChange={(v) => set('max_values', v)} />
        </Field>
      </div>
      {isChannel && (
        <Field label="Channel types" hint="comma-separated ints (0 text, 2 voice, 4 category…)">
          <TextInput
            value={(d.channel_types ?? []).join(', ')}
            onChange={(e) => setChannelTypes(e.target.value)}
            placeholder="e.g. 0, 5"
          />
        </Field>
      )}
      <Toggle label="Disabled" checked={!!d.disabled} onChange={(v) => set('disabled', v)} />
    </div>
  );
}

function ThumbnailFields({ node, upd }: { node: ComponentNode; upd: Upd }) {
  const d = node.data as Extract<DiscordData, { type: ComponentType.Thumbnail }>;
  const set = fieldSetter(upd, d);
  return (
    <div className="flex flex-col gap-3">
      <Field label="Media URL" hint="https:// or attachment://">
        <TextInput
          value={d.media?.url ?? ''}
          onChange={(e) => set('media', { url: e.target.value })}
          placeholder="https://…"
        />
      </Field>
      <Field label="Description (alt text)">
        <TextInput
          value={d.description ?? ''}
          onChange={(e) => set('description', e.target.value || undefined)}
        />
      </Field>
      <Toggle label="Spoiler" checked={!!d.spoiler} onChange={(v) => set('spoiler', v)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared emoji editor
// ---------------------------------------------------------------------------

function EmojiField({ emoji, onChange }: { emoji: Emoji | undefined; onChange: (e: Emoji | undefined) => void }) {
  const unicode = emoji && !emoji.id ? emoji.name ?? '' : '';
  const customId = emoji?.id ?? '';
  const customName = emoji?.id ? emoji.name ?? '' : '';
  return (
    <div className="rounded-lg border border-discord-sidebar bg-discord-base/60 p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-discord-muted">Emoji</span>
        {emoji && <IconButton title="Clear emoji" danger onClick={() => onChange(undefined)}>✕</IconButton>}
      </div>
      <div className="flex flex-col gap-1.5">
        <TextInput
          value={unicode}
          placeholder="Unicode emoji (e.g. 🔥)"
          maxLength={8}
          onChange={(e) => {
            const name = e.target.value || undefined;
            if (name) onChange({ name, animated: false });
            else onChange(undefined);
          }}
        />
        <div className="grid grid-cols-2 gap-1.5">
          <TextInput
            value={customId}
            placeholder="Custom emoji ID"
            onChange={(e) => {
              const id = e.target.value || undefined;
              if (id) onChange({ id, name: customName || undefined, animated: emoji?.animated });
              else onChange(unicode ? { name: unicode } : undefined);
            }}
          />
          <TextInput
            value={customName}
            placeholder="Custom name"
            onChange={(e) => {
              const name = e.target.value || undefined;
              if (customId || name) onChange({ id: customId, name, animated: emoji?.animated });
              else onChange(undefined);
            }}
          />
        </div>
      </div>
    </div>
  );
}
