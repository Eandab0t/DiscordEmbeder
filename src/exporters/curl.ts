import type { Exporter } from './types';

/** curl exporter — proves the plugin surface: pure addition, no UI changes. */
export const curlExporter: Exporter = {
  id: 'curl',
  label: 'cURL',
  language: 'bash',
  fileExtension: 'sh',
  generate: (payload, context) => {
    const body = JSON.stringify({
      flags: context.flags,
      components: payload,
    });
    return [
      '# Replace $WEBHOOK_URL with your webhook URL.',
      '# Components V2 requires ?with_components=true on webhook execution.',
      `curl -X POST "$WEBHOOK_URL?with_components=true" \\`,
      '  -H "Content-Type: application/json" \\',
      `  -d '${body.replace(/'/g, `'\\''`)}'`,
    ].join('\n');
  },
};
