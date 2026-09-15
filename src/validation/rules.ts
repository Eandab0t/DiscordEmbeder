import {
  ALLOWED_CHILDREN,
  ButtonStyle,
  ComponentType,
  MAX_TOTAL_COMPONENTS,
  SELECT_OPTIONS_CAP,
} from '../model/discord-components-v2-schema';
import type { ComponentNode } from '../model/node';
import type { DropTarget } from '../model/tree';
import { isSectionNode, nodeLabel } from '../model/node';
import { countComponents, totalTextLength } from '../model/tree';

/** Would `childType` be legal as a direct child of `parentType`?
 *  Reads ALLOWED_CHILDREN. Section accessories (Button/Thumbnail) are NOT
 *  children — they only fit the dedicated accessory slot. */
export function isAllowedChildType(parentType: ComponentType, childType: ComponentType): boolean {
  if (parentType === ComponentType.Section) {
    return childType === ComponentType.TextDisplay;
  }
  return ALLOWED_CHILDREN[parentType]?.includes(childType) ?? false;
}

/** Is a Section accessory slot free to take another accessory? */
export function sectionHasAccessory(node: ComponentNode): boolean {
  return isSectionNode(node) && node.accessory !== null;
}

export interface DropCheckResult {
  ok: boolean;
  reason?: string;
}

/** Full drop-time validation: type legality, counts, cycles. */
export function checkDrop(
  tree: ComponentNode[],
  dragged: { type: ComponentType; key?: string },
  target: DropTarget,
): DropCheckResult {
  // Cycle guard: never drop a node into its own subtree.
  if (dragged.key && target.parentKey) {
    const draggedSubtree = findNode(tree, dragged.key);
    if (draggedSubtree && findNode([draggedSubtree], target.parentKey)) {
      return { ok: false, reason: 'A component cannot be nested inside itself.' };
    }
    // Also block dropping into the node itself.
    if (dragged.key === target.parentKey) {
      return { ok: false, reason: 'A component cannot be nested inside itself.' };
    }
  }

  if (target.parentKey === null) {
    // Root level. Reordering an existing root-level node is always fine;
    // moving a nested node out must pass top-level legality like a fresh add.
    if (dragged.key) {
      const node = findNode(tree, dragged.key);
      if (node && node.type === ComponentType.Thumbnail) {
        return { ok: false, reason: 'Thumbnails can only live as a Section accessory.' };
      }
      if (node && tree.includes(node)) {
        return { ok: true };
      }
    }
    if (!isTopLevelLegal(dragged.type)) {
      return {
        ok: false,
        reason: `${nodeLabel(dragged.type)} can't be a top-level component.`,
      };
    }
    // The 40-cap governs net component count; moves never change it, so only
    // fresh palette adds are capped (same exemption as the nested branch below).
    if (!dragged.key && countComponents(tree) >= MAX_TOTAL_COMPONENTS) {
      return { ok: false, reason: `Message is at the ${MAX_TOTAL_COMPONENTS}-component limit.` };
    }
    return { ok: true };
  }

  const parent = findNode(tree, target.parentKey);
  if (!parent) return { ok: false, reason: 'Target no longer exists.' };

  if (target.slot === 'accessory') {
    if (parent.type !== ComponentType.Section) {
      return { ok: false, reason: 'Only Sections have an accessory slot.' };
    }
    if (dragged.type !== ComponentType.Button && dragged.type !== ComponentType.Thumbnail) {
      return { ok: false, reason: 'Accessory must be a Button or a Thumbnail.' };
    }
    const parentIsSection = isSectionNode(parent);
    const existingAccessoryKey = parentIsSection ? parent.accessory?.key : undefined;
    if (sectionHasAccessory(parent) && dragged.key !== existingAccessoryKey) {
      return { ok: false, reason: 'Section already has an accessory.' };
    }
    return { ok: true };
  }

  if (!isAllowedChildType(parent.type, dragged.type)) {
    return {
      ok: false,
      reason: `${nodeLabel(dragged.type)} isn't allowed inside a ${nodeLabel(parent.type)}.`,
    };
  }

  // Reordering within the same parent is always allowed (no new component added).
  if (dragged.key) {
    const draggedNode = findNode(tree, dragged.key);
    if (draggedNode && draggedNode !== parent) {
      const sameParent =
        (target.parentKey === null && tree.includes(draggedNode)) ||
        parent.children.includes(draggedNode);
      if (sameParent) return { ok: true };
    }
  }

  if (countComponents(tree) >= MAX_TOTAL_COMPONENTS && !dragged.key) {
    return { ok: false, reason: `Message is at the ${MAX_TOTAL_COMPONENTS}-component limit.` };
  }

  // Quantity rules.
  if (parent.type === ComponentType.ActionRow) {
    const childTypes = parent.children.map((c) => c.type);
    const hasSelect = childTypes.some(
      (t) => t >= ComponentType.StringSelect && t <= ComponentType.ChannelSelect,
    );
    const draggedIsSelect =
      dragged.type >= ComponentType.StringSelect && dragged.type <= ComponentType.ChannelSelect;
    if (hasSelect && !draggedIsSelect) {
      return { ok: false, reason: 'An Action Row with a select menu can hold only that select.' };
    }
    if (!hasSelect && draggedIsSelect && childTypes.length > 0) {
      return { ok: false, reason: 'A select menu must be alone in its Action Row.' };
    }
    if (draggedIsSelect && childTypes.length >= 1) {
      const isSameNode = dragged.key && parent.children.some((c) => c.key === dragged.key);
      if (!isSameNode) {
        return { ok: false, reason: 'An Action Row can hold only one select menu.' };
      }
    }
    const existingButtons = childTypes.filter((t) => t === ComponentType.Button).length;
    if (dragged.type === ComponentType.Button && existingButtons >= 5) {
      const isSameNode = dragged.key && parent.children.some((c) => c.key === dragged.key);
      if (!isSameNode) {
        return { ok: false, reason: 'An Action Row holds at most 5 buttons.' };
      }
    }
  }
  if (parent.type === ComponentType.Section && dragged.type === ComponentType.TextDisplay) {
    if (parent.children.length >= 3) {
      const isSameNode = dragged.key && parent.children.some((c) => c.key === dragged.key);
      if (!isSameNode) {
        return { ok: false, reason: 'A Section holds at most 3 Text Displays.' };
      }
    }
  }

  return { ok: true };
}

