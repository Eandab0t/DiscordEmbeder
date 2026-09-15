import {
  ComponentType,
  type ContainerChild,
  type SectionComponent,
  type TopLevelComponent,
} from './discord-components-v2-schema';
import { isSectionNode, type ComponentNode, type DiscordData } from './node';

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
