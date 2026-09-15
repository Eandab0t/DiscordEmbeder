import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ComponentType as CT } from './model/discord-components-v2-schema';
import { buildPayload, countComponents } from './model/tree';

/**
 * Drives the real store through its public actions — the same entry points
 * every UI event uses — proving the mutation flow end-to-end. Fresh module
 * registry per test for isolation (mode boot reads localStorage, which
 * node lacks; the store falls back to 'simple').
 */
const load = async () => {
  vi.resetModules();
  const { useBuilderStore } = await import('./store/useBuilderStore');
  const s = useBuilderStore.getState();
  s.addComponent(CT.Container, { parentKey: null, index: 0, slot: 'child' });
  return useBuilderStore;
};

describe('store mutation flow (real actions)', () => {
  it('addComponent → remove → undo restores tree and selection', async () => {
    const store = await load();
    let s = store.getState();
    const ok = s.addComponent(CT.Separator, { parentKey: s.tree[0].key, index: 0, slot: 'child' });
    expect(ok.ok).toBe(true);
    s = store.getState();
    expect(countComponents(s.tree)).toBe(2);
    expect(s.selectedKey).not.toBeNull();

    s.removeNode(s.selectedKey!);
    s = store.getState();
    expect(countComponents(s.tree)).toBe(1);
    expect(s.selectedKey).toBeNull();

    s.undo();
    s = store.getState();
    expect(countComponents(s.tree)).toBe(2);
    expect(s.selectedKey).not.toBeNull();
  });

  it('moveNode enforces root legality through checkDrop (Button stays in its row)', async () => {
    const store = await load();
    let s = store.getState();
    const row = s.addComponent(CT.ActionRow, { parentKey: s.tree[0].key, index: 0, slot: 'child' });
    expect(row.ok).toBe(true);
    s = store.getState();
    const rowNode = s.tree[0].children.find((c) => c.data.type === CT.ActionRow)!;
    const btn = s.addComponent(CT.Button, { parentKey: rowNode.key, index: 0, slot: 'child' });
    expect(btn.ok).toBe(true);
    s = store.getState();
    const btnNode = s.tree[0].children.find((c) => c.data.type === CT.ActionRow)!.children[0];

    const moved = s.moveNode(btnNode.key, { parentKey: null, index: s.tree.length, slot: 'child' });
    expect(moved.ok).toBe(false);
    expect(store.getState().tree).toEqual(s.tree);
  });

  it('updateData rewrites a node and the exported payload', async () => {
    const store = await load();
    let s = store.getState();
    s.addComponent(CT.TextDisplay, { parentKey: null, index: s.tree.length, slot: 'child' });
    s = store.getState();
    const textNode = s.tree[s.tree.length - 1];
    s.updateData(textNode.key, (d) => {
      if (d.type === CT.TextDisplay) d.content = 'rewritten **bold**';
    });
    s = store.getState();
    const payload = buildPayload(s.tree);
    const last = payload[payload.length - 1] as { content: string };
    expect(last.content).toBe('rewritten **bold**');
  });

  it('undo/redo chains preserve counts', async () => {
    const store = await load();
    let s = store.getState();
    s.addComponent(CT.Separator, { parentKey: null, index: s.tree.length, slot: 'child' });
    s = store.getState();
    s.addComponent(CT.TextDisplay, { parentKey: null, index: s.tree.length, slot: 'child' });
    s = store.getState();
    expect(countComponents(s.tree)).toBe(3);
    s.undo();
    s = store.getState();
    expect(countComponents(s.tree)).toBe(2);
    s.redo();
    s = store.getState();
    expect(countComponents(s.tree)).toBe(3);
  });

  it('duplicateNode inserts a payload-identical copy with fresh keys', async () => {
    const store = await load();
    let s = store.getState();
    s.addComponent(CT.TextDisplay, { parentKey: null, index: s.tree.length, slot: 'child' });
    s = store.getState();
    const original = s.tree[s.tree.length - 1];
    s.duplicateNode(original.key);
    s = store.getState();
    expect(countComponents(s.tree)).toBe(3);
    const copy = s.tree[s.tree.length - 1];
    expect(copy.key).not.toBe(original.key);
    expect(JSON.stringify(buildPayload([copy]))).toBe(JSON.stringify(buildPayload([original])));
  });
});

describe('custom templates', () => {
  // Node has no localStorage; a Map-backed stub exercises the real
  // persist/load paths the browser would hit.
  const backing = new Map<string, string>();
  beforeAll(() => {
    globalThis.localStorage ??= {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: (i: number) => [...backing.keys()][i] ?? null,
      get length() {
        return backing.size;
      },
    } as Storage;
    backing.clear();
  });

  it('saveTemplate captures the payload; insert path accepts it; delete removes it; all persisted', async () => {
    const store = await load();
    let s = store.getState();
    s.addComponent(CT.TextDisplay, { parentKey: null, index: s.tree.length, slot: 'child' });
    s = store.getState();
    s.updateData(s.tree[s.tree.length - 1].key, (d) => {
      if (d.type === CT.TextDisplay) d.content = 'saved layout';
    });
    s.saveTemplate('weekly news');
    s = store.getState();
    expect(s.customTemplates).toHaveLength(1);
    const t = s.customTemplates[0];
    expect(t.name).toBe('weekly news');
    expect(JSON.stringify(t.components)).toBe(JSON.stringify(buildPayload(s.tree)));

    // Fresh module registry — the persisted list must survive a reload.
    vi.resetModules();
    const { useBuilderStore: fresh } = await import('./store/useBuilderStore');
    expect(fresh.getState().customTemplates).toHaveLength(1);

    // The insert path (addTemplate, what the modal's Insert calls) accepts it.
    expect(fresh.getState().addTemplate(t.components).ok).toBe(true);

    fresh.getState().deleteTemplate(t.id);
    vi.resetModules();
    const { useBuilderStore: fresh2 } = await import('./store/useBuilderStore');
    expect(fresh2.getState().customTemplates).toHaveLength(0);
  });
});
