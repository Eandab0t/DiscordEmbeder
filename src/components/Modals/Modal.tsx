import type { ReactNode } from 'react';

/** Shared modal shell: overlay, header, close button, scrollable body. */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-discord-panel bg-discord-base-deep shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-discord-sidebar px-4 py-3">
          <h2 className="text-sm font-bold text-discord-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded text-discord-muted hover:bg-discord-hover hover:text-discord-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
