import type { Exporter } from './types';

/**
 * Emits a discord.py snippet using the raw dict payload. discord.py's V2
 * builder surface has shifted across releases; raw dict literals always
 * match the REST API, so they are the safe default per project guardrails.
 */
export const discordPyExporter: Exporter = {
  id: 'discordpy',
  label: 'discord.py',
  language: 'python',
  fileExtension: 'py',
  generate: (payload, context) => {
    const lines: string[] = [];
    lines.push('# discord.py — send Components V2 with the raw API payload.');
    lines.push('# discord.py 2.4+ passes component dicts straight through.');
    lines.push('');
    lines.push('import asyncio');
    lines.push('import discord');
    lines.push('');
    lines.push('');
    lines.push('payload = {');
    lines.push('    "flags": discord.MessageFlags().IS_COMPONENTS_V2.value,');
    lines.push(`    "components": ${pyValue(payload)},`);
    lines.push('}');
    lines.push('');
    lines.push('flags = discord.MessageFlags().from_value(payload["flags"])');
    lines.push('');
    lines.push('');
    lines.push('async def main():');
    lines.push('    await channel.send(payload=payload, flags=flags)');
    if (context.bot.username || context.bot.avatarUrl) {
      lines.push('');
      lines.push('# Webhook variant (username/avatar live on the webhook execute call):');
      const kwargs: string[] = [];
      if (context.bot.username) kwargs.push(`username=${pyString(context.bot.username)}`);
      if (context.bot.avatarUrl) kwargs.push(`avatar_url=${pyString(context.bot.avatarUrl)}`);
      lines.push(`await webhook.send(**payload, ${kwargs.join(', ')})`);
    }
    lines.push('');
    lines.push('');
    lines.push('asyncio.run(main())');
    return lines.join('\n');
  },
};

function pyString(value: string): string {
  return JSON.stringify(value);
}

function pyValue(value: unknown): string {
  if (value === null) return 'None';
  if (value === undefined) return 'None';
  switch (typeof value) {
    case 'string':
      return pyString(value);
    case 'number':
      return String(value);
    case 'boolean':
      return value ? 'True' : 'False';
    case 'object': {
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pyValue(v));
        const inline = '[' + items.join(', ') + ']';
        if (inline.length <= 76 && items.every((i) => !i.includes('\n'))) return inline;
        return '[\n' + items.map((i) => '    ' + indentBlock(i)).join(',\n') + ',\n]';
      }
      const entries = Object.entries(value as Record<string, unknown>).filter(
        ([, v]) => v !== undefined,
      );
      if (entries.length === 0) return '{}';
      const inline =
        '{' +
        entries.map(([k, v]) => `${pyString(k)}: ${pyValue(v)}`).join(', ') +
        '}';
      if (inline.length <= 76 && !inline.includes('\n')) return inline;
      return (
        '{\n' +
        entries
          .map(([k, v]) => `    ${pyString(k)}: ${indentBlock(pyValue(v))}`)
          .join(',\n') +
        ',\n}'
      );
    }
    default:
      return 'None';
  }
}

function indentBlock(text: string): string {
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? line : '  ' + line))
    .join('\n');
}
