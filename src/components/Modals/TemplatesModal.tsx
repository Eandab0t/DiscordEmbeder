import { useState } from 'react';
import type { TopLevelComponent } from '../../model/discord-components-v2-schema';
import { TEMPLATES } from '../../templates';
import { useBuilderStore } from '../../store/useBuilderStore';
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
  const defaultFilter: Filter = mode === 'simple' ? 'starter' : 'all';
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const shown = TEMPLATES.filter((t) => filter === 'all' || t.complexity === filter);

  return (
    <Modal title="Starter templates" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
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
