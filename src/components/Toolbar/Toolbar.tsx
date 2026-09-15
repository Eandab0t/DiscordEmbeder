import { useEffect, useRef } from 'react';
import faviconUrl from '../../assets/favicon.svg';
import { useBuilderStore, saveSessionToLocalStorage } from '../../store/useBuilderStore';
import { MAX_TOTAL_COMPONENTS } from '../../model/discord-components-v2-schema';
import { countComponents } from '../../model/tree';
import type { ProjectSession } from '../../model/node';
import { Button, Badge } from '../ui/primitives';

export interface ToolbarModalState {
  kind: 'import' | 'templates' | 'webhook' | 'bot' | null;
}

export function Toolbar({
  onOpenModal,
  onLoadSession,
  onImportError,
}: {
  onOpenModal: (kind: ToolbarModalState['kind']) => void;
  onLoadSession: (session: ProjectSession) => void;
  onImportError: (message: string) => void;
}) {
  const projectName = useBuilderStore((s) => s.projectName);
  const setProjectName = useBuilderStore((s) => s.setProjectName);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const canUndo = useBuilderStore((s) => s.past.length > 0);
  const canRedo = useBuilderStore((s) => s.future.length > 0);
  const tree = useBuilderStore((s) => s.tree);
  const bot = useBuilderStore((s) => s.bot);
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);
  const mode = useBuilderStore((s) => s.mode);
  const setMode = useBuilderStore((s) => s.setMode);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autosave (debounced)
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveSessionToLocalStorage();
    }, 800);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [tree, bot, projectName]);

  const count = countComponents(tree);
  const nearLimit = count > MAX_TOTAL_COMPONENTS - 10;
  const atLimit = count >= MAX_TOTAL_COMPONENTS;

  const downloadProject = () => {
    const session = useBuilderStore.getState().getSession();
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session.metadata.name || 'project').replace(/[^\w-]+/g, '_')}.discordv2proj.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProjectFile = async (file: File) => {
    try {
      const session = JSON.parse(await file.text()) as ProjectSession;
      if (!session || typeof session !== 'object' || !Array.isArray(session.tree)) {
        throw new Error('Not a project file (expected { version, metadata, bot, tree }).');
      }
      if (!('version' in session) || session.version !== 1) {
        throw new Error(`Unsupported project version: ${String((session as { version?: unknown }).version)}`);
      }
      onLoadSession(session);
    } catch (e) {
      onImportError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-1.5 border-b border-discord-sidebar bg-discord-sidebar px-3 py-2">
      <div className="mr-2 flex items-center gap-2">
        <img src={faviconUrl} alt="" className="h-6 w-6" />
        <span className="text-sm font-bold tracking-tight text-discord-text">DiscordEmbeder</span>
        <Badge>Components V2</Badge>
      </div>

      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="w-44 rounded border border-transparent bg-discord-base px-2 py-1 text-xs text-discord-text outline-none hover:border-discord-panel focus:border-discord-accent"
        aria-label="Project name"
      />

      <div className="mx-1 h-5 w-px bg-discord-panel" />

      <Button variant="ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        ↩ Undo
      </Button>
      <Button variant="ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        ↪ Redo
      </Button>

      <div className="mx-1 h-5 w-px bg-discord-panel" />

      <div
        className="flex overflow-hidden rounded border border-discord-panel"
        role="group"
        aria-label="Editor mode"
        title="Simple shows the everyday blocks; Advanced reveals everything"
      >
        {(['simple', 'advanced'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
              mode === m ? 'bg-discord-accent text-white' : 'text-discord-muted hover:bg-discord-hover hover:text-discord-text'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <Button onClick={() => onOpenModal('templates')}>✨ Templates</Button>
      <Button onClick={() => onOpenModal('import')}>📥 Import JSON</Button>

      <div className="mx-1 h-5 w-px bg-discord-panel" />

      <Button onClick={downloadProject}>💾 Save project</Button>
      <Button onClick={() => fileInputRef.current?.click()}>📂 Load project</Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadProjectFile(f);
          e.target.value = '';
        }}
      />

      <div className="ml-auto flex items-center gap-1.5">
        <span
          title={`Components used (ceiling ${MAX_TOTAL_COMPONENTS})`}
          className={`rounded px-2 py-1 text-[11px] font-bold ${
            atLimit
              ? 'bg-discord-red/20 text-discord-red'
              : nearLimit
                ? 'bg-discord-yellow/15 text-discord-yellow'
                : 'bg-discord-base text-discord-muted'
          }`}
        >
          {count}/{MAX_TOTAL_COMPONENTS} components
        </span>
        {lastSavedAt && (
          <span className="hidden text-[10px] text-discord-muted lg:inline" title="Autosaved to this browser">
            ✓ saved
          </span>
        )}
        <Button onClick={() => onOpenModal('bot')} title="Preview identity">
          🤖 Identity
        </Button>
        <Button variant="primary" onClick={() => onOpenModal('webhook')}>
          🚀 Send test
        </Button>
      </div>
    </header>
  );
}
