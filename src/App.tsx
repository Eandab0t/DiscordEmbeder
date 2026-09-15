import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { useBuilderStore, loadSessionFromLocalStorage } from './store/useBuilderStore';
import type { ProjectSession } from './model/node';
import { nodeGlyph, nodeLabel } from './model/node';
import { ComponentType } from './model/discord-components-v2-schema';
import { findNode, validateTree, isAllowedChildType, isTopLevelLegal } from './validation/rules';
import type { DropTarget } from './model/tree';
import { PALETTE_BY_TYPE, PALETTE_ITEMS } from './model/defaults';
import { Palette, type PaletteBlock } from './components/Palette/Palette';
import { Canvas, DragStateContext, parseOverId, type ActiveDragInfo } from './components/Canvas/Canvas';
import { Inspector } from './components/Inspector/Inspector';
import { Preview } from './components/Preview/Preview';
import { ExportPanel } from './components/ExportPanel/ExportPanel';
import { Outline } from './components/Outline/Outline';
import { Toolbar, type ToolbarModalState } from './components/Toolbar/Toolbar';
import { ValidationBanner } from './components/ValidationBanner/ValidationBanner';
import { ImportModal } from './components/Modals/ImportModal';
import { TemplatesModal } from './components/Modals/TemplatesModal';
import { WebhookModal } from './components/Modals/WebhookModal';
import { BotModal } from './components/Modals/BotModal';
import { Badge } from './components/ui/primitives';

type CenterTab = 'canvas' | 'preview' | 'export';

