import { lazy, Suspense, useMemo, useState } from 'react';
import { EXPORTERS } from '../../exporters';
import { IS_COMPONENTS_V2 } from '../../model/discord-components-v2-schema';
import { buildPayload } from '../../model/tree';
import type { ComponentNode, BotIdentity } from '../../model/node';
import { Button } from '../ui/primitives';

interface ExportPanelProps {
  tree: ComponentNode[];
  bot: BotIdentity;
}

const CodeEditor = lazy(() => import('./CodeEditor'));

export function ExportPanel({ tree, bot }: ExportPanelProps) {
  const [activeId, setActiveId] = useState(EXPORTERS[0]?.id ?? 'json');
  const [copied, setCopied] = useState(false);

  const exporter = EXPORTERS.find((e) => e.id === activeId) ?? EXPORTERS[0];
  const payload = useMemo(
    () => buildPayload(tree),
    [tree],
  );
  const output = useMemo(() => {
    if (!exporter) return '';
    return exporter.generate(payload, { bot, flags: IS_COMPONENTS_V2 });
  }, [exporter, payload, bot]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — user can select text manually.
    }
  };

  const download = () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `components-v2.${exporter?.fileExtension ?? 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-discord-sidebar px-2 py-1.5">
        {EXPORTERS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setActiveId(e.id)}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              activeId === e.id
                ? 'bg-discord-accent text-white'
                : 'text-discord-muted hover:bg-discord-hover hover:text-discord-text'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-xs text-discord-muted">Loading editor…</div>
          }
        >
          <CodeEditor value={output} language={exporter?.language} />
        </Suspense>
      </div>
      <div className="flex items-center gap-2 border-t border-discord-sidebar p-2">
        <span className="text-[10px] text-discord-muted">
          {exporter?.id === 'json'
            ? 'Matches the ComponentsV2Message schema exactly.'
            : 'Paste into your bot — uses the raw API payload shape.'}
        </span>
        <span className="ml-auto flex gap-1.5">
          <Button onClick={copy}>{copied ? 'Copied!' : 'Copy'}</Button>
          <Button onClick={download}>Download</Button>
        </span>
      </div>
    </div>
  );
}
