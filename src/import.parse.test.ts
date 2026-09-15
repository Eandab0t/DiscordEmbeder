import { describe, expect, it } from 'vitest';
import { parsePayloadJson } from './import/parse';
import { IS_COMPONENTS_V2 } from './model/discord-components-v2-schema';

/**
 * Shapes taken from real Discord message dumps (ReferenceSources/, gitignored
 * — payloads are inlined here so CI has them): forwarded messages park the
 * real payload in message_snapshots[0].message, and client dumps serialize
 * custom_id as customId with read-only string ids and media metadata.
 */
const FORWARDED = JSON.stringify({
  flags: 16384,
  components: [],
  message_snapshots: [
    {
      message: {
        flags: IS_COMPONENTS_V2,
        components: [
          { type: 10, content: 'forwarded body' },
          {
            type: 9,
            components: [{ type: 10, content: 'with accessory' }],
            accessory: { type: 11, media: { url: 'https://example.com/t.png' } },
          },
        ],
      },
    },
  ],
});

const CLIENT_DUMP = JSON.stringify({
  flags: IS_COMPONENTS_V2,
  components: [
    {
      type: 1,
      id: '1',
      components: [
        {
          type: 2,
          id: '1,0',
          customId: 'bcf4a392b3e6fe08f557e194a2b8ce33',
          style: 1,
          label: 'Link Minecraft Account',
        },
      ],
    },
    {
      type: 12,
      id: '0,0',
      items: [
        {
          media: {
            url: 'https://example.com/banner.png',
            proxyUrl: 'https://images-ext-1.discordapp.net/external/x',
            width: 2048,
            height: 901,
            loadingState: 2,
            contentScanMetadata: { version: 4, flags: 0 },
          },
          spoiler: false,
        },
      ],
    },
  ],
});

describe('import: forwarded-message snapshots', () => {
  it('unwraps message_snapshots[0].message when the outer message has no components', () => {
    const r = parsePayloadJson(FORWARDED);
    expect(r.ok).toBe(true);
    expect(r.components).toHaveLength(2);
    expect(r.warnings.some((w) => /forwarded/i.test(w))).toBe(true);
  });

  it('ignores snapshots when the outer message has real components', () => {
    const r = parsePayloadJson(
      JSON.stringify({
        flags: IS_COMPONENTS_V2,
        components: [{ type: 10, content: 'the real body' }],
        message_snapshots: [{ message: { flags: IS_COMPONENTS_V2, components: [{ type: 10, content: 'stale' }] } }],
      }),
    );
    expect(r.ok).toBe(true);
    expect((r.components[0] as { content: string }).content).toBe('the real body');
    expect(r.warnings.some((w) => /forwarded/i.test(w))).toBe(false);
  });

  it('still fails cleanly when neither level has components', () => {
    const r = parsePayloadJson(
      JSON.stringify({ flags: 16384, components: [], message_snapshots: [{ message: { flags: IS_COMPONENTS_V2, components: [] } }] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /non-empty array/.test(e.message))).toBe(true);
  });
});

describe('import: client-dump normalization', () => {
  it('rewrites customId, strips string ids and media metadata, warns with paths', () => {
    const r = parsePayloadJson(CLIENT_DUMP);
    expect(r.ok).toBe(true);
    const [row, gallery] = r.components as [
      { components: Record<string, unknown>[] },
      { items: { media: Record<string, unknown> }[] },
    ];
    const button = row.components[0];
    expect(button.custom_id).toBe('bcf4a392b3e6fe08f557e194a2b8ce33');
    expect(button.customId).toBeUndefined();
    expect(button.id).toBeUndefined();
    expect(gallery.items[0].media).toEqual({ url: 'https://example.com/banner.png' });
    expect(r.warnings.some((w) => /customId/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /Stripped/.test(w) && /\.id/.test(w))).toBe(true);
  });
});
