import { createContext, useContext } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ButtonStyle,
  ComponentType,
  SeparatorSpacing,
} from '../../model/discord-components-v2-schema';
import { isSectionNode, nodeGlyph, nodeLabel, type ComponentNode } from '../../model/node';
import { PALETTE_BY_TYPE } from '../../model/defaults';
import { TEMPLATES } from '../../templates';
import { IconButton } from '../ui/primitives';
import { checkDrop, findParentOf } from '../../validation/rules';
import type { DropTarget } from '../../model/tree';
import { useBuilderStore } from '../../store/useBuilderStore';

// ---------------------------------------------------------------------------
// Drag state shared from App's DndContext
// ---------------------------------------------------------------------------

export interface ActiveDragInfo {
  type: ComponentType;
  key?: string;
}

export const DragStateContext = createContext<ActiveDragInfo | null>(null);

export function useDragState(): ActiveDragInfo | null {
  return useContext(DragStateContext);
}

export function slotId(parentKey: string | null, index: number): string {
  return `slot:${parentKey ?? 'root'}:${index}`;
}

export function parseOverId(id: string, tree: ComponentNode[]): DropTarget | null {
  if (id.startsWith('slot:')) {
    const [, parent, idx] = id.split(':');
    return {
      parentKey: parent === 'root' || parent === undefined ? null : parent,
      index: Number(idx ?? 0),
      slot: 'child',
    };
  }
  if (id.startsWith('acc:')) {
    const parentKey = id.slice('acc:'.length);
    return { parentKey, index: 0, slot: 'accessory' };
  }
  if (id.startsWith('node:')) {
    const key = id.slice('node:'.length);
    const owner = findParentOf(tree, key);
    if (!owner) return { parentKey: null, index: Number.MAX_SAFE_INTEGER, slot: 'child' };
    if (isSectionNode(owner) && owner.accessory?.key === key) {
      return { parentKey: owner.key, index: 0, slot: 'accessory' };
    }
    const index = owner.children.findIndex((c) => c.key === key);
    return { parentKey: owner.key, index: index + 1, slot: 'child' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Canvas root
// ---------------------------------------------------------------------------

interface CanvasProps {
  tree: ComponentNode[];
  select: (key: string | null) => void;
  selectedKey: string | null;
  removeNode: ReturnType<typeof useBuilderStore.getState>['removeNode'];
  duplicateNode: ReturnType<typeof useBuilderStore.getState>['duplicateNode'];
}

export function Canvas({ tree, select, selectedKey, removeNode, duplicateNode }: CanvasProps) {
  const hover = useDragState();
  const dragging = hover !== null;
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
      {tree.length === 0 && !dragging && <CanvasEmptyState />}
      <SortableContext items={tree.map((n) => `node:${n.key}`)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {tree.map((node, i) => (
            <div key={node.key} className="flex flex-col gap-1">
              {dragging && <DropSlot id={slotId(null, i)} tree={tree} />}
              <CanvasNode
                node={node}
                depth={0}
                tree={tree}
                select={select}
                selectedKey={selectedKey}
                removeNode={removeNode}
                duplicateNode={duplicateNode}
              />
            </div>
          ))}
        </div>
      </SortableContext>
      <DropSlot id={slotId(null, tree.length)} tree={tree} big={tree.length === 0} always={dragging} />
      {tree.length > 0 && (
        <p className="pt-2 text-center text-[11px] text-discord-muted">
          {tree.length} top-level component{tree.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

function CanvasEmptyState() {
  const addSmart = useBuilderStore((s) => s.addSmart);
  const starters: { label: string; glyph: string; type: ComponentType }[] = [
    { label: 'Text block', glyph: '¶', type: ComponentType.TextDisplay },
    { label: 'Card (container)', glyph: '▤', type: ComponentType.Container },
    { label: 'Image grid', glyph: '▦', type: ComponentType.MediaGallery },
  ];
  return (
    <div className="grid flex-1 place-items-center py-20">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-discord-accent/15 text-3xl">
          🧩
        </div>
        <h2 className="text-lg font-bold text-discord-text">Build your message</h2>
        <p className="mt-1 text-sm leading-relaxed text-discord-muted">
          Click a block on the left and it lands in the right spot automatically — or drag one for
          exact placement. Nesting follows Discord's real rules.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {starters.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => addSmart(s.type)}
              className="flex items-center gap-1.5 rounded-lg border border-discord-panel bg-discord-base px-3 py-2 text-xs font-semibold text-discord-text transition-colors hover:border-discord-accent hover:bg-discord-hover"
            >
              <span>{s.glyph}</span> {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const t = TEMPLATES[0];
              useBuilderStore.getState().addTemplate(t.message.components);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-discord-accent/60 bg-discord-accent/10 px-3 py-2 text-xs font-semibold text-discord-text transition-colors hover:bg-discord-accent/25"
          >
            <span>✨</span> Announcement template
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop slot — thin insertion line shown during drags
// ---------------------------------------------------------------------------

function DropSlot({
  id,
  tree,
  big = false,
  always = false,
}: {
  id: string;
  tree: ComponentNode[];
  big?: boolean;
  always?: boolean;
}) {
  const hover = useDragState();
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !hover });
  if (!hover && !always) return <div className="h-1" aria-hidden />;
  const target = parseOverId(id, tree);
  const check = target && hover ? checkDrop(tree, hover, target) : null;
  const state = isOver ? (check?.ok ? 'drop-slot-active' : 'drop-slot-invalid') : '';
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center transition-all ${
        big ? 'min-h-16' : 'min-h-3'
      } ${state}`}
    >
      {isOver && check?.ok === false && check.reason && (
        <span className="rounded bg-discord-red/20 px-2 py-0.5 text-[10px] font-semibold text-discord-red">
          {check.reason}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node card
// ---------------------------------------------------------------------------

interface NodeProps {
  node: ComponentNode;
  depth: number;
  tree: ComponentNode[];
  select: (key: string | null) => void;
  selectedKey: string | null;
  removeNode: (key: string) => void;
  duplicateNode: (key: string) => void;
}

export function CanvasNode({ node, depth, tree, select, selectedKey, removeNode, duplicateNode }: NodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `node:${node.key}`, data: { kind: 'node', key: node.key, type: node.type } });
  const selected = selectedKey === node.key;
  const item = PALETTE_BY_TYPE[node.type];

  if (isDragging) {
    return <div className="rounded-lg border border-dashed border-discord-muted/40 bg-discord-base-deep/50" style={{ height: 44 }} />;
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={(e) => {
        e.stopPropagation(); // nested cards: select the innermost component clicked
        select(node.key);
      }}
      className={`group relative rounded-lg border bg-discord-base-deep transition-colors ${
        selected ? 'border-discord-accent ring-1 ring-discord-accent/50' : 'border-discord-panel hover:border-discord-muted/50'
      }`}
    >
      {/* header */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to move"
          className="cursor-grab touch-none text-discord-muted hover:text-discord-text active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </button>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded border text-sm ${item?.hue ?? 'border-discord-panel bg-discord-panel text-discord-text'}`}
        >
          {nodeGlyph(node.type)}
        </span>
        <span className="text-xs font-bold text-discord-text">{nodeLabel(node.type)}</span>
        <NodeSummary node={node} />
        <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <IconButton
            title="Add inside/after — lands in a legal spot automatically"
            onClick={() => {
              // Anchor smart placement to this card, not the previous selection.
              useBuilderStore.getState().select(node.key);
              useBuilderStore.getState().addSmart(promptTypeFor(node));
            }}
          >
            ＋
          </IconButton>
          <IconButton title="Duplicate" onClick={() => duplicateNode(node.key)}>
            ⧉
          </IconButton>
          <IconButton title="Delete" danger onClick={() => removeNode(node.key)}>
            ✕
          </IconButton>
        </span>
      </div>

      {/* body per type */}
      <NodeBody
        node={node}
        depth={depth}
        tree={tree}
        select={select}
        selectedKey={selectedKey}
        removeNode={removeNode}
        duplicateNode={duplicateNode}
      />
    </div>
  );
}

/** What should the card's ＋ button add? Text Displays for Sections (their
 *  whole purpose), buttons for Action Rows, a Text Display after everything
 *  else. */
function promptTypeFor(node: ComponentNode): ComponentType {
  if (node.data.type === ComponentType.Section) return ComponentType.TextDisplay;
  if (node.data.type === ComponentType.ActionRow) return ComponentType.Button;
  return ComponentType.TextDisplay;
}

function NodeSummary({ node }: { node: ComponentNode }) {
  const d = node.data;
  let text = '';
  if (d.type === ComponentType.TextDisplay) text = d.content.slice(0, 60);
  else if (d.type === ComponentType.Button)
    text = `${d.label ?? d.emoji?.name ?? 'Button'} · ${ButtonStyle[d.style] ?? 'Style ' + d.style}`;
  else if (d.type === ComponentType.Container)
    text = `${node.children.length} child${node.children.length === 1 ? '' : 'ren'}`;
  else if (d.type === ComponentType.ActionRow) text = `${node.children.length} component(s)`;
  else if (d.type === ComponentType.Section) text = `${node.children.length} text + accessory`;
  else if (d.type === ComponentType.MediaGallery) text = `${d.items.length} item(s)`;
  else if (d.type === ComponentType.File) text = d.file.url;
  else if (d.type === ComponentType.Separator)
    text = `divider: ${d.divider ? 'on' : 'off'} · ${d.spacing === SeparatorSpacing.Large ? 'large' : 'small'}`;
  else if (d.type === ComponentType.StringSelect) text = d.placeholder ?? d.custom_id;
  else if (
    d.type === ComponentType.UserSelect ||
    d.type === ComponentType.RoleSelect ||
    d.type === ComponentType.MentionableSelect ||
    d.type === ComponentType.ChannelSelect
  )
    text = d.placeholder ?? d.custom_id;
  if (!text) return null;
  return (
    <span className="min-w-0 truncate text-[11px] text-discord-muted">
      {text}
      {d.type === ComponentType.TextDisplay && d.content.length > 60 ? '…' : ''}
    </span>
  );
}

function NodeBody(props: NodeProps & { depth: number }) {
  const { node, depth } = props;
  switch (node.type) {
    case ComponentType.Container:
      return <ContainerChildren {...props} depth={depth} />;
    case ComponentType.Section:
      return <SectionBody {...props} depth={depth} />;
    case ComponentType.ActionRow:
      return <ActionRowBody {...props} depth={depth} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Container children zone
// ---------------------------------------------------------------------------

function ContainerChildren({ node, depth, tree, ...rest }: NodeProps) {
  const hover = useDragState();
  return (
    <div className="mx-2.5 mb-2.5 rounded-md border border-discord-panel/60 bg-discord-base/60 p-1.5">
      <SortableContext
        items={node.children.map((c) => `node:${c.key}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1">
          {node.children.map((child, i) => (
            <div key={child.key} className="flex flex-col gap-1">
              {hover && <DropSlot id={slotId(node.key, i)} tree={tree} />}
              <CanvasNode {...rest} node={child} depth={depth + 1} tree={tree} />
            </div>
          ))}
        </div>
      </SortableContext>
      <DropSlot id={slotId(node.key, node.children.length)} tree={tree} always={!!hover} />
      {node.children.length === 0 && !hover && (
        <p className="px-2 py-3 text-center text-[11px] text-discord-muted">
          Drop Action Rows, Sections, Text Displays, Galleries, Files or Separators here
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: text displays left, accessory slot right
// ---------------------------------------------------------------------------

function SectionBody({ node, depth, tree, ...rest }: NodeProps) {
  const hover = useDragState();
  const accessory = isSectionNode(node) ? node.accessory : null;
  return (
    <div className="mx-2.5 mb-2.5 flex gap-2">
      <div className="min-w-0 flex-1 rounded-md border border-discord-panel/60 bg-discord-base/60 p-1.5">
        <SortableContext
          items={node.children.map((c) => `node:${c.key}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1">
            {node.children.map((child, i) => (
              <div key={child.key} className="flex flex-col gap-1">
                {hover && <DropSlot id={slotId(node.key, i)} tree={tree} />}
                <CanvasNode {...rest} node={child} depth={depth + 1} tree={tree} />
              </div>
            ))}
          </div>
        </SortableContext>
        <DropSlot id={slotId(node.key, node.children.length)} tree={tree} always={!!hover} />
        {node.children.length === 0 && !hover && (
          <p className="px-2 py-2 text-center text-[11px] text-discord-muted">
            1–3 Text Displays here
          </p>
        )}
      </div>
      <div className="w-44 shrink-0">
        <DropSlot id={`acc:${node.key}`} tree={tree} big={!accessory} always={!!hover} />
        {accessory ? (
          <CanvasNode {...rest} node={accessory} depth={depth + 1} tree={tree} />
        ) : (
          !hover && (
            <button
              type="button"
              onClick={() => {
                const st = useBuilderStore.getState();
                st.addComponent(ComponentType.Thumbnail, { parentKey: node.key, index: 0, slot: 'accessory' });
              }}
              title="Add a thumbnail here (click, or drag a Button/Thumbnail)"
              className="w-full rounded-lg border border-dashed border-discord-muted/40 px-2 py-3 text-center text-[11px] text-discord-muted transition-colors hover:border-discord-accent hover:text-discord-text"
            >
              ＋ Add a thumbnail — or drag a Button/Thumbnail here
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action row: horizontal children
// ---------------------------------------------------------------------------

function ActionRowBody({ node, depth, tree, ...rest }: NodeProps) {
  const hover = useDragState();
  const hasSelect = node.children.some(
    (c) => c.type >= ComponentType.StringSelect && c.type <= ComponentType.ChannelSelect,
  );
  const canAddMore = !hasSelect && node.children.length < 5;
  return (
    <div className="mx-2.5 mb-2.5 rounded-md border border-discord-panel/60 bg-discord-base/60 p-1.5">
      <SortableContext items={node.children.map((c) => `node:${c.key}`)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-wrap items-stretch gap-1.5">
          {node.children.map((child, i) => (
            <div key={child.key} className="flex min-w-40 flex-1 flex-col gap-1">
              {hover && <DropSlot id={slotId(node.key, i)} tree={tree} />}
              <CanvasNode {...rest} node={child} depth={depth + 1} tree={tree} />
            </div>
          ))}
        </div>
      </SortableContext>
      {canAddMore && <DropSlot id={slotId(node.key, node.children.length)} tree={tree} always={!!hover} />}
      {node.children.length === 0 && !hover && (
        <p className="px-2 py-2 text-center text-[11px] text-discord-muted">
          Up to 5 buttons, or exactly one select menu
        </p>
      )}
    </div>
  );
}