export function isTopLevelLegal(type: ComponentType): boolean {
  return (
    type === ComponentType.Container ||
    type === ComponentType.Section ||
    type === ComponentType.TextDisplay ||
    type === ComponentType.MediaGallery ||
    type === ComponentType.File ||
    type === ComponentType.Separator ||
    type === ComponentType.ActionRow
  );
}

// ---------------------------------------------------------------------------
// Tree search helpers
// ---------------------------------------------------------------------------

export function findNode(tree: ComponentNode[], key: string): ComponentNode | null {
  for (const node of tree) {
    if (node.key === key) return node;
    if (isSectionNode(node) && node.accessory) {
      const hit = findNode([node.accessory], key);
      if (hit) return hit;
    }
    const inChildren = findNode(node.children, key);
    if (inChildren) return inChildren;
  }
  return null;
}

export function findParentOf(tree: ComponentNode[], key: string): ComponentNode | null {
  for (const node of tree) {
    if (node.children.some((c) => c.key === key)) return node;
    if (isSectionNode(node) && node.accessory?.key === key) return node;
    const deeper = findParentOf(node.children, key)
      ?? (isSectionNode(node) && node.accessory ? findParentOf([node.accessory], key) : null);
    if (deeper) return deeper;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Whole-tree structural validation
// ---------------------------------------------------------------------------

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  message: string;
  nodeKey?: string;
}

const TEXT_DISPLAY_TOTAL_CAP = 4000;

export function validateTree(tree: ComponentNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const total = countComponents(tree);
  if (total > MAX_TOTAL_COMPONENTS) {
    issues.push({
      severity: 'error',
      message: `Message has ${total} components — Discord's ceiling is ${MAX_TOTAL_COMPONENTS}.`,
    });
  } else if (total > MAX_TOTAL_COMPONENTS - 5) {
    issues.push({
      severity: 'warning',
      message: `${total}/${MAX_TOTAL_COMPONENTS} components used — almost at the ceiling.`,
    });
  }

  const textLen = totalTextLength(tree);
  if (textLen > TEXT_DISPLAY_TOTAL_CAP) {
    issues.push({
      severity: 'error',
      message: `Text Displays total ${textLen} characters — the cap is ${TEXT_DISPLAY_TOTAL_CAP}.`,
    });
  } else if (textLen > TEXT_DISPLAY_TOTAL_CAP - 500) {
    issues.push({
      severity: 'warning',
      message: `${textLen}/${TEXT_DISPLAY_TOTAL_CAP} markdown characters used.`,
    });
  }

  const visit = (node: ComponentNode) => {
    const d = node.data;
    switch (node.type) {
      case ComponentType.Button: {
        if (d.type !== ComponentType.Button) break;
        const isLink = d.style === ButtonStyle.Link;
        if (isLink) {
          if (!d.url) {
            issues.push({ severity: 'error', message: 'Link button needs a URL.', nodeKey: node.key });
          } else if (!/^https?:\/\//i.test(d.url)) {
            issues.push({
              severity: 'error',
              message: 'Link button URL must start with http:// or https://.',
              nodeKey: node.key,
            });
          }
        } else if (!d.custom_id) {
          issues.push({
            severity: 'error',
            message: 'Non-link buttons need a custom_id.',
            nodeKey: node.key,
          });
        }
        if (!d.label && !d.emoji) {
          issues.push({
            severity: 'error',
            message: 'Button needs a label or an emoji.',
            nodeKey: node.key,
          });
        }
        break;
      }
      case ComponentType.StringSelect: {
        if (d.type !== ComponentType.StringSelect) break;
        if (!d.custom_id) {
          issues.push({ severity: 'error', message: 'Select needs a custom_id.', nodeKey: node.key });
        }
        if (!d.options || d.options.length === 0) {
          issues.push({
            severity: 'error',
            message: 'String Select needs at least one option.',
            nodeKey: node.key,
          });
        } else if (d.options.length > SELECT_OPTIONS_CAP) {
          issues.push({
            severity: 'error',
            message: `String Select has ${d.options.length} options — cap is ${SELECT_OPTIONS_CAP}.`,
            nodeKey: node.key,
          });
        }
        break;
      }
      case ComponentType.ActionRow: {
        const kids = node.children;
        const selects = kids.filter(
          (c) => c.type >= ComponentType.StringSelect && c.type <= ComponentType.ChannelSelect,
        );
        if (kids.length === 0) {
          issues.push({
            severity: 'error',
            message: 'Empty Action Row — add buttons or a select menu.',
            nodeKey: node.key,
          });
        } else if (selects.length > 1 || (selects.length === 1 && kids.length > 1)) {
          issues.push({
            severity: 'error',
            message: 'An Action Row holds up to 5 buttons OR exactly one select menu.',
            nodeKey: node.key,
          });
        } else if (kids.length > 5) {
          issues.push({
            severity: 'error',
            message: 'An Action Row holds at most 5 components.',
            nodeKey: node.key,
          });
        }
        for (const c of kids) visit(c);
        break;
      }
      case ComponentType.Section: {
        if (node.children.length === 0) {
          issues.push({
            severity: 'error',
            message: 'Section needs 1–3 Text Displays.',
            nodeKey: node.key,
          });
        } else if (node.children.length > 3) {
          issues.push({
            severity: 'error',
            message: 'Section holds at most 3 Text Displays.',
            nodeKey: node.key,
          });
        }
        if (isSectionNode(node) && !node.accessory) {
          issues.push({
            severity: 'error',
            message: 'Section needs an accessory (Button or Thumbnail).',
            nodeKey: node.key,
          });
        }
        for (const c of node.children) visit(c);
        if (isSectionNode(node) && node.accessory) visit(node.accessory);
        break;
      }
      case ComponentType.TextDisplay: {
        if (d.type === ComponentType.TextDisplay && !d.content.trim()) {
          issues.push({
            severity: 'warning',
            message: 'Text Display is empty.',
            nodeKey: node.key,
          });
        }
        break;
      }
      case ComponentType.MediaGallery: {
        if (d.type === ComponentType.MediaGallery) {
          if (!d.items?.length) {
            issues.push({
              severity: 'error',
              message: 'Media Gallery needs at least one item.',
              nodeKey: node.key,
            });
          } else if (d.items.length > 10) {
            issues.push({
              severity: 'error',
              message: 'Media Gallery holds at most 10 items.',
              nodeKey: node.key,
            });
          }
          d.items.forEach((item, i) => {
            if (!item.media?.url) {
              issues.push({
                severity: 'error',
                message: `Gallery item ${i + 1} needs a URL.`,
                nodeKey: node.key,
              });
            }
          });
        }
        break;
      }
      case ComponentType.File: {
        if (d.type === ComponentType.File && !/^attachment:\/\//i.test(d.file?.url ?? '')) {
          issues.push({
            severity: 'error',
            message: 'File component URL must be attachment://filename.ext.',
            nodeKey: node.key,
          });
        }
        break;
      }
      case ComponentType.UserSelect:
      case ComponentType.RoleSelect:
      case ComponentType.MentionableSelect:
      case ComponentType.ChannelSelect: {
        if (!d.custom_id) {
          issues.push({
            severity: 'error',
            message: 'Select menus need a custom_id.',
            nodeKey: node.key,
          });
        }
        break;
      }
      default:
        for (const c of node.children) visit(c);
    }
  };

  for (const n of tree) {
    if (!isTopLevelLegal(n.type)) {
      issues.push({
        severity: 'error',
        message: `${nodeLabel(n.type)} can't be a top-level component — Discord will reject this payload.`,
        nodeKey: n.key,
      });
    }
    visit(n);
  }

  if (tree.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'Canvas is empty — drag components in from the palette or load a template.',
    });
  }

  return issues;
}
