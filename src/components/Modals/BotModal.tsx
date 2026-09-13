import { useState } from 'react';
import type { BotIdentity } from '../../model/node';
import { Button, Field, TextInput } from '../ui/primitives';
import { Modal } from './Modal';

export function BotModal({
  onClose,
  bot,
  onSave,
}: {
  onClose: () => void;
  bot: BotIdentity;
  onSave: (bot: BotIdentity) => void;
}) {
  const [username, setUsername] = useState(bot.username);
  const [avatarUrl, setAvatarUrl] = useState(bot.avatarUrl);
  return (
    <Modal title="Preview identity" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-discord-muted">
          Used for the preview header and for webhook test-sends (username/avatar_url overrides).
        </p>
        <Field label="Name">
          <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ean da b0t" />
        </Field>
        <Field label="Avatar URL" hint="optional">
          <TextInput value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave({ username, avatarUrl });
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
