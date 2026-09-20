import { ButtonStyle, ComponentType, SeparatorSpacing } from '../model/discord-components-v2-schema';
import type { TopLevelComponent } from '../model/discord-components-v2-schema';
import { attachmentFileRefs } from './attachments';
import type { Exporter } from './types';

/**
 * Emits a discord.py 2.6+ snippet using the real Components V2 surface
 * (verified against discord.py 2.6 source and its interactions API docs):
 * ui.LayoutView holding ui.Container / ui.Section / ui.TextDisplay /
 * ui.Thumbnail / ui.MediaGallery / ui.File / ui.Separator / ui.ActionRow
 * with ui.Button and the five select classes. channel.send(view=...) sets
 * the Components V2 flag itself; webhook sends go through webhook.send(view=...).
 *
 * emit() returns bare lines with no trailing punctuation; the caller appends
 * commas for argument contexts and closes its own parens.
 */
export const discordPyExporter: Exporter = {
  id: 'discordpy',
  label: 'discord.py',
  language: 'python',
  fileExtension: 'py',
  generate: (payload, context) => {
    const lines: string[] = [
      '# discord.py 2.6+ — Components V2 via ui.LayoutView.',
      'import discord',
      'from discord import ui',
      '',
      '',
      'def build_view() -> ui.LayoutView:',
      '    view = ui.LayoutView(timeout=None)',
    ];
    for (const component of payload) {
      lines.push('    view.add_item(');
      lines.push(...withComma(emit(component, 2)));
      lines.push('    )');
    }
    lines.push('    return view', '', '');
    lines.push('await channel.send(view=build_view())');
    const fileRefs = attachmentFileRefs(payload);
    if (fileRefs.length > 0) {
      lines.push('', `# attachment:// references need matching files: [${fileRefs.map((f) => `'${f}'`).join(', ')}]`);
    }
    const kwargs: string[] = [];
    if (context.bot.username) kwargs.push(`username=${pyString(context.bot.username)}`);
    if (context.bot.avatarUrl) kwargs.push(`avatar_url=${pyString(context.bot.avatarUrl)}`);
    if (kwargs.length > 0) {
      lines.push('', '# Webhook variant:');
      lines.push(`await webhook.send(view=build_view(), ${kwargs.join(', ')})`);
    }
    return lines.join('\n');
  },
};

/** Appends a comma to the last line (argument separator). */
function withComma(lines: string[]): string[] {
  lines[lines.length - 1] += ',';
  return lines;
}

const BUTTON_STYLES: Record<number, string> = {
  [ButtonStyle.Primary]: 'primary',
  [ButtonStyle.Secondary]: 'secondary',
  [ButtonStyle.Success]: 'success',
  [ButtonStyle.Danger]: 'danger',
  [ButtonStyle.Link]: 'link',
};

const SELECT_CLASSES: Record<number, string> = {
  [ComponentType.StringSelect]: 'Select',
  [ComponentType.UserSelect]: 'UserSelect',
  [ComponentType.RoleSelect]: 'RoleSelect',
  [ComponentType.MentionableSelect]: 'MentionableSelect',
  [ComponentType.ChannelSelect]: 'ChannelSelect',
};

const CHANNEL_TYPES: Record<number, string> = {
  0: 'text',
  1: 'private',
  2: 'voice',
  3: 'group',
  4: 'category',
  5: 'news',
  10: 'news_thread',
  11: 'public_thread',
  12: 'private_thread',
  13: 'stage_voice',
  15: 'forum',
  16: 'media',
};

const ind = (depth: number) => '    '.repeat(depth);

function pyString(value: string): string {
  return JSON.stringify(value);
}

function kv(fields: [string, string][]): string {
  return fields.map(([key, value]) => `${key}=${value}`).join(', ');
}

/** `"<a:name:id>"` for animated custom emoji, `"<:name:id>"` static, plain name for unicode. */
function emojiArg(emoji: { id?: string; name?: string; animated?: boolean } | undefined): string | null {
  if (!emoji) return null;
  if (emoji.id) return pyString(`<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`);
  if (emoji.name) return pyString(emoji.name);
  return null;
}

function pyButtonArgs(data: Record<string, any>): string {
  const fields: [string, string][] = [];
  if (data.label) fields.push(['label', pyString(String(data.label))]);
  fields.push(['style', `discord.ButtonStyle.${BUTTON_STYLES[data.style] ?? 'primary'}`]);
  const emoji = emojiArg(data.emoji);
  if (emoji) fields.push(['emoji', emoji]);
  if (data.style === ButtonStyle.Link) fields.push(['url', pyString(String(data.url ?? ''))]);
  else if (data.custom_id) fields.push(['custom_id', pyString(String(data.custom_id))]);
  if (data.disabled) fields.push(['disabled', 'True']);
  return kv(fields);
}

