import type { Exporter } from './types';

/**
 * Emits a discord.js snippet that passes the raw payload object to
 * channel.send / interaction.reply. Raw object literals are used
 * deliberately: they match the REST payload exactly and don't depend on
 * which builder classes the installed discord.js version exposes.
 */
export const discordJsExporter: Exporter = {
  id: 'discordjs',
  label: 'discord.js',
  language: 'javascript',
  fileExtension: 'js',
  generate: (payload, context) => {
    const lines: string[] = [];
    lines.push('// discord.js — send Components V2 with the raw API payload.');
    lines.push('// Works on discord.js v14.16+ (Components V2 support).');
    lines.push("// const { MessageFlags } = require('discord.js');");
    lines.push('');
    lines.push('const payload = {');
    lines.push('  flags: MessageFlags.IsComponentsV2,');
    lines.push('  components: ' + jsValue(payload) + ',');
    lines.push('};');
    lines.push('');
    lines.push('await channel.send(payload);');
    if (context.bot.username || context.bot.avatarUrl) {
      lines.push('');
      lines.push('// Webhook variant (username/avatar live on the webhook execute call):');
      const override: Record<string, string> = {};
      if (context.bot.username) override.username = context.bot.username;
      if (context.bot.avatarUrl) override.avatar_url = context.bot.avatarUrl;
      lines.push(
        'await webhook.send({ ...payload, ' +
          Object.entries(override)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join(', ') +
          ' });',
      );
    }
    return lines.join('\n');
  },
};

function jsValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return String(value);
    case 'boolean':
      return String(value);
    case 'object': {
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => jsValue(v));
        // One line for short primitive arrays, else multiline.
        const inline = '[' + items.join(', ') + ']';
        if (inline.length <= 80 && items.every((i) => !i.includes('\n'))) return inline;
        return '[\n' + items.map((i) => '    ' + indentBlock(i)).join(',\n') + ',\n  ]';
      }
      const entries = Object.entries(value as Record<string, unknown>).filter(
        ([, v]) => v !== undefined,
      );
      if (entries.length === 0) return '{}';
      const inline =
        '{ ' +
        entries.map(([k, v]) => `${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k)}: ${jsValue(v)}`).join(', ') +
        ' }';
      if (inline.length <= 80 && !inline.includes('\n')) return inline;
      return (
        '{\n' +
        entries
          .map(([k, v]) => {
            const keyExpr = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
            return `    ${keyExpr}: ${indentBlock(jsValue(v))}`;
          })
          .join(',\n') +
        ',\n  }'
      );
    }
    default:
      return 'undefined';
  }
}

function indentBlock(text: string): string {
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? line : '  ' + line))
    .join('\n');
}


