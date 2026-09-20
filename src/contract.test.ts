/**
 * Executable contract for DiscordEmbeder's pure logic layer.
 * Each block states a behavior Discord's Components V2 requires; if these
 * pass, the editor's validation, import, and export match the schema.
 */
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_CHILDREN,
  ButtonStyle,
  ComponentType as CT,
  IS_COMPONENTS_V2,
  MAX_TOTAL_COMPONENTS,
  SELECT_OPTIONS_CAP,
  SeparatorSpacing,
} from './model/discord-components-v2-schema';
import type { DiscordData } from './model/node';
import { substituteEntities, formatTimestamp } from './components/Preview/Markdown';
import { buildPayload, countComponents, dataToNode, totalTextLength, createNode, cloneWithNewKeys, mapTree, removeFromTree, insertIntoTree, type DropTarget } from './model/tree';
import {
  checkDrop,
  findNode,
  isAllowedChildType,
  isTopLevelLegal,
  validateTree,
} from './validation/rules';
import { isSectionNode } from './model/node';
import { parsePayloadJson } from './import/parse';
import { EXPORTERS } from './exporters';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const td = (content = 'x'): DiscordData => ({ type: CT.TextDisplay, content }) as DiscordData;
const btn = (customId = 'b1'): DiscordData =>
  ({ type: CT.Button, style: ButtonStyle.Primary, label: 'B', custom_id: customId }) as DiscordData;
const select = (): DiscordData =>
  ({ type: CT.StringSelect, custom_id: 's1', options: [{ label: 'a', value: 'a' }] }) as DiscordData;
const thumb = (): DiscordData =>
  ({ type: CT.Thumbnail, media: { url: 'https://x/t.png' } }) as DiscordData;
const gallery = (n = 1): DiscordData =>
  ({ type: CT.MediaGallery, items: Array.from({ length: n }, () => ({ media: { url: 'https://x/g.png' } })) }) as DiscordData;
const nd = (data: DiscordData) => dataToNode(structuredClone(data));
const root = (index: number): DropTarget => ({ parentKey: null, index, slot: 'child' });
const childOf = (parentKey: string, index: number): DropTarget => ({ parentKey, index, slot: 'child' });

/** Minimal *valid* instance of every component type (for import tables). */
const MIN: Record<number, unknown> = {
  [CT.Container]: { type: CT.Container, components: [] },
  [CT.Section]: { type: CT.Section, components: [td()], accessory: thumb() },
  [CT.TextDisplay]: td(),
  [CT.MediaGallery]: gallery(),
  [CT.File]: { type: CT.File, file: { url: 'attachment://f.pdf' } },
  [CT.Separator]: { type: CT.Separator, divider: true, spacing: SeparatorSpacing.Small },
  [CT.ActionRow]: { type: CT.ActionRow, components: [] },
  [CT.Button]: btn(),
  [CT.Thumbnail]: thumb(),
  [CT.StringSelect]: select(),
  [CT.UserSelect]: { type: CT.UserSelect, custom_id: 'u1' },
  [CT.RoleSelect]: { type: CT.RoleSelect, custom_id: 'r1' },
  [CT.MentionableSelect]: { type: CT.MentionableSelect, custom_id: 'm1' },
  [CT.ChannelSelect]: { type: CT.ChannelSelect, custom_id: 'c1' },
};
const ALL_TYPES = Object.values(CT).filter((v): v is CT => typeof v === 'number');

/** root: container{text}, rootText, section{text + thumbnail accessory}, row{b,b}, selectRow{select} */
function makeTree() {
  const container = nd({ type: CT.Container, components: [td('inner')] } as DiscordData);
  const rootText = nd(td('root'));
  const section = nd({ type: CT.Section, components: [td('s')], accessory: thumb() } as DiscordData);
  const row = nd({ type: CT.ActionRow, components: [btn(), btn(), btn(), btn(), btn()] } as DiscordData);
  const selectRow = nd({ type: CT.ActionRow, components: [select()] } as DiscordData);
  return { tree: [container, rootText, section, row, selectRow], container, rootText, section, row, selectRow };
}

