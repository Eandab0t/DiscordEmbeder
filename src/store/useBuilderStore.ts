import { create } from 'zustand';
import {
  ComponentType,
  MAX_TOTAL_COMPONENTS,
  type TopLevelComponent,
} from '../model/discord-components-v2-schema';
import type { ComponentNode, DiscordData, ProjectSession } from '../model/node';
import { isSectionNode } from '../model/node';
import { createDefaultData } from '../model/defaults';
import { dataToNode, buildPayload, countComponents, createNode, cloneWithNewKeys, mapTree, removeFromTree, insertIntoTree, type DropTarget } from '../model/tree';
import { checkDrop, findNode, findParentOf, isTopLevelLegal, sectionHasAccessory } from '../validation/rules';

export interface OperationResult {
  ok: boolean;
  reason?: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  createdAt: string;
  components: TopLevelComponent[];
}

interface Snapshot {
  tree: ComponentNode[];
  selectedKey: string | null;
}

export interface BuilderState {
  tree: ComponentNode[];
  selectedKey: string | null;
  projectName: string;
  createdAt: string;
  bot: { username: string; avatarUrl: string };  webhookUrl: string;
  past: Snapshot[];
  future: Snapshot[];
  lastSavedAt: number | null;
  /** Last rejected mutation (cap, nesting, …) — App surfaces it as a toast.
   *  Object identity changes per rejection so the toast effect re-fires. */
  lastRejected: { reason: string; at: number } | null;

  // Selection
  select: (key: string | null) => void;

  // Tree mutations
  addComponent: (type: ComponentType, target: DropTarget) => OperationResult;
  moveNode: (key: string, target: DropTarget) => OperationResult;
  updateData: (key: string, updater: (data: DiscordData) => void) => void;
  removeNode: (key: string) => void;
  duplicateNode: (key: string) => void;
  addTemplate: (components: TopLevelComponent[]) => OperationResult;

  // Project
  setProjectName: (name: string) => void;
  setBot: (patch: Partial<BuilderState['bot']>) => void;
  setWebhookUrl: (url: string) => void;
  newProject: () => void;
  /** `recordHistory: false` is for non-action restores (autosave on boot) —
   *  they must not create phantom undo steps. */
  loadSession: (session: ProjectSession, opts?: { recordHistory?: boolean }) => void;
  loadPayload: (components: TopLevelComponent[], name?: string) => void;
  getSession: () => ProjectSession;

  // History
  undo: () => void;
  redo: () => void;

  /** 'simple' shows the common blocks; 'advanced' shows everything. */
  mode: 'simple' | 'advanced';
  setMode: (mode: 'simple' | 'advanced') => void;

  /** User-captured layouts, persisted to localStorage. */
  customTemplates: SavedTemplate[];
  saveTemplate: (name: string) => void;
  deleteTemplate: (id: string) => void;
  /** Click-to-add: appends the block wherever it legally fits, wrapping in
   *  a parent (Action Row / Section) when the type needs one. */
  addSmart: (type: ComponentType) => OperationResult;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 100;
const CUSTOM_TEMPLATES_KEY = 'discord-embeder:custom-templates:v1';

function loadCustomTemplates(): SavedTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as SavedTemplate[]) : [];
  } catch {
    return [];
  }
}

function persistCustomTemplates(templates: SavedTemplate[]): void {
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // Storage full or unavailable — template persistence is best-effort.
  }
}

