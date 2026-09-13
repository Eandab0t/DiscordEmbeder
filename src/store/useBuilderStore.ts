import { create } from 'zustand';
import {
  ComponentType,
  MAX_TOTAL_COMPONENTS,
  type TopLevelComponent,
} from '../model/discord-components-v2-schema';
import type { ComponentNode, DiscordData, ProjectSession } from '../model/node';
import { isSectionNode } from '../model/node';
import { createDefaultData } from '../model/defaults';
import { nextKey, dataToNode, buildPayload, countComponents } from '../model/tree';
import { checkDrop, findNode, findParentOf, type DropTarget } from '../validation/rules';

export interface OperationResult {
  ok: boolean;
  reason?: string;
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
  bot: { username: string; avatarUrl: string };
  webhookUrl: string;
  past: Snapshot[];
  future: Snapshot[];
  lastSavedAt: number | null;

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
  loadSession: (session: ProjectSession) => void;
  loadPayload: (components: TopLevelComponent[], name?: string) => void;
  getSession: () => ProjectSession;
  markSaved: () => void;

  // History
  undo: () => void;
  redo: () => void;
}

// ---------------------------------------------------------------------------
// Immutable tree surgery helpers
// ---------------------------------------------------------------------------

function mapTree(
  list: ComponentNode[],
  key: string,
  fn: (n: ComponentNode) => ComponentNode,
): ComponentNode[] {
  return list.map((n) => {
    if (n.key === key) return fn(n);
    if (isSectionNode(n)) {
      const children = mapTree(n.children, key, fn);
      const accessory = n.accessory ? (mapTree([n.accessory], key, fn)[0] ?? n.accessory) : null;
      return { ...n, children, accessory };
    }
    return { ...n, children: mapTree(n.children, key, fn) };
  });
}

function removeFromTree(
  list: ComponentNode[],
  key: string,
): { tree: ComponentNode[]; removed: ComponentNode | null } {
  let removed: ComponentNode | null = null;
  const walk = (nodes: ComponentNode[]): ComponentNode[] => {
    const out: ComponentNode[] = [];
    for (const n of nodes) {
      if (n.key === key) {
        removed = n;
        continue;
      }
      if (isSectionNode(n)) {
        const children = walk(n.children);
        let accessory = n.accessory;
        if (accessory && accessory.key === key) {
          removed = accessory;
          accessory = null;
        }
        out.push({ ...n, children, accessory });
      } else {
        out.push({ ...n, children: walk(n.children) });
      }
    }
    return out;
  };
  return { tree: walk(list), removed };
}

function insertIntoTree(tree: ComponentNode[], node: ComponentNode, target: DropTarget): ComponentNode[] {
  const clamp = (i: number, len: number) => Math.max(0, Math.min(i, len));
  if (target.parentKey === null) {
    const out = [...tree];
    out.splice(clamp(target.index, out.length), 0, node);
    return out;
  }
  const walk = (nodes: ComponentNode[]): ComponentNode[] =>
    nodes.map((n) => {
      if (n.key === target.parentKey) {
        if (target.slot === 'accessory') {
          if (isSectionNode(n)) return { ...n, accessory: node };
          return n;
        }
        const children = [...n.children];
        children.splice(clamp(target.index, children.length), 0, node);
        return { ...n, children };
      }
      if (isSectionNode(n)) {
        const children = walk(n.children);
        const accessory = n.accessory ? (walk([n.accessory])[0] ?? n.accessory) : null;
        return { ...n, children, accessory };
      }
      return { ...n, children: walk(n.children) };
    });
  return walk(tree);
}

function cloneWithNewKeys(node: ComponentNode): ComponentNode {
  const data: DiscordData = JSON.parse(JSON.stringify(node.data)) as DiscordData;
  if (isSectionNode(node)) {
    return {
      ...node,
      key: nextKey(),
      data,
      children: node.children.map(cloneWithNewKeys),
      accessory: node.accessory ? cloneWithNewKeys(node.accessory) : null,
    };
  }
  return { ...node, key: nextKey(), data, children: node.children.map(cloneWithNewKeys) };
}

function createNode(type: ComponentType): ComponentNode {
  if (type === ComponentType.Section) {
    return { key: nextKey(), type, data: createDefaultData(type), children: [], accessory: null };
  }
  return { key: nextKey(), type, data: createDefaultData(type), children: [] };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 100;

export const useBuilderStore = create<BuilderState>()((set, get) => {
  const withHistory = (state: BuilderState): Partial<BuilderState> => ({
    past: [...state.past, { tree: state.tree, selectedKey: state.selectedKey }].slice(-HISTORY_LIMIT),
    future: [],
  });

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

    select: (key) => set({ selectedKey: key }),

    addComponent: (type, target) => {
      const state = get();
      const check = checkDrop(state.tree, { type }, target);
      if (!check.ok) return check;
      const node = createNode(type);
      set({
        ...withHistory(state),
        tree: insertIntoTree(state.tree, node, target),
        selectedKey: node.key,
      });
      return { ok: true };
    },

    moveNode: (key, target) => {
      const state = get();
      const node = findNode(state.tree, key);
      if (!node) return { ok: false, reason: 'Component no longer exists.' };
      const check = checkDrop(state.tree, { type: node.type, key }, target);
      if (!check.ok) return check;
      const { tree: without, removed } = removeFromTree(state.tree, key);
      if (!removed) return { ok: false, reason: 'Component no longer exists.' };
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
          const data: DiscordData = JSON.parse(JSON.stringify(n.data)) as DiscordData;
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
      if (!check.ok) return;
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
        return {
          ok: false,
          reason: `Template needs ${incoming} slots but only ${MAX_TOTAL_COMPONENTS - countComponents(state.tree)} remain.`,
        };
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

    loadSession: (session) => {
      const state = get();
      const tree = session.tree.map((n) => dataToNode(JSON.parse(JSON.stringify(n)) as DiscordData));
      set({
        ...withHistory(state),
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

    markSaved: () => set({ lastSavedAt: Date.now() }),

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
    useBuilderStore.getState().markSaved();
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

export function clearLocalStorageSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