export default function App() {
  const tree = useBuilderStore((s) => s.tree);
  const selectedKey = useBuilderStore((s) => s.selectedKey);
  const bot = useBuilderStore((s) => s.bot);
  const webhookUrl = useBuilderStore((s) => s.webhookUrl);

  const [tab, setTab] = useState<CenterTab>('canvas');
  const [modal, setModal] = useState<ToolbarModalState['kind']>(null);
  const [drag, setDrag] = useState<ActiveDragInfo | null>(null);
  const [hover, setHover] = useState<DropTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Restore autosave once on mount.
  useEffect(() => {
    const session = loadSessionFromLocalStorage();
    if (session && Array.isArray(session.tree) && session.tree.length > 0) {
      useBuilderStore.getState().loadSession(session, { recordHistory: false });
    }
  }, []);

  const issues = useMemo(() => validateTree(tree), [tree]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  // Rejected mutations (cap, nesting, …) surface through the toast — the store
  // records `lastRejected` with a fresh object identity per rejection.
  const lastRejected = useBuilderStore((s) => s.lastRejected);
  useEffect(() => {
    if (lastRejected) showToast(lastRejected.reason);
  }, [lastRejected]);

  // Keyboard shortcuts: undo / redo / delete / duplicate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (inField) return;
      const st = useBuilderStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && st.selectedKey) {
        e.preventDefault();
        st.duplicateNode(st.selectedKey);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedKey) {
        e.preventDefault();
        st.removeNode(st.selectedKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------------------------------------------------------------------------
  // Drag orchestration
  // ---------------------------------------------------------------------------

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as
      | PaletteBlock
      | { kind: 'node'; key: string; type: ComponentType }
      | undefined;
    if (!data) return;
    setDrag(data.kind === 'palette' ? { type: data.type } : { type: data.type, key: data.key });
  };

  const onDragOver = (e: DragOverEvent) => {
    const over = e.over;
    if (!over) {
      setHover(null);
      return;
    }
    setHover(parseOverId(String(over.id), tree));
  };

  const finishDrag = (e: DragEndEvent | DragCancelEvent, commit: boolean) => {
    const st = useBuilderStore.getState();
    if (commit && drag && e.over) {
      const target = parseOverId(String(e.over.id), tree);
      if (target) {
        const result = drag.key ? st.moveNode(drag.key, target) : st.addComponent(drag.type, target);
        void result;
      }
    }
    setDrag(null);
    setHover(null);
  };

  const hoverInfo = drag;

  // Dim palette entries that are illegal for the slot currently under the cursor.
  const paletteLegalTypes = useMemo(() => {
    if (!drag || !hover) return null;
    const parentNode = hover.parentKey ? findNode(tree, hover.parentKey) : null;
    const types = new Set<ComponentType>();
    for (const item of PALETTE_ITEMS) {
      const legal = parentNode
        ? isAllowedChildType(parentNode.type, item.type)
        : isTopLevelLegal(item.type);
      if (legal) types.add(item.type);
    }
    return types;
  }, [drag, hover, tree]);

  const selectedNode = selectedKey ? findNode(tree, selectedKey) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      modifiers={[restrictToWindowEdges]}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(e) => finishDrag(e, true)}
      onDragCancel={(e) => finishDrag(e, false)}
    >
      <div className="flex h-full flex-col">
        <Toolbar
          onOpenModal={(k) => setModal(k)}
          onLoadSession={(s: ProjectSession) => {
            useBuilderStore.getState().loadSession(s);
            showToast(`Loaded project “${s.metadata?.name ?? 'Untitled'}”`);
          }}
          onImportError={showToast}
        />
        <ValidationBanner
          issues={issues}
          onSelectNode={(key) => {
            useBuilderStore.getState().select(key);
            setTab('canvas');
          }}
        />

        <DragStateContext.Provider value={hoverInfo}>
          <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
            {/* Palette */}
            <aside className="hidden flex-col overflow-y-auto border-r border-discord-sidebar bg-discord-base-deep lg:flex">
              <Palette legalTypes={paletteLegalTypes} />
            </aside>

            {/* Center */}
            <section className="flex min-h-0 min-w-0 flex-col bg-discord-base">
              <div className="flex items-center gap-1 border-b border-discord-sidebar bg-discord-base-deep px-2 py-1.5">
                {(['canvas', 'preview', 'export'] as CenterTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                      tab === t
                        ? 'bg-discord-accent text-white'
                        : 'text-discord-muted hover:bg-discord-hover hover:text-discord-text'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {selectedNode && tab === 'canvas' && (
                  <span className="ml-auto flex items-center gap-1.5 pr-1 text-[11px] text-discord-muted">
                    <span>{nodeGlyph(selectedNode.type)}</span>
                    {nodeLabel(selectedNode.type)} selected
                    <Badge>{selectedNode.type}</Badge>
                  </span>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {tab === 'canvas' && (
                  <Canvas
                    tree={tree}
                    select={(k) => useBuilderStore.getState().select(k)}
                    selectedKey={selectedKey}
                    removeNode={(key) => useBuilderStore.getState().removeNode(key)}
                    duplicateNode={(key) => useBuilderStore.getState().duplicateNode(key)}
                  />
                )}
                {tab === 'preview' && <Preview tree={tree} bot={bot} />}
                {tab === 'export' && <ExportPanel tree={tree} bot={bot} />}
              </div>
            </section>

            {/* Right: inspector + layers */}
            <aside className="hidden min-h-0 flex-col border-l border-discord-sidebar bg-discord-base-deep lg:flex">
              <div className="min-h-0 flex-1">
                <Inspector
                  node={selectedNode}
                  updateData={(key, updater) => useBuilderStore.getState().updateData(key, updater)}
                  removeNode={(key) => useBuilderStore.getState().removeNode(key)}
                  duplicateNode={(key) => useBuilderStore.getState().duplicateNode(key)}
                />
              </div>
              <div className="max-h-56 shrink-0 overflow-y-auto border-t border-discord-sidebar">
                <div className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wider text-discord-muted">
                  Layers
                </div>
                <Outline
                  tree={tree}
                  selectedKey={selectedKey}
                  select={(k) => useBuilderStore.getState().select(k)}
                />
              </div>
            </aside>
          </main>
        </DragStateContext.Provider>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {drag ? (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold shadow-xl ${
                PALETTE_BY_TYPE[drag.type]?.hue ?? 'border-discord-panel bg-discord-panel'
              }`}
            >
              <span>{nodeGlyph(drag.type)}</span>
              {nodeLabel(drag.type)}
            </div>
          ) : null}
        </DragOverlay>

        {toast && (
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-discord-sidebar px-4 py-2 text-xs font-semibold text-discord-text shadow-2xl ring-1 ring-discord-panel">
            {toast}
          </div>
        )}

        {modal === 'import' && (
          <ImportModal
            onClose={() => setModal(null)}
            onLoad={(components, name) => {
              useBuilderStore.getState().loadPayload(components, name);
              setTab('canvas');
              showToast('Payload imported onto the canvas');
            }}
          />
        )}
        {modal === 'templates' && (
          <TemplatesModal
            onClose={() => setModal(null)}
            onPick={(components) => {
              useBuilderStore.getState().addTemplate(components);
            }}
          />
        )}
        {modal === 'webhook' && (
          <WebhookModal
            onClose={() => setModal(null)}
            initialUrl={webhookUrl}
            tree={tree}
            bot={bot}
            onUrlChange={(url) => useBuilderStore.getState().setWebhookUrl(url)}
          />
        )}
        {modal === 'bot' && (
          <BotModal
            onClose={() => setModal(null)}
            bot={bot}
            onSave={(b) => useBuilderStore.getState().setBot(b)}
          />
        )}
      </div>
    </DndContext>
  );
}