// ---------------------------------------------------------------------------
// 1. The nesting law — one source of truth across schema, drop checks, import
// ---------------------------------------------------------------------------

describe('nesting law', () => {
  it.each(ALL_TYPES)('Container child type %s matches ALLOWED_CHILDREN', (t) => {
    const expected = ALLOWED_CHILDREN[CT.Container]!.includes(t);
    expect(isAllowedChildType(CT.Container, t)).toBe(expected);
    const r = parsePayloadJson(JSON.stringify({ flags: IS_COMPONENTS_V2, components: [{ type: CT.Container, components: [MIN[t]] }] }));
    expect(r.ok).toBe(expected);
  });

  it.each(ALL_TYPES)('ActionRow child type %s matches ALLOWED_CHILDREN', (t) => {
    const expected = ALLOWED_CHILDREN[CT.ActionRow]!.includes(t);
    expect(isAllowedChildType(CT.ActionRow, t)).toBe(expected);
    const r = parsePayloadJson(JSON.stringify({ flags: IS_COMPONENTS_V2, components: [{ type: CT.ActionRow, components: [MIN[t]] }] }));
    expect(r.ok).toBe(expected);
  });

  it.each(ALL_TYPES)('top-level type %s matches isTopLevelLegal', (t) => {
    const r = parsePayloadJson(JSON.stringify({ flags: IS_COMPONENTS_V2, components: [MIN[t]] }));
    expect(r.ok).toBe(isTopLevelLegal(t));
  });
});

// ---------------------------------------------------------------------------
// 2. checkDrop — drop-time rules
// ---------------------------------------------------------------------------

