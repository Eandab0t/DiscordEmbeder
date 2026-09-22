import { useState } from 'react';
import { IS_COMPONENTS_V2 } from '../../model/discord-components-v2-schema';
import { buildPayload } from '../../model/tree';
import type { ComponentNode, BotIdentity } from '../../model/node';
import { useBuilderStore } from '../../store/useBuilderStore';
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

const WEBHOOK_URL_RE = /^https:\/\/([a-z0-9-]+\.)*(discord|discordapp)\.com\/api\/webhooks\//i;

/** The real POST. Returns a user-facing result line plus its ok flag. */
async function sendToDiscord(
  trimmed: string,
  payload: { flags: number; components: unknown; username?: string; avatar_url?: string },
): Promise<{ ok: boolean; detail: string }> {
  const sep = trimmed.includes('?') ? '&' : '?';
  const res = await fetch(`${trimmed}${sep}with_components=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok || res.status === 204) {
    return { ok: true, detail: 'Sent! Check the channel — this hit Discord\'s API directly from your browser.' };
  }
  const body = (await res.text().catch(() => '')) ?? '';
  let detail = '';
  try {
    const parsed = JSON.parse(body) as { message?: string; [key: string]: unknown };
    detail = parsed.message ?? JSON.stringify(parsed);
  } catch {
    detail = body || res.statusText;
  }
  return { ok: false, detail: `Discord returned ${res.status}: ${detail || 'request failed'}` };
}

function buildSendPayload(tree: ComponentNode[], bot: BotIdentity) {
  const payload: { flags: number; components: unknown; username?: string; avatar_url?: string } = {
    flags: IS_COMPONENTS_V2,
    components: buildPayload(tree),
  };
  if (bot.username) payload.username = bot.username;
  if (bot.avatarUrl) payload.avatar_url = bot.avatarUrl;
  return payload;
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
  const [presetName, setPresetName] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const presets = useBuilderStore((s) => s.webhookPresets);
  const attachmentWarning = attachmentRefs(tree).length > 0;

  const send = async () => {
    setStatus('sending');
    setMessage('');
    const trimmed = url.trim();
    if (!WEBHOOK_URL_RE.test(trimmed)) {
      setStatus('error');
      setMessage('That doesn\'t look like a Discord webhook URL (expected https://discord.com/api/webhooks/…).');
      return;
    }
    try {
      const result = await sendToDiscord(trimmed, buildSendPayload(tree, bot));
      setMessage(result.detail);
      setStatus(result.ok ? 'ok' : 'error');
    } catch (e) {
      setStatus('error');
      setMessage(
        `Network request failed: ${e instanceof Error ? e.message : String(e)} (CORS or offline?)`,
      );
    }
  };

  const resend = async (id: string, presetUrl: string) => {
    setResendingId(id);
    const record = useBuilderStore.getState().recordWebhookSend;
    try {
      const result = await sendToDiscord(presetUrl, buildSendPayload(tree, bot));
      record(id, result.ok, result.detail);
    } catch (e) {
      record(id, false, `Network request failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setResendingId(null);
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
        {attachmentWarning && (
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

        <div className="border-t border-white/10 pt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-discord-muted">
            Saved webhooks
          </div>
          {presets.length === 0 && url.trim() !== '' && (
            <div className="flex items-center gap-1.5">
              <TextInput
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Name (e.g. #announcements)"
                className="min-w-0 flex-1"
              />
              <Button
                onClick={() => {
                  const name = presetName.trim();
                  if (!name) return;
                  useBuilderStore.getState().saveWebhookPreset(name, url.trim());
                  setPresetName('');
                }}
              >
                Save
              </Button>
            </div>
          )}
          {presets.length > 0 && (
            <div className="flex flex-col gap-1">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-discord-text">{p.name}</div>
                    {p.lastSend && (
                      <div
                        className={`text-[10px] ${p.lastSend.ok ? 'text-discord-green' : 'text-discord-red'}`}
                      >
                        {p.lastSend.ok ? '✓' : '✗'}{' '}
                        {new Date(p.lastSend.at).toLocaleTimeString()} — {p.lastSend.detail}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => void resend(p.id, p.url)}
                    disabled={resendingId !== null || attachmentWarning}
                    title={attachmentWarning ? 'Resolve the attachment:// warning first' : undefined}
                  >
                    {resendingId === p.id ? '…' : 'Resend'}
                  </Button>
                  <button
                    onClick={() => useBuilderStore.getState().deleteWebhookPreset(p.id)}
                    className="text-discord-muted transition-colors hover:text-discord-red"
                    title="Delete preset"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
