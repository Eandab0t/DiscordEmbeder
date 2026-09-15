import { useRef, useState } from 'react';
import { TextArea } from '../ui/primitives';
import { formatTimestamp } from '../Preview/Markdown';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TS_STYLES = [
  { value: 't', label: 'Short time — 4:30 PM' },
  { value: 'T', label: 'Long time — 4:30:00 PM' },
  { value: 'd', label: 'Short date — 9/15/2026' },
  { value: 'D', label: 'Long date — September 15, 2026' },
  { value: 'f', label: 'Short date/time — September 15, 2026 4:30 PM' },
  { value: 'F', label: 'Long date/time — Tuesday, September 15, 2026 4:30 PM' },
  { value: 'R', label: 'Relative — 3 months ago / in 2 hours' },
];

/** Wrap the textarea selection with `left`/`right`; empty selection inserts both. */
function wrapSelection(
  area: HTMLTextAreaElement,
  left: string,
  right: string,
  placeholder: string,
  onChange: (v: string) => void,
) {
  const { selectionStart: s, selectionEnd: e, value } = area;
  const inner = s === e ? placeholder : value.slice(s, e);
  const next = `${value.slice(0, s)}${left}${inner}${right}${value.slice(e)}`;
  onChange(next);
  requestAnimationFrame(() => {
    area.focus();
    area.setSelectionRange(s + left.length, s + left.length + inner.length);
  });
}

const TOOLS: { label: string; title: string; left: string; right: string; placeholder: string }[] = [
  { label: 'B', title: 'Bold', left: '**', right: '**', placeholder: 'bold' },
  { label: 'I', title: 'Italic', left: '*', right: '*', placeholder: 'italic' },
  { label: 'U', title: 'Underline', left: '__', right: '__', placeholder: 'underline' },
  { label: 'S', title: 'Strikethrough', left: '~~', right: '~~', placeholder: 'strike' },
  { label: '`', title: 'Inline code', left: '`', right: '`', placeholder: 'code' },
  { label: '▦', title: 'Code block', left: '```\n', right: '\n```', placeholder: 'code block' },
  { label: '❝', title: 'Quote', left: '> ', right: '', placeholder: 'quote' },
  { label: '🔗', title: 'Link', left: '[', right: '](https://)', placeholder: 'text' },
  { label: 'H', title: 'Heading', left: '## ', right: '', placeholder: 'Heading' },
  { label: '•', title: 'List item', left: '- ', right: '', placeholder: 'item' },
];

const EMOJI_HINT = 'Paste custom emoji like <:name:1234567890123456789> — they render inline in Discord and in the preview.';

/** Markdown formatting toolbar + timestamp builder around a Discord text field. */
export function DiscordTextTools({
  value,
  onChange,
  rows = 10,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [tsMode, setTsMode] = useState(false);
  const insert = (left: string, right: string, placeholderText: string) => {
    if (areaRef.current) wrapSelection(areaRef.current, left, right, placeholderText, onChange);
  };
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-0.5">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            onClick={() => insert(t.left, t.right, t.placeholder)}
            className="h-6 min-w-6 rounded px-1 text-xs font-bold text-discord-muted hover:bg-discord-hover hover:text-discord-text"
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          title="Build a dynamic timestamp"
          onClick={() => setTsMode((v) => !v)}
          className="ml-auto h-6 rounded px-1.5 text-xs font-bold text-discord-muted hover:bg-discord-hover hover:text-discord-text"
        >
          🕒 Timestamp
        </button>
      </div>
      {tsMode && (
        <TimestampBuilder
          onInsert={(code) => insert(code, '', 'timestamp')}
          onClose={() => setTsMode(false)}
        />
      )}
      <TextArea
        ref={areaRef}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? EMOJI_HINT}
      />
      <p className="mt-1 text-[10px] leading-relaxed text-discord-muted">{EMOJI_HINT}</p>
    </div>
  );
}

function TimestampBuilder({ onInsert, onClose }: { onInsert: (code: string) => void; onClose: () => void }) {
  const [when, setWhen] = useState(() => {
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return now.toISOString().slice(0, 16);
  });
  const [style, setStyle] = useState('f');
  const epoch = Math.floor(new Date(`${when}:00Z`).getTime() / 1000);
  const valid = Number.isFinite(epoch);
  const code = valid ? `<t:${epoch}:${style}>` : '';
  return (
    <div className="mb-1 rounded border border-discord-sidebar bg-discord-base-deep p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded border border-discord-panel bg-discord-base px-2 py-1 text-xs text-discord-text"
        />
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="rounded border border-discord-panel bg-discord-base px-2 py-1 text-xs text-discord-text"
        >
          {TS_STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <code className="rounded bg-discord-sidebar px-1.5 py-0.5 text-xs text-discord-text">{code || '—'}</code>
        <span className="text-xs text-discord-muted">≈ {valid ? formatTimestamp(epoch, style) : 'invalid date'}</span>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onInsert(code)}
          className="ml-auto rounded bg-discord-accent px-2 py-1 text-xs font-medium text-white hover:bg-discord-accent-hover disabled:opacity-40"
        >
          Insert
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close timestamp builder"
          className="rounded px-1 text-xs text-discord-muted hover:bg-discord-hover hover:text-discord-text"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