describe('checkDrop', () => {
  it.each([
    ['TextDisplay at root', CT.TextDisplay, root(0), true],
    ['Button at root', CT.Button, root(0), false],
    ['Thumbnail at root', CT.Thumbnail, root(0), false],
    ['TextDisplay into container', CT.TextDisplay, null, true], // parentKey filled below
    ['Button into container', CT.Button, null, false],
    ['Thumbnail into container', CT.Thumbnail, null, false],
  ])('%s', (_name, type, target, ok) => {
    const { tree, container } = makeTree();
    const t = target ?? childOf(container.key, 0);
    expect(checkDrop(tree, { type }, t).ok).toBe(ok);
  });

  it('root moves: nested Button rejected, nested TextDisplay and root reorder allowed', () => {
    const { tree, container, rootText, row } = makeTree();
    const innerText = container.children[0];
    const rowButton = row.children[0];
    expect(checkDrop(tree, { type: innerText.type, key: innerText.key }, root(0)).ok).toBe(true);
    expect(checkDrop(tree, { type: rowButton.type, key: rowButton.key }, root(0)).ok).toBe(false);
    expect(checkDrop(tree, { type: rootText.type, key: rootText.key }, root(0)).ok).toBe(true);
  });

  it.each([
    ['6th button into full row', 'row', 0, { type: CT.Button }, 'An Action Row holds at most 5 buttons.'],
    ['button into row with select', 'selectRow', 0, { type: CT.Button }, 'select menu can hold only that select'],
    ['select into row with buttons', 'row', 0, { type: CT.StringSelect }, 'select menu must be alone'],
    ['second select into row with select', 'selectRow', 0, { type: CT.StringSelect }, 'only one select menu'],
  ])('%s', (_name, parent, index, drag, reason) => {
    const { tree, row, selectRow } = makeTree();
    const result = checkDrop(tree, drag as { type: CT }, childOf(parent === 'row' ? row.key : selectRow.key, index));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(reason);
  });

  it('legal interactive drops: select into empty row, reorder of the row\'s select', () => {
    const { tree, selectRow } = makeTree();
    const emptyRow = nd({ type: CT.ActionRow, components: [] } as DiscordData);
    tree.push(emptyRow);
    expect(checkDrop(tree, { type: CT.StringSelect }, childOf(emptyRow.key, 0)).ok).toBe(true);
    const rowSelect = selectRow.children[0];
    expect(checkDrop(tree, { type: rowSelect.type, key: rowSelect.key }, childOf(selectRow.key, 0)).ok).toBe(true);
  });

  it('rejects a 4th Section text but allows the 3rd', () => {
    const section = nd({ type: CT.Section, components: [td(), td(), td()], accessory: thumb() } as DiscordData);
    const tree = [section];
    expect(checkDrop(tree, { type: CT.TextDisplay }, childOf(section.key, 0)).ok).toBe(false);
    const section2 = nd({ type: CT.Section, components: [td(), td()], accessory: thumb() } as DiscordData);
    expect(checkDrop([section2], { type: CT.TextDisplay }, childOf(section2.key, 0)).ok).toBe(true);
  });

  it('rejects cycles: a node cannot move into itself or its own subtree', () => {
    const { tree, container } = makeTree();
    expect(checkDrop(tree, { type: CT.Container, key: container.key }, childOf(container.key, 0)).ok).toBe(false);
    expect(checkDrop(tree, { type: CT.Container, key: container.key }, childOf(container.children[0].key, 0)).ok).toBe(false);
  });

  it('accessory slot: only Button/Thumbnail, one per Section', () => {
    const { tree, section, container } = makeTree();
    const slot = (key: string): DropTarget => ({ parentKey: key, index: -1, slot: 'accessory' });
    expect(checkDrop(tree, { type: CT.Thumbnail }, slot(section.key)).ok).toBe(false); // taken
    expect(checkDrop(tree, { type: CT.TextDisplay }, slot(section.key)).ok).toBe(false);
    expect(checkDrop(tree, { type: CT.Thumbnail }, slot(container.key)).ok).toBe(false);
    const bare = nd({ type: CT.Section, components: [td()] } as DiscordData);
    expect(checkDrop([bare], { type: CT.Thumbnail }, slot(bare.key)).ok).toBe(true);
  });

  it('40-cap: fresh add rejected, moves exempt', () => {
    const full = Array.from({ length: MAX_TOTAL_COMPONENTS }, () => nd(td()));
    expect(checkDrop(full, { type: CT.TextDisplay }, root(0)).ok).toBe(false);
    expect(checkDrop(full, { type: CT.TextDisplay, key: full[0].key }, root(3)).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. validateTree — banner issues
// ---------------------------------------------------------------------------

describe('validateTree', () => {
  const issuesFor = (tree: DiscordData[]) => validateTree(tree.map(nd)).map((i) => `${i.severity}: ${i.message}`);
  const has = (issues: string[], fragment: string) => issues.some((m) => m.includes(fragment));

  it('empty canvas is a warning', () => {
    expect(validateTree([])).toHaveLength(1);
    expect(validateTree([])[0].severity).toBe('warning');
  });

  it.each([
    [{ type: CT.Button, style: ButtonStyle.Primary } as DiscordData, 'needs a label or an emoji'],
    [{ type: CT.Button, style: ButtonStyle.Link, label: 'L' } as DiscordData, 'Link button needs a URL'],
    [{ type: CT.Button, style: ButtonStyle.Link, label: 'L', url: 'ftp://x' } as DiscordData, 'must start with http'],
    [{ type: CT.Button, style: ButtonStyle.Primary, label: 'L' } as DiscordData, 'custom_id'],
    [{ type: CT.StringSelect, custom_id: 's' } as DiscordData, 'at least one option'],
    [{ type: CT.ActionRow, components: [] } as DiscordData, 'Empty Action Row'],
    [{ type: CT.File, file: { url: 'https://x/f.pdf' } } as DiscordData, 'attachment://'],
  ])('flags %# → %s', (data, fragment) => {
    expect(has(issuesFor([data]), fragment)).toBe(true);
  });

  it('flags select menus without custom_id (types 5–8)', () => {
    for (const t of [CT.UserSelect, CT.RoleSelect, CT.MentionableSelect, CT.ChannelSelect]) {
      expect(has(issuesFor([{ type: t } as DiscordData]), 'Select menus need a custom_id')).toBe(true);
    }
  });

  it('counts: >40 components errors, 26 select options errors, 11 gallery items errors, >4000 chars errors', () => {
    const fortyOne = Array.from({ length: MAX_TOTAL_COMPONENTS + 1 }, () => td());
    expect(has(issuesFor(fortyOne), `ceiling is ${MAX_TOTAL_COMPONENTS}`)).toBe(true);
    expect(issuesFor(Array.from({ length: MAX_TOTAL_COMPONENTS }, () => td())).every((i) => !i.startsWith('error'))).toBe(true);

    const opts = Array.from({ length: SELECT_OPTIONS_CAP + 1 }, (_, i) => ({ label: `${i}`, value: `${i}` }));
    expect(has(issuesFor([{ type: CT.StringSelect, custom_id: 's', options: opts } as DiscordData]), `cap is ${SELECT_OPTIONS_CAP}`)).toBe(true);

    expect(has(issuesFor([gallery(11)]), 'at most 10 items')).toBe(true);
    expect(has(issuesFor([gallery(10)]), 'at most 10 items')).toBe(false);

    expect(has(issuesFor([{ type: CT.TextDisplay, content: 'a'.repeat(4001) } as DiscordData]), 'cap is 4000')).toBe(true);
  });

  it('flags Section arity and missing accessory', () => {
    expect(has(issuesFor([{ type: CT.Section, components: [] } as DiscordData]), 'needs 1–3 Text Displays')).toBe(true);
    expect(has(issuesFor([{ type: CT.Section, components: [td()] } as DiscordData]), 'needs an accessory')).toBe(true);
    const four = Array.from({ length: 4 }, () => td());
    expect(has(issuesFor([{ type: CT.Section, components: four, accessory: thumb() } as DiscordData]), 'at most 3')).toBe(true);
  });

  it('flags an Action Row with two selects', () => {
    const tree = [{ type: CT.ActionRow, components: [select(), select()] } as DiscordData];
    expect(has(issuesFor(tree), 'OR exactly one select menu')).toBe(true);
  });

  it('flags duplicate custom_id across interactive components', () => {
    const dupes = [{ type: CT.ActionRow, components: [btn('same'), btn('same')] } as DiscordData];
    expect(has(issuesFor(dupes), 'must be unique')).toBe(true);
    const distinct = [{ type: CT.ActionRow, components: [btn('a'), btn('b')] } as DiscordData];
    expect(has(issuesFor(distinct), 'must be unique')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Tree model — counts + byte-perfect roundtrip
// ---------------------------------------------------------------------------

describe('tree model', () => {
  it('countComponents counts accessory and children recursively', () => {
    expect(countComponents([])).toBe(0);
    expect(countComponents([nd(td())])).toBe(1);
    // section + its text + accessory = 3; container holding it + text = 5
    const section = { type: CT.Section, components: [td()], accessory: thumb() } as DiscordData;
    const container = { type: CT.Container, components: [section, td()] } as DiscordData;
    expect(countComponents([nd(container)])).toBe(5);
  });

  it('totalTextLength sums every Text Display', () => {
    const section = { type: CT.Section, components: [td('ab')], accessory: thumb() } as DiscordData;
    const container = { type: CT.Container, components: [section, td('cde')] } as DiscordData;
    expect(totalTextLength([nd(container)])).toBe(5);
  });

  it('buildPayload ∘ dataToNode is byte-perfect (key order preserved)', () => {
    const payload: DiscordData[] = [
      { type: CT.Container, components: [td('a'), { type: CT.Separator, divider: true, spacing: SeparatorSpacing.Small } as DiscordData], accent_color: 0xff00ff, spoiler: false } as DiscordData,
      { type: CT.Section, components: [td('b')], accessory: thumb() } as DiscordData,
      gallery(2),
      { type: CT.ActionRow, components: [btn('x'), select()] } as DiscordData,
    ];
    const nodes = payload.map((d) => dataToNode(structuredClone(d)));
    expect(JSON.stringify(buildPayload(nodes))).toBe(JSON.stringify(payload));
  });
});

// ---------------------------------------------------------------------------
// 5. Import — malformed input + real client dumps
// ---------------------------------------------------------------------------

describe('parsePayloadJson', () => {
  it('rejects malformed input with a clear error', () => {
    expect(parsePayloadJson('not json').errors[0].path).toBe('$');
    expect(parsePayloadJson('42').errors[0].message).toContain('Expected');
    expect(parsePayloadJson('{"flags": 32768}').errors[0].path).toBe('$');
    expect(parsePayloadJson('{"flags": 32768, "components": []}').errors[0].path).toBe('$.components');
    expect(parsePayloadJson('[{"type": 99}]').errors[0].message).toContain('type 99');
  });

  it('accepts a bare array with a warning and defaults flags', () => {
    const r = parsePayloadJson(JSON.stringify([td('hi')]));
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('bare component array'))).toBe(true);
  });

  it('warns when flags lack IS_COMPONENTS_V2', () => {
    const r = parsePayloadJson(JSON.stringify({ flags: 0, components: [td('hi')] }));
    expect(r.warnings.some((w) => w.includes('IS_COMPONENTS_V2'))).toBe(true);
  });

  it('normalizes Discord client dumps (customId, string ids, media metadata)', () => {
    // Shape matches real client-captured payloads (e.g. bot message dumps).
    const dump = {
      id: '0,0',
      type: CT.Container,
      spoiler: false,
      components: [
        { id: '0,0,0', type: CT.TextDisplay, content: 'hello' },
        {
          id: '0,0,1',
          type: CT.Section,
          components: [{ id: '0,0,1,0', type: CT.TextDisplay, content: 'side' }],
          accessory: { id: '0,0,1,1', type: CT.Thumbnail, media: { url: 'https://x/t.png', proxyUrl: 'https://p', height: 512, width: 512, contentType: 'image/png' } },
        },
        { id: '0,0,2', type: CT.MediaGallery, items: [{ media: { url: 'https://x/g.png', proxyUrl: 'https://p', loadingState: 2 } }] },
        { id: '0,0,3', type: CT.ActionRow, components: [{ id: '0,0,3,0', type: CT.Button, customId: 'abc123', style: 1, label: 'Go' }] },
      ],
    };
    const r = parsePayloadJson(JSON.stringify({ flags: IS_COMPONENTS_V2, components: [dump] }));
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('customId'))).toBe(true);
    const out = JSON.stringify(buildPayload(r.nodes));
    expect(out).toContain('"custom_id":"abc123"');
    expect(out).not.toContain('"customId"');
    expect(out).not.toContain('"proxyUrl"');
    expect(out).not.toContain('"id":"0,0"');
  });

  it('enforces Section arity/accessory and gallery caps', () => {
    const twoTexts = { type: CT.Section, components: [td(), td(), td(), td()], accessory: thumb() };
    expect(parsePayloadJson(JSON.stringify({ flags: IS_COMPONENTS_V2, components: [twoTexts] })).ok).toBe(false);
    const noAccessory = { type: CT.Section, components: [td()] };
    expect(parsePayloadJson(JSON.stringify({ flags: IS_COMPONENTS_V2, components: [noAccessory] })).ok).toBe(false);
    expect(parsePayloadJson(JSON.stringify({ flags: IS_COMPONENTS_V2, components: [gallery(11)] })).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Exporters — payload fidelity per target
// ---------------------------------------------------------------------------

describe('exporters', () => {
  const payload = buildPayload([
    nd({ type: CT.Container, components: [td('a')], accent_color: 0x5865f2, spoiler: true } as DiscordData),
    nd({ type: CT.Section, components: [td('s')], accessory: thumb() } as DiscordData),
    nd(gallery(2)),
    nd({ type: CT.ActionRow, components: [btn('x'), select()] } as DiscordData),
  ]);
  const ctx = { bot: { username: 'My Bot', avatarUrl: '' }, flags: IS_COMPONENTS_V2 };
  const byId = (id: string) => EXPORTERS.find((e) => e.id === id)!;

  it('registry holds all four targets', () => {
    expect(EXPORTERS.map((e) => e.id)).toEqual(['json', 'discordjs', 'discordpy', 'curl']);
  });

  it('JSON round-trips the payload with the V2 flag', () => {
    const parsed = JSON.parse(byId('json').generate(payload, ctx));
    expect(parsed.flags).toBe(IS_COMPONENTS_V2);
    expect(parsed.components).toEqual(JSON.parse(JSON.stringify(payload)));
  });

  it('discord.js output uses the real builder classes with the V2 flag', () => {
    const out = byId('discordjs').generate(payload, ctx);
    expect(out).toContain("require('discord.js')");
    expect(out).toContain('new ContainerBuilder()');
    expect(out).toContain('.setAccentColor(');
    expect(out).toContain('.setSpoiler(true)');
    expect(out).toContain('new TextDisplayBuilder()');
    expect(out).toContain('.setContent("a")');
    expect(out).toContain('new ThumbnailBuilder()');
    expect(out).toContain('.setURL("https://x/t.png")');
    expect(out).toContain('new MediaGalleryBuilder()');
    expect(out).toContain('new MediaGalleryItemBuilder()');
    expect(out).toContain('new ActionRowBuilder()');
    expect(out).toContain('new ButtonBuilder()');
    expect(out).toContain('ButtonStyle.Primary');
    expect(out).toContain('.setCustomId("x")');
    expect(out).toContain('new StringSelectMenuBuilder()');
    expect(out).toContain('.addOptions(');
    expect(out).toContain('flags: MessageFlags.IsComponentsV2');
    // No raw payload leakage: every component goes through a builder.
    expect(out).not.toMatch(/"type":\s*\d/);
    expect(byId('discordjs').generate(payload, { bot: { username: '', avatarUrl: '' }, flags: IS_COMPONENTS_V2 })).not.toContain('webhook.send');
  });

  it('discord.py output is runnable LayoutView code with no JSON-isms', () => {
    const out = byId('discordpy').generate(payload, ctx);
    expect(out).toContain('ui.LayoutView(timeout=None)');
    expect(out).toContain('ui.Container(');
    expect(out).toContain('accent_colour=');
    expect(out).toContain('spoiler=True');
    expect(out).toContain('ui.TextDisplay("a")');
    expect(out).toContain('ui.Section(');
    expect(out).toContain('accessory=ui.Thumbnail("https://x/t.png")');
    expect(out).toContain('ui.MediaGallery(');
    expect(out).toContain('discord.MediaGalleryItem(');
    expect(out).toContain('ui.ActionRow(');
    expect(out).toContain('ui.Button(');
    expect(out).toContain('discord.ButtonStyle.primary');
    expect(out).toContain('custom_id="x"');
    expect(out).toContain('ui.Select(');
    expect(out).toContain('options=[');
    expect(out).toContain('discord.SelectOption(label="a", value="a")');
    expect(out).toContain('await channel.send(view=build_view())');
    expect(out).not.toMatch(/: (true|false|null|undefined)\b/);
  });

  it('curl output escapes single quotes and carries with_components=true', () => {
    const quoted = buildPayload([nd(td("it's here"))]);
    const out = byId('curl').generate(quoted, ctx);
    expect(out).toContain('with_components=true');
    expect(out).toContain(`'\\''`);
    expect(out.startsWith('#')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Tree surgery — the mutation primitives behind every store operation
// ---------------------------------------------------------------------------

describe('tree surgery', () => {
  const fresh = () => {
    const section = nd({ type: CT.Section, components: [td('s')], accessory: thumb() } as DiscordData);
    return { tree: [nd({ type: CT.Container, components: [td('c')] } as DiscordData), section], section };
  };

  it('insertIntoTree places at root, child, and accessory slots; clamps indexes', () => {
    const { tree, section } = fresh();
    expect(insertIntoTree(tree, createNode(CT.Separator), { parentKey: null, index: 99, slot: 'child' })).toHaveLength(3);
    const nested = insertIntoTree(tree, createNode(CT.TextDisplay), { parentKey: section.key, index: 0, slot: 'child' });
    expect(findNode(nested, section.key)!.children).toHaveLength(2);
    const acc = insertIntoTree(tree, createNode(CT.Button), { parentKey: section.key, index: -1, slot: 'accessory' });
    const accSection = findNode(acc, section.key)!;
    expect(isSectionNode(accSection) ? accSection.accessory!.type : null).toBe(CT.Button);
  });

  it('removeFromTree removes from children and accessory slots, returning the node', () => {
    const { tree, section } = fresh();
    const innerKey = section.children[0].key;
    const { tree: t1, removed } = removeFromTree(tree, innerKey);
    expect(removed!.key).toBe(innerKey);
    expect(findNode(t1, innerKey)).toBeNull();
    const accKey = section.accessory!.key;
    const { tree: t2, removed: r2 } = removeFromTree(tree, accKey);
    expect(r2!.key).toBe(accKey);
    const s2 = findNode(t2, section.key)!;
    expect(isSectionNode(s2) ? s2.accessory : 'not a section').toBeNull();
  });

  it('mapTree replaces a node immutably; the original tree is untouched', () => {
    const { tree, section } = fresh();
    const before = JSON.stringify(tree);
    const key = section.children[0].key;
    const out = mapTree(tree, key, (n) => ({ ...n, data: { type: CT.TextDisplay, content: 'rewritten' } as DiscordData }));
    expect((findNode(out, key)!.data as { content: string }).content).toBe('rewritten');
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('cloneWithNewKeys deep-copies with fresh keys but identical payload', () => {
    const { section } = fresh();
    const copy = cloneWithNewKeys(section);
    expect(copy.key).not.toBe(section.key);
    expect(copy.children[0].key).not.toBe(section.children[0].key);
    expect(copy.accessory!.key).not.toBe(section.accessory!.key);
    expect(JSON.stringify(buildPayload([copy]))).toBe(JSON.stringify(buildPayload([section])));
  });

  it('mutation parity: remove then insert re-creates the exact original tree', () => {
    const { tree, section } = fresh();
    const accKey = section.accessory!.key;
    const { tree: without } = removeFromTree(tree, accKey);
    const restored = insertIntoTree(without, section.accessory!, { parentKey: section.key, index: -1, slot: 'accessory' });
    expect(JSON.stringify(restored)).toBe(JSON.stringify(tree));
  });
});

describe('Discord entity substitution (preview accuracy)', () => {
  // The sentinel destination is URI-encoded because react-markdown's default
  // URL transform percent-encodes `<`/`>`/`:` — the chip branch matches on
  // the transformed form.
  const enc = (s: string) => `![entity](discord-entity/${encodeURIComponent(s)})`;
  it.each([
    ['<@123456789012345678>'],
    ['<@!123456789012345678>'],
    ['<@&987654321098765432>'],
    ['<#555444333222111000>'],
    ['<t:1735689600>'],
    ['<t:1735689600:R>'],
    ['<t:1735689600:F>'],
    ['<a:spin:1539372187322949722>'],
  ])(
    'substitutes %j',
    (input) => {
      expect(substituteEntities(input)).toBe(enc(input));
    },
  );

  const fence = '```\n<@123456789012345678>\n```';
  it.each([
    ['plain **markdown** stays untouched', 'plain **markdown** stays untouched'],
    ['`<@123456789012345678>` stays literal in code', '`<@123456789012345678>` stays literal in code'],
    [fence, fence],
    ['no entities here', 'no entities here'],
  ])(
    'leaves code and plain text alone: %j',
    (input, expected) => {
      expect(substituteEntities(input)).toBe(expected);
    },
  );

  // 1735689600 is exactly 2025-01-01T00:00Z, so the rendered year depends on
  // the viewer's UTC offset — accept both sides of the boundary.
  it.each([
    [1735689600, 'f', /202[45]/],
    [1735689600, 'R', /ago|in /i],
    [1735689600, 't', /:/],
  ])(
    'formats timestamp epoch=%s style=%s',
    (epoch, style, pattern) => {
      expect(formatTimestamp(epoch, style)).toMatch(pattern);
    },
  );

  it('rejects malformed pseudo-entities', () => {
    expect(substituteEntities('<t:notanumber>')).toBe('<t:notanumber>');
    expect(substituteEntities('<@123>')).toBe('<@123>');
  });
});