export const useBuilderStore = create<BuilderState>()((set, get) => {
  const withHistory = (state: BuilderState): Partial<BuilderState> => ({
    past: [...state.past, { tree: state.tree, selectedKey: state.selectedKey }].slice(-HISTORY_LIMIT),
    future: [],
  });

  /** Record a rejected mutation so the UI can tell the user why nothing happened. */
  function reject(reason: string): OperationResult {
    set({ lastRejected: { reason, at: Date.now() } });
    return { ok: false, reason };
  }

  /** Shared body of addComponent/addSmart: check, then insert, optionally post-processing the built tree. */
  function addComponentOp(
    get: () => BuilderState,
    set: (partial: Partial<BuilderState>) => void,
    type: ComponentType,
    target: DropTarget,
    post?: (state: BuilderState) => { tree: ComponentNode[]; selectedKey: string | null } | null,
  ): OperationResult {
    const state = get();
    const check = checkDrop(state.tree, { type }, target);
    if (!check.ok) {
      reject(check.reason ?? 'Discord does not allow this placement.');
      return check;
    }
    const node = createNode(type);
    let tree = insertIntoTree(state.tree, node, target);
    let selectedKey: string | null = node.key;
    if (post) {
      // Hand the post hook the intermediate tree (with the just-built node),
      // not get() — the store hasn't been updated yet.
      const next = post({ ...state, tree, selectedKey: node.key });
      if (next) {
        tree = next.tree;
        selectedKey = next.selectedKey;
      }
    }
    set({ ...withHistory(state), tree, selectedKey });
    return { ok: true };
  }

  /** Last node matching `pred`, searched depth-first. */
  function findLatest(tree: ComponentNode[], pred: (n: ComponentNode) => boolean): ComponentNode | undefined {
    let found: ComponentNode | undefined;
    const walk = (list: readonly ComponentNode[]) => {
      for (const n of list) {
        if (pred(n)) found = n;
        walk(n.children);
      }
    };
    walk(tree);
    return found;
  }

  /** Does this Action Row have room for one more of `type`? */
  function rowHasRoom(row: ComponentNode, type: ComponentType): boolean {
    if (row.children.length >= 5) return false;
    if (type === ComponentType.Button) {
      return row.children.every((c) => c.data.type === ComponentType.Button);
    }
    return row.children.length === 0;
  }

  /** Keep the current selection if it still exists in `tree`; else fall back to `fallback`. */
  const resolveSelection = (
    tree: ComponentNode[],
    current: string | null,
    fallback: string | null,
  ): string | null => {
    if (current && findNode(tree, current)) return current;
    if (fallback && findNode(tree, fallback)) return fallback;
    return null;
  };

  return {
    tree: [],
    selectedKey: null,
    projectName: 'Untitled message',
    createdAt: new Date().toISOString(),
    bot: { username: 'Ean da b0t', avatarUrl: '' },
    webhookUrl: '',
    past: [],
    future: [],
    lastSavedAt: null,
    lastRejected: null,

    customTemplates: loadCustomTemplates(),
    saveTemplate: (name) => {
      const state = get();
      const template: SavedTemplate = {
        id: `t${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
        components: buildPayload(state.tree),
      };
      const next = [template, ...state.customTemplates];
      set({ customTemplates: next });
      persistCustomTemplates(next);
    },
    deleteTemplate: (id) => {
      const next = get().customTemplates.filter((t) => t.id !== id);
      set({ customTemplates: next });
      persistCustomTemplates(next);
    },

    mode: (() => {
      try {
        return localStorage.getItem('discord-embeder:mode') === 'advanced' ? 'advanced' : 'simple';
      } catch {
        return 'simple' as const;
      }
    })(),
    setMode: (mode) => {
      set({ mode });
      try {
        localStorage.setItem('discord-embeder:mode', mode);
      } catch {
        /* best-effort */
      }
    },

    select: (key) => set({ selectedKey: key }),

    addComponent: (type, target) => addComponentOp(get, set, type, target),

    moveNode: (key, target) => {
      const state = get();
      const node = findNode(state.tree, key);
      if (!node) return reject('Component no longer exists.');
      const check = checkDrop(state.tree, { type: node.type, key }, target);
      if (!check.ok) {
        reject(check.reason ?? 'Discord does not allow this placement.');
        return check;
      }
      const { tree: without, removed } = removeFromTree(state.tree, key);
      if (!removed) return reject('Component no longer exists.');
      set({
        ...withHistory(state),
        tree: insertIntoTree(without, removed, target),
        selectedKey: key,
      });
      return { ok: true };
    },

    updateData: (key, updater) => {
      const state = get();
      set({
        ...withHistory(state),
        tree: mapTree(state.tree, key, (n) => {
          const data: DiscordData = structuredClone(n.data) as DiscordData;
          updater(data);
          return { ...n, data };
        }),
      });
    },

    removeNode: (key) => {
      const state = get();
      const { tree } = removeFromTree(state.tree, key);
      const stillThere = state.selectedKey ? findNode(tree, state.selectedKey) !== null : true;
      set({
        ...withHistory(state),
        tree,
        selectedKey: stillThere ? state.selectedKey : null,
      });
    },

    duplicateNode: (key) => {
      const state = get();
      const node = findNode(state.tree, key);
      if (!node) return;
      const parent = findParentOf(state.tree, key);
      const isAccessory = parent !== null && isSectionNode(parent) && parent.accessory?.key === key;
      // Duplicating an accessory duplicates the whole Section (slot is single).
      const source: ComponentNode = isAccessory && parent ? (parent as ComponentNode) : node;
      const clone = cloneWithNewKeys(source);
      const sourceParent = isAccessory && parent ? findParentOf(state.tree, parent.key) : parent;
      const siblings: readonly ComponentNode[] = sourceParent ? sourceParent.children : state.tree;
      const index = siblings.findIndex((c) => c.key === source.key);
      const target: DropTarget = {
        parentKey: sourceParent ? sourceParent.key : null,
        index: index + 1,
        slot: 'child',
      };
      const check = checkDrop(state.tree, { type: clone.type }, target);
      if (!check.ok) {
        reject(check.reason ?? 'Discord does not allow this placement.');
        return;
      }
      set({
        ...withHistory(state),
        tree: insertIntoTree(state.tree, clone, target),
        selectedKey: clone.key,
      });
    },

    addTemplate: (components) => {
      const state = get();
      const nodes = components.map((c) => dataToNode(JSON.parse(JSON.stringify(c)) as DiscordData));
      const incoming = countComponents(nodes);
      if (countComponents(state.tree) + incoming > MAX_TOTAL_COMPONENTS) {
        return reject(
          `Template needs ${incoming} slots but only ${MAX_TOTAL_COMPONENTS - countComponents(state.tree)} remain.`,
        );
      }
      set({
        ...withHistory(state),
        tree: [...state.tree, ...nodes],
        selectedKey: nodes[0]?.key ?? null,
      });
      return { ok: true };
    },

    setProjectName: (name) => set({ projectName: name }),
    setBot: (patch) => set((s) => ({ bot: { ...s.bot, ...patch } })),
    setWebhookUrl: (url) => set({ webhookUrl: url }),

    newProject: () =>
      set({
        ...withHistory(get()),
        tree: [],
        selectedKey: null,
        projectName: 'Untitled message',
        createdAt: new Date().toISOString(),
      }),

    loadSession: (session, opts) => {
      const state = get();
      const tree = session.tree.map((n) => dataToNode(JSON.parse(JSON.stringify(n)) as DiscordData));
      set({
        ...(opts?.recordHistory === false ? {} : withHistory(state)),
        tree,
        selectedKey: null,
        projectName: session.metadata?.name ?? 'Imported project',
        createdAt: session.metadata?.createdAt ?? new Date().toISOString(),
        bot: session.bot ?? { username: 'Ean da b0t', avatarUrl: '' },
      });
    },

    loadPayload: (components, name) => {
      const state = get();
      const tree = components.map((c) => dataToNode(JSON.parse(JSON.stringify(c)) as DiscordData));
      set({
        ...withHistory(state),
        tree,
        selectedKey: null,
        projectName: name ?? state.projectName,
      });
    },

    getSession: (): ProjectSession => {
      const state = get();
      return {
        version: 1,
        metadata: {
          name: state.projectName,
          createdAt: state.createdAt,
          updatedAt: new Date().toISOString(),
        },
        bot: state.bot,
        tree: JSON.parse(JSON.stringify(buildPayload(state.tree))) as ProjectSession['tree'],
      };
    },

    addSmart: (type) => {
      const state = get();
      // 1) A type that can't live at the top level needs a wrapper first.
      if (!isTopLevelLegal(type)) {
        if (type === ComponentType.Thumbnail) {
          const section = findLatest(state.tree, (n) => isSectionNode(n) && !sectionHasAccessory(n));
          if (section) return addComponentOp(get, set, type, { parentKey: section.key, index: 0, slot: 'accessory' });
          // No section without an accessory: build one (with its first text) and drop the thumbnail in.
          return addComponentOp(get, set, ComponentType.Section, { parentKey: null, index: state.tree.length, slot: 'child' }, (mid) => {
            const newSection = mid.tree[mid.tree.length - 1];
            if (!isSectionNode(newSection)) return null;
            const text = createNode(ComponentType.TextDisplay);
            let tree = insertIntoTree(mid.tree, text, { parentKey: newSection.key, index: 0, slot: 'child' });
            const thumb = createNode(type);
            tree = insertIntoTree(tree, thumb, { parentKey: newSection.key, index: 0, slot: 'accessory' });
            return { tree, selectedKey: thumb.key };
          });
        }
        const container = findLatest(state.tree, (n) => n.data.type === ComponentType.Container);
        let row: ComponentNode | undefined;
        if (type === ComponentType.Button || (type >= ComponentType.StringSelect && type <= ComponentType.ChannelSelect)) {
          // Prefer the latest row with room — a top-level row beats creating another row.
          row = findLatest(state.tree, (n) => n.data.type === ComponentType.ActionRow && rowHasRoom(n, type));
        }
        if (row) return addComponentOp(get, set, type, { parentKey: row.key, index: row.children.length, slot: 'child' });
        // No room anywhere: create an Action Row (inside the last container, else top level) and put the block in it.
        const rowTarget: DropTarget = container
          ? { parentKey: container.key, index: container.children.length, slot: 'child' }
          : { parentKey: null, index: state.tree.length, slot: 'child' };
        return addComponentOp(get, set, ComponentType.ActionRow, rowTarget, (mid) => {
          const builtRow = mid.tree[mid.tree.length - 1];
          if (builtRow.data.type !== ComponentType.ActionRow) return null;
          const child = createNode(type);
          return { tree: insertIntoTree(mid.tree, child, { parentKey: builtRow.key, index: 0, slot: 'child' }), selectedKey: child.key };
        });
      }
      // 2) Top-level-legal type: try to nest it into the selection first, else append at root.
      const sel = state.selectedKey ? findNode(state.tree, state.selectedKey) : undefined;
      if (sel) {
        if (sel.data.type === ComponentType.Section && type === ComponentType.TextDisplay && sel.children.length < 3) {
          return addComponentOp(get, set, type, { parentKey: sel.key, index: sel.children.length, slot: 'child' });
        }
        if (
          sel.data.type === ComponentType.ActionRow &&
          (type === ComponentType.Button ||
            (type >= ComponentType.StringSelect && type <= ComponentType.ChannelSelect)) &&
          rowHasRoom(sel, type)
        ) {
          return addComponentOp(get, set, type, { parentKey: sel.key, index: sel.children.length, slot: 'child' });
        }
        if (sel.data.type === ComponentType.Container) {
          const t: DropTarget =
            type === ComponentType.Section || type === ComponentType.MediaGallery
              ? { parentKey: null, index: state.tree.length, slot: 'child' }
              : { parentKey: sel.key, index: sel.children.length, slot: 'child' };
          if (checkDrop(state.tree, { type }, t).ok) return addComponentOp(get, set, type, t);
        }
      }
      return addComponentOp(get, set, type, { parentKey: null, index: state.tree.length, slot: 'child' });
    },

    undo: () => {
      const state = get();
      const prev = state.past[state.past.length - 1];
      if (!prev) return;
      set({
        tree: prev.tree,
        past: state.past.slice(0, -1),
        future: [{ tree: state.tree, selectedKey: state.selectedKey }, ...state.future].slice(
          0,
          HISTORY_LIMIT,
        ),
        selectedKey: resolveSelection(prev.tree, state.selectedKey, prev.selectedKey),
      });
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({
        tree: next.tree,
        past: [...state.past, { tree: state.tree, selectedKey: state.selectedKey }].slice(
          -HISTORY_LIMIT,
        ),
        future: state.future.slice(1),
        selectedKey: resolveSelection(next.tree, state.selectedKey, next.selectedKey),
      });
    },
  };
});

// ---------------------------------------------------------------------------
// localStorage autosave
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'discord-embeder:autosave:v1';

export function saveSessionToLocalStorage(): void {
  try {
    const session = useBuilderStore.getState().getSession();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    useBuilderStore.setState({ lastSavedAt: Date.now() });
  } catch {
    // Storage full or unavailable — autosave is best-effort.
  }
}

export function loadSessionFromLocalStorage(): ProjectSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectSession;
  } catch {
    return null;
  }
}
