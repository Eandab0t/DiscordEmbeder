import { useDraggable } from '@dnd-kit/core';
import { ComponentType } from '../../model/discord-components-v2-schema';
import { PALETTE_ITEMS, type PaletteItem } from '../../model/defaults';
import { nodeGlyph } from '../../model/node';
import { useBuilderStore } from '../../store/useBuilderStore';

export type PaletteBlock = { kind: 'palette'; type: ComponentType };

/** The everyday blocks. Advanced mode reveals the rest (selects, File, Thumbnail). */
const SIMPLE_TYPES: ReadonlySet<ComponentType> = new Set([
  ComponentType.Container,
  ComponentType.TextDisplay,
  ComponentType.Section,
  ComponentType.MediaGallery,
  ComponentType.Separator,
  ComponentType.ActionRow,
  ComponentType.Button,
]);

interface PaletteProps {
  /** ComponentType values currently legal under the active drag; null when not dragging. */
  legalTypes: Set<ComponentType> | null;
}

export function Palette({ legalTypes }: PaletteProps) {
  const mode = useBuilderStore((s) => s.mode);
  const addSmart = useBuilderStore((s) => s.addSmart);
  const items = PALETTE_ITEMS.filter((p) => mode === 'advanced' || SIMPLE_TYPES.has(p.type));
  const categories: PaletteItem['category'][] = ['layout', 'content', 'interactive'];

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-[11px] leading-relaxed text-discord-muted">
        <span className="font-semibold text-discord-text">Click</span> a block to add it — it lands
        in the right spot automatically (buttons get an Action Row, thumbnails a Section). Or drag
        one onto the canvas for exact placement.
      </p>
      {categories.map((cat) => {
        const catItems = items.filter((p) => p.category === cat);
        if (catItems.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-discord-muted">
              {cat}
            </h3>
            <div className="flex flex-col gap-1.5">
              {catItems.map((item) => (
                <PaletteBlockChip
                  key={item.type}
                  item={item}
                  legalTypes={legalTypes}
                  onAdd={() => addSmart(item.type)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {mode === 'simple' && (
        <p className="rounded border border-discord-panel bg-discord-base px-2 py-1.5 text-[10px] leading-relaxed text-discord-muted">
          Showing the everyday blocks. Switch to{' '}
          <span className="font-semibold text-discord-text">Advanced</span> (toolbar) for select
          menus, files and thumbnails.
        </p>
      )}
    </div>
  );
}

function PaletteBlockChip({
  item,
  legalTypes,
  onAdd,
}: {
  item: PaletteItem;
  legalTypes: Set<ComponentType> | null;
  onAdd: () => void;
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
      onClick={onAdd}
      title={`${item.description} — click to add, or drag`}
      className={`group flex cursor-pointer touch-none select-none items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition
        ${item.hue}
        ${dimmed ? 'opacity-30 saturate-0' : 'opacity-100'}
        ${isDragging ? 'opacity-40' : 'hover:brightness-125 active:cursor-grabbing'}`}
    >
      <span className="text-base leading-none">{nodeGlyph(item.type)}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold">{item.label}</span>
        <span className="block truncate text-[10px] text-discord-muted">{item.description}</span>
      </span>
      <span className="ml-auto hidden shrink-0 text-[11px] font-bold text-discord-muted group-hover:inline" title="Click to add, or drag">
        ＋⠿
      </span>
    </button>
  );
}
