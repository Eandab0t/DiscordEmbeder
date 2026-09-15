import {
  ComponentType,
  type ContainerChild,
  type SectionComponent,
  type TopLevelComponent,
} from './discord-components-v2-schema';
import { isSectionNode, type ComponentNode, type DiscordData } from './node';
import { createDefaultData } from './defaults';

let counter = 0;
export function nextKey(): string {
  counter += 1;
  return `n${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Schema component shapes → editor node (adds key + children arrays). */
export function dataToNode(data: DiscordData, key: string = nextKey()): ComponentNode {
  const node: ComponentNode = { key, type: data.type, data, children: [] };
  if (data.type === ComponentType.Container) {
    node.children = data.components.map((c) => dataToNode(c as DiscordData));
  } else if (data.type === ComponentType.Section) {
    node.children = data.components.map((c) => dataToNode(c));
    const section = node as typeof node & { accessory: ComponentNode | null };
    section.accessory = data.accessory ? dataToNode(data.accessory as DiscordData) : null;
  } else if (data.type === ComponentType.ActionRow) {
    node.children = data.components.map((c) => dataToNode(c as DiscordData));
  }
  return node;
}

/** Editor node → schema shape, ready for JSON.stringify. */
function nodeToData(node: ComponentNode): DiscordData {
  const d = node.data as DiscordData & Record<string, unknown>;
  if (node.type === ComponentType.Container) {
    d.components = node.children.map(nodeToData) as ContainerChild[];
  } else if (isSectionNode(node)) {
    d.components = node.children.map(nodeToData) as SectionComponent['components'];
    d.accessory = node.accessory ? nodeToData(node.accessory) : undefined;
  } else if (node.type === ComponentType.ActionRow) {
    d.components = node.children.map(nodeToData) as ContainerChild[];
  }
  return d;
}

/** Total component count, recursive — matched against MAX_TOTAL_COMPONENTS. */
export function countComponents(nodes: ComponentNode[]): number {
  let n = 0;
  const walk = (list: ComponentNode[]) => {
    for (const node of list) {
      n += 1;
      if (isSectionNode(node) && node.accessory) n += 1;
      walk(node.children);
    }
  };
  walk(nodes);
  return n;
}

/** Total characters across all Text Display contents (cap is 4000). */
export function totalTextLength(nodes: ComponentNode[]): number {
  let n = 0;
  const walk = (list: ComponentNode[]) => {
    for (const node of list) {
      if (isSectionNode(node) && node.accessory) walk([node.accessory]);
      walk(node.children);
      if (node.data.type === ComponentType.TextDisplay) {
        n += node.data.content.length;
      }
    }
  };
  walk(nodes);
  return n;
}

/** Serialize the whole tree into the exact ComponentsV2Message payload components array. */
export function buildPayload(nodes: ComponentNode[]): TopLevelComponent[] {
  return nodes.map((n) => nodeToData(n) as TopLevelComponent);
}

// ---------------------------------------------------------------------------
// Immutable tree surgery — every mutation flows through these
// ---------------------------------------------------------------------------

export interface DropTarget {
  /** Parent node key, or null for the root list. */
  parentKey: string | null;
  /** Insert index among the parent's children (accessory slot uses index -1). */
  index: number;
  /** 'child' = normal children slot; 'accessory' = the single accessory slot of a Section. */
  slot: 'child' | 'accessory';
}

/** Fresh editor node with schema-default data. */
export function createNode(type: ComponentType): ComponentNode {
  if (type === ComponentType.Section) {
    return { key: nextKey(), type, data: createDefaultData(type), children: [], accessory: null };
  }
  return { key: nextKey(), type, data: createDefaultData(type), children: [] };
}

/** Deep copy with fresh keys — safe to insert alongside the original. */
export function cloneWithNewKeys(node: ComponentNode): ComponentNode {
  const data: DiscordData = structuredClone(node.data) as DiscordData;
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

/** Immutably replace the node with `key` using `fn` (returns the same list shape otherwise). */
export function mapTree(
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

/** Remove the node with `key` from anywhere in the tree (including accessory slots). */
export function removeFromTree(
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

/** Immutably insert `node` at `target` (root list, child slot, or Section accessory slot). */
export function insertIntoTree(tree: ComponentNode[], node: ComponentNode, target: DropTarget): ComponentNode[] {
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
