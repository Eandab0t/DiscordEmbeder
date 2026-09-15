import { useState } from 'react';
import type { TopLevelComponent } from '../../model/discord-components-v2-schema';
import { TEMPLATES } from '../../templates';
import { useBuilderStore } from '../../store/useBuilderStore';
import { countComponents } from '../../model/tree';
import { Modal } from './Modal';

type Filter = 'all' | 'starter' | 'advanced';

export function TemplatesModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (components: TopLevelComponent[]) => void;
}) {
  const mode = useBuilderStore((s) => s.mode);
  const customTemplates = useBuilderStore((s) => s.customTemplates);
  const treeCount = useBuilderStore((s) => countComponents(s.tree));
  const projectName = useBuilderStore((s) => s.projectName);
  const [name, setName] = useState('');
  const defaultFilter: Filter = mode === 'simple' ? 'starter' : 'all';
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const shown = TEMPLATES.filter((t) => filter === 'all' || t.complexity === filter);

  return (
    <Modal title="Starter templates" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        {(customTemplates.length > 0 || treeCount > 0) && (
          <div className="rounded-lg border border-discord-panel bg-discord-base-deep p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-discord-muted">My templates</span>
              {treeCount > 0 && (
                <span className="ml-auto flex items-center gap-1.5">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={projectName}
                    className="w-36 rounded border border-discord-panel bg-discord-base px-2 py-1 text-xs text-discord-text placeholder:text-discord-muted"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      useBuilderStore.getState().saveTemplate(name.trim() || projectName);
                      setName('');
                    }}
                    className="rounded bg-discord-accent px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-discord-accent-hover"
                  >
                    💾 Save current ({treeCount})
                  </button>
                </span>
              )}
            </div>
            {customTemplates.length > 0 && (
              <div className="mt-2 grid gap-1.5">
                {customTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 rounded border border-discord-sidebar bg-discord-base px-2.5 py-1.5"
                  >
                    <span className="text-sm font-semibold text-discord-text">{t.name}</span>
                    <span className="text-[10px] text-discord-muted">
                      {t.components.length} top-level · {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onPick(t.components);
                          onClose();
                        }}
                        className="rounded bg-discord-accent/15 px-2 py-1 text-xs font-semibold text-[#9aa4ff] transition-colors hover:bg-discord-accent hover:text-white"
                      >
                        Insert
                      </button>
                      <button
                        type="button"
                        title="Delete template"
                        onClick={() => useBuilderStore.getState().deleteTemplate(t.id)}
                        className="rounded px-1.5 py-1 text-xs text-discord-muted transition-colors hover:bg-discord-red/15 hover:text-discord-red"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {(['all', 'starter', 'advanced'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize transition-colors ${
                filter === f
                  ? 'bg-discord-accent text-white'
                  : 'bg-discord-base text-discord-muted hover:bg-discord-hover hover:text-discord-text'
              }`}
            >
              {f === 'starter' ? '✨ Starter' : f === 'advanced' ? '🧩 Advanced' : 'All'}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-discord-muted">
            {mode === 'simple'
              ? 'Starter picks are shown first in simple mode.'
              : 'Advanced templates showcase several component types.'}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {shown.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick(t.message.components);
                onClose();
              }}
              className="relative rounded-lg border border-discord-panel bg-discord-base p-3 text-left transition-colors hover:border-discord-accent hover:bg-discord-hover"
            >
              <span
                className={`absolute right-2.5 top-2.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  t.complexity === 'starter'
                    ? 'bg-discord-green/15 text-discord-green'
                    : 'bg-discord-accent/15 text-[#9aa4ff]'
                }`}
              >
                {t.complexity}
              </span>
              <span className="text-2xl">{t.glyph}</span>
              <span className="mt-1 block text-sm font-bold text-discord-text">{t.name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-discord-muted">
                {t.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
