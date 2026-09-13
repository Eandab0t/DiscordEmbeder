import type { TopLevelComponent } from '../../model/discord-components-v2-schema';
import { TEMPLATES } from '../../templates';
import { Modal } from './Modal';

export function TemplatesModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (components: TopLevelComponent[]) => void;
}) {
  return (
    <Modal title="Starter templates" onClose={onClose} wide>
      <div className="grid gap-2 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onPick(t.message.components);
              onClose();
            }}
            className="rounded-lg border border-discord-panel bg-discord-base p-3 text-left transition-colors hover:border-discord-accent hover:bg-discord-hover"
          >
            <span className="text-2xl">{t.glyph}</span>
            <span className="mt-1 block text-sm font-bold text-discord-text">{t.name}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-discord-muted">{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
