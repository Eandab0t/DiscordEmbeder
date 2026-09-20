import { useState } from 'react';
import { IS_COMPONENTS_V2 } from '../../model/discord-components-v2-schema';
import { buildPayload } from '../../model/tree';
import type { ComponentNode, BotIdentity } from '../../model/node';
import { Button, Field, TextInput } from '../ui/primitives';
import { Modal } from './Modal';

/** attachment:// references cannot be uploaded from the browser — Discord
 *  rejects the whole payload with 400 {"components":["…"]}. */
function attachmentRefs(tree: ComponentNode[]): string[] {
  const refs: string[] = [];
  const walk = (data: Record<string, unknown>) => {
    const url = (data.file as { url?: unknown } | undefined)?.url ?? (data.media as { url?: unknown } | undefined)?.url;
    if (typeof url === 'string' && url.startsWith('attachment://')) refs.push(url);
    for (const key of ['components', 'items'] as const) {
      ((data[key] as Record<string, unknown>[] | undefined) ?? []).forEach(walk);
    }
    if (data.accessory) walk(data.accessory as Record<string, unknown>);
  };
  tree.forEach((node) => walk(node.data as Record<string, unknown>));
  return [...new Set(refs)];
}

export function WebhookModal({
  onClose,
  initialUrl,
  tree,
  bot,
  onUrlChange,
}: {
  onClose: () => void;
  initialUrl: string;
  tree: ComponentNode[];
  bot: BotIdentity;
  onUrlChange: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const send = async () => {
    setStatus('sending');
    setMessage('');
    const trimmed = url.trim();
    if (!/^https:\/\/([a-z0-9-]+\.)*(discord|discordapp)\.com\/api\/webhooks\//i.test(trimmed)) {
      setStatus('error');
      setMessage('That doesn\'t look like a Discord webhook URL (expected https://discord.com/api/webhooks/…).');
      return;
    }
    const payload = {
      flags: IS_COMPONENTS_V2,
      components: buildPayload(tree),
    };
    if (bot.username) {
      Object.assign(payload, { username: bot.username });
    }
    if (bot.avatarUrl) {
      Object.assign(payload, { avatar_url: bot.avatarUrl });
    }
    try {
      const sep = trimmed.includes('?') ? '&' : '?';
      const res = await fetch(`${trimmed}${sep}with_components=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok || res.status === 204) {
        setStatus('ok');
        setMessage('Sent! Check the channel — this hit Discord\'s API directly from your browser.');
      } else {
        const body = (await res.text().catch(() => '')) ?? '';
        let detail = '';
        try {
          const parsed = JSON.parse(body) as { message?: string; [key: string]: unknown };
          detail = parsed.message ?? JSON.stringify(parsed);
        } catch {
          detail = body || res.statusText;
        }
        setStatus('error');
        setMessage(`Discord returned ${res.status}: ${detail || 'request failed'}`);
      }
    } catch (e) {
      setStatus('error');
      setMessage(
        `Network request failed: ${e instanceof Error ? e.message : String(e)} (CORS or offline?)`,
      );
    }
  };

  return (
    <Modal title="Send test message" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="rounded border border-discord-yellow/40 bg-discord-yellow/10 p-2 text-[11px] leading-relaxed text-discord-yellow">
          This performs a real <code>POST</code> to Discord's API straight from your browser using
          the webhook URL you provide. The URL stays in your browser (autosaved locally) — nothing
          is sent anywhere else.
        </div>
        <Field label="Webhook URL" hint="?with_components=true is appended automatically">
          <TextInput
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              onUrlChange(e.target.value);
            }}
            placeholder="https://discord.com/api/webhooks/…"
          />
        </Field>
        {attachmentRefs(tree).length > 0 && (
          <div className="rounded border border-discord-yellow/40 bg-discord-yellow/10 p-2 text-[11px] leading-relaxed text-discord-yellow">
            This message references uploaded files ({attachmentRefs(tree).join(', ')}). A browser test
            send can't attach files, so Discord will reject it — remove the File/Thumbnail/Gallery
            attachment:// references or send through your bot instead.
          </div>
        )}
        {message && (
          <div
            className={`rounded border p-2 text-xs ${
              status === 'ok'
                ? 'border-discord-green/40 bg-discord-green/10 text-discord-green'
                : 'border-discord-red/40 bg-discord-red/10 text-discord-red'
            }`}
          >
            {message}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => void send()} disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send test message'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