/** Emits one ui.* expression (no trailing punctuation, parens balanced). */
function emit(data: Record<string, any>, depth: number): string[] {
  const out: string[] = [];
  const open = (expr: string) => out.push(`${ind(depth)}${expr}`);
  const close = () => out.push(`${ind(depth)})`);
  const childLines = (child: Record<string, any>) => out.push(...withComma(emit(child, depth + 1)));

  switch (data.type) {
    case ComponentType.Container: {
      open('ui.Container(');
      for (const child of data.components ?? []) childLines(child);
      // Python kwargs follow positionals.
      if (typeof data.accent_color === 'number') {
        out.push(`${ind(depth + 1)}accent_colour=0x${data.accent_color.toString(16).padStart(6, '0')},`);
      }
      if (data.spoiler) out.push(`${ind(depth + 1)}spoiler=True,`);
      close();
      return out;
    }
    case ComponentType.Section: {
      open('ui.Section(');
      for (const child of data.components ?? []) {
        if (child.type === ComponentType.TextDisplay) childLines(child);
      }
      const acc = data.accessory;
      if (acc?.type === ComponentType.Thumbnail) {
        out.push(`${ind(depth + 1)}accessory=${emit(acc, 0)[0].trim()},`);
      } else if (acc?.type === ComponentType.Button) {
        out.push(`${ind(depth + 1)}accessory=ui.Button(${pyButtonArgs(acc)}),`);
      }
      close();
      return out;
    }
    case ComponentType.TextDisplay: {
      open(`ui.TextDisplay(${pyString(typeof data.content === 'string' ? data.content : '')})`);
      return out;
    }
    case ComponentType.Thumbnail: {
      const fields: [string, string][] = [];
      if (data.description) fields.push(['description', pyString(String(data.description))]);
      if (data.spoiler) fields.push(['spoiler', 'True']);
      const tail = fields.length ? `, ${kv(fields)}` : '';
      open(`ui.Thumbnail(${pyString(String(data.media?.url ?? ''))}${tail})`);
      return out;
    }
    case ComponentType.MediaGallery: {
      open('ui.MediaGallery(');
      for (const item of data.items ?? []) {
        const fields: [string, string][] = [];
        if (item.description) fields.push(['description', pyString(String(item.description))]);
        if (item.spoiler) fields.push(['spoiler', 'True']);
        const tail = fields.length ? `, ${kv(fields)}` : '';
        out.push(`${ind(depth + 1)}discord.MediaGalleryItem(${pyString(String(item.media?.url ?? ''))}${tail}),`);
      }
      close();
      return out;
    }
    case ComponentType.Separator: {
      const fields: [string, string][] = [];
      if (data.divider === false) fields.push(['visible', 'False']);
      if (typeof data.spacing === 'number') {
        fields.push(['spacing', `discord.SeparatorSpacing.${SeparatorSpacing[data.spacing].toLowerCase()}`]);
      }
      open(`ui.Separator(${kv(fields)})`);
      return out;
    }
    case ComponentType.File: {
      const tail = data.spoiler ? ', spoiler=True' : '';
      open(`ui.File(${pyString(String(data.file?.url ?? ''))}${tail})`);
      return out;
    }
    case ComponentType.ActionRow: {
      open('ui.ActionRow(');
      for (const child of data.components ?? []) {
        if (child.type === ComponentType.Button) {
          out.push(`${ind(depth + 1)}ui.Button(${pyButtonArgs(child)}),`);
        } else {
          childLines(child);
        }
      }
      close();
      return out;
    }
    case ComponentType.Button: {
      open(`ui.Button(${pyButtonArgs(data)})`);
      return out;
    }
    default: {
      // Select menus: String/User/Role/Mentionable/Channel — all-keyword.
      const cls = SELECT_CLASSES[data.type];
      if (!cls) return out;
      open(`ui.${cls}(`);
      const fields: [string, string][] = [['custom_id', pyString(String(data.custom_id ?? ''))]];
      if (data.placeholder) fields.push(['placeholder', pyString(String(data.placeholder))]);
      if (typeof data.min_values === 'number') fields.push(['min_values', String(data.min_values)]);
      if (typeof data.max_values === 'number') fields.push(['max_values', String(data.max_values)]);
      if (data.disabled) fields.push(['disabled', 'True']);
      for (const [key, value] of fields) out.push(`${ind(depth + 1)}${key}=${value},`);
      if (Array.isArray(data.channel_types) && data.channel_types.length > 0) {
        const names = data.channel_types.map((t: number) => `discord.ChannelType.${CHANNEL_TYPES[t] ?? t}`);
        out.push(`${ind(depth + 1)}channel_types=[${names.join(', ')}],`);
      }
      if (Array.isArray(data.options) && data.options.length > 0) {
        out.push(`${ind(depth + 1)}options=[`);
        for (const option of data.options) {
          const optFields: [string, string][] = [
            ['label', pyString(String(option.label ?? ''))],
            ['value', pyString(String(option.value ?? ''))],
          ];
          if (option.description) optFields.push(['description', pyString(String(option.description))]);
          const emoji = emojiArg(option.emoji);
          if (emoji) optFields.push(['emoji', emoji]);
          if (option.default) optFields.push(['default', 'True']);
          out.push(`${ind(depth + 2)}discord.SelectOption(${kv(optFields)}),`);
        }
        out.push(`${ind(depth + 1)}],`);
      }
      close();
      return out;
    }
  }
}
