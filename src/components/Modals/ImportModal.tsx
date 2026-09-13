import { useState } from 'react';
import type { TopLevelComponent } from '../../model/discord-components-v2-schema';
import { parsePayloadJson, type ImportResult } from '../../import/parse';
import { Button } from '../ui/primitives';
import { Modal } from './Modal';

export function ImportModal({
  onClose,
  onLoad,
}: {
  onClose: () => void;
  onLoad: (components: TopLevelComponent[], name?: string) => void;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const run = (input: string) => {
    setText(input);
    if (!input.trim()) return setResult(null);
    setResult(parsePayloadJson(input));
  };

  const onFile = async (file: File) => {
    const content = await file.text();
    run(content);
  };

  const commit = () => {
    if (!result?.ok) return;
    onLoad(result.components);
    onClose();
  };

  return (
    <Modal title="Import JSON payload" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-discord-muted">
          Paste a Components V2 payload (object with <code>flags</code> +{' '}
          <code>components</code>, or a bare component array) or upload a{' '}
          <code>.json</code> file. It is validated against the schema before loading.
        </p>
        <textarea
          value={text}
          onChange={(e) => run(e.target.value)}
          placeholder='{ "flags": 32768, "components": [ … ] }'
          className="h-48 w-full resize-y rounded border border-discord-sidebar bg-discord-sidebar p-2 font-mono text-xs text-discord-text outline-none focus:border-discord-accent"
        />
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-discord-muted hover:text-discord-text">
          <span className="rounded border border-discord-panel px-2 py-1">Upload .json file</span>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>
        {result && (
          <div className="flex flex-col gap-2">
            {result.errors.length > 0 && (
              <div className="rounded border border-discord-red/40 bg-discord-red/10 p-2">
                <p className="mb-1 text-xs font-bold text-discord-red">
                  {result.errors.length} error{result.errors.length === 1 ? '' : 's'}
                </p>
                <ul className="flex flex-col gap-1">
                  {result.errors.slice(0, 12).map((err, i) => (
                    <li key={i} className="font-mono text-[11px] text-discord-red">
                      <span className="font-bold">{err.path}</span> — {err.message}
                    </li>
                  ))}
                </ul>
                {result.errors.length > 12 && (
                  <p className="mt-1 text-[11px] text-discord-muted">
                    …and {result.errors.length - 12} more.
                  </p>
                )}
              </div>
            )}
            {result.warnings.map((w, i) => (
              <div key={i} className="rounded border border-discord-yellow/40 bg-discord-yellow/10 p-2 text-[11px] text-discord-yellow">
                {w}
              </div>
            ))}
            {result.ok && (
              <div className="rounded border border-discord-green/40 bg-discord-green/10 p-2 text-xs text-discord-green">
                Valid — {result.components.length} top-level component
                {result.components.length === 1 ? '' : 's'} will load onto the canvas.
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={commit} disabled={!result?.ok}>
            Load onto canvas
          </Button>
        </div>
      </div>
    </Modal>
  );
}
