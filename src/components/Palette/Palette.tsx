import { useDraggable } from '@dnd-kit/core';
import { ComponentType } from '../../model/discord-components-v2-schema';
import { PALETTE_ITEMS, type PaletteItem } from '../../model/defaults';
import { nodeGlyph } from '../../model/node';

export type PaletteBlock = { kind: 'palette'; type: ComponentType };

interface PaletteProps {
  /** ComponentType values currently legal under the active drag; null when not dragging. */
  legalTypes: Set<ComponentType> | null;
}

export function Palette({ legalTypes }: PaletteProps) {
  const categories: PaletteItem['category'][] = ['layout', 'content', 'interactive'];
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-[11px] leading-relaxed text-discord-muted">
        Drag a block onto the canvas. Blocks snap only into legal slots — a{' '}
        <span className="text-discord-text">Container</span> holds layouts, a{' '}
        <span className="text-discord-text">Section</span> holds 1–3 Text Displays plus one
        accessory, an <span className="text-discord-text">Action Row</span> holds buttons or one
        select.
      </p>
      {categories.map((cat) => (
        <div key={cat}>
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-discord-muted">
            {cat}
          </h3>
          <div className="flex flex-col gap-1.5">
            {PALETTE_ITEMS.filter((p) => p.category === cat).map((item) => (
              <PaletteBlockChip key={item.type} item={item} legalTypes={legalTypes} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaletteBlockChip({
  item,
  legalTypes,
}: {
  item: PaletteItem;
  legalTypes: Set<ComponentType> | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.type}`,
    data: { kind: 'palette', type: item.type } satisfies PaletteBlock,
  });
  const dimmed = legalTypes ? !legalTypes.has(item.type) : false;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      title={item.description}
      className={`group flex cursor-grab touch-none select-none items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition
        ${item.hue}
        ${dimmed ? 'opacity-30 saturate-0' : 'opacity-100'}
        ${isDragging ? 'opacity-40' : 'hover:brightness-125 active:cursor-grabbing'}`}
    >
      <span className="text-base leading-none">{nodeGlyph(item.type)}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold">{item.label}</span>
        <span className="block truncate text-[10px] text-discord-muted">{item.description}</span>
      </span>
      <span className="ml-auto hidden text-[10px] text-discord-muted group-hover:inline">⠿</span>
    </button>
  );
}
