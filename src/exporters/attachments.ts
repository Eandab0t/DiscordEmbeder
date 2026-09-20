import type { TopLevelComponent } from '../model/discord-components-v2-schema';

/** attachment:// references anywhere in the payload, in first-seen order. */
export function attachmentFileRefs(payload: TopLevelComponent[]): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  const walk = (data: Record<string, any>) => {
    const url: unknown = data.file?.url ?? data.media?.url;
    if (typeof url === 'string' && url.startsWith('attachment://') && !seen.has(url)) {
      seen.add(url);
      refs.push(url.slice('attachment://'.length));
    }
    (data.components as Record<string, any>[] | undefined)?.forEach(walk);
    (data.items as Record<string, any>[] | undefined)?.forEach(walk);
    if (data.accessory) walk(data.accessory);
  };
  payload.forEach(walk);
  return refs;
}
