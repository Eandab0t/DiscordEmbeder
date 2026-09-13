import { ComponentType } from '../../model/discord-components-v2-schema';
import { isSectionNode, nodeGlyph, nodeLabel, type ComponentNode } from '../../model/node';

interface OutlineProps {
  tree: ComponentNode[];
  selectedKey: string | null;
  select: (key: string | null) => void;
}

export function Outline({ tree, selectedKey, select }: OutlineProps) {
  return (
    <div className="p-2">
      {tree.length === 0 ? (
        <p className="p-3 text-xs text-discord-muted">No components yet.</p>
      ) : (
        <div className="flex flex-col gap-px">
          {tree.map((n) => (
            <OutlineRow key={n.key} node={n} depth={0} selectedKey={selectedKey} select={select} />
          ))}
        </div>
      )}
    </div>
  );
}

function OutlineRow({
  node,
  depth,
  selectedKey,
  select,
}: {
  node: ComponentNode;
  depth: number;
  selectedKey: string | null;
  select: (key: string | null) => void;
}) {
  const selected = selectedKey === node.key;
  return (
    <>
      <button
        type="button"
        onClick={() => select(node.key)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`flex items-center gap-2 rounded py-1 pr-2 text-left text-xs transition-colors ${
          selected
            ? 'bg-discord-accent/20 text-discord-text ring-1 ring-inset ring-discord-accent/40'
            : 'text-discord-muted hover:bg-discord-hover hover:text-discord-text'
        }`}
      >
        <span className="w-4 shrink-0 text-center">{nodeGlyph(node.type)}</span>
        <span className="truncate font-semibold">{nodeLabel(node.type)}</span>
        {node.type === ComponentType.Container && (
          <span className="ml-auto text-[10px]">{node.children.length}</span>
        )}
      </button>
      {isSectionNode(node) && node.accessory && (
        <OutlineRow node={node.accessory} depth={depth + 1} selectedKey={selectedKey} select={select} />
      )}
      {node.children.map((c) => (
        <OutlineRow key={c.key} node={c} depth={depth + 1} selectedKey={selectedKey} select={select} />
      ))}
    </>
  );
}
