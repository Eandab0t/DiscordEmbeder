import { ButtonStyle, ComponentType, SeparatorSpacing } from '../model/discord-components-v2-schema';
import type { TopLevelComponent } from '../model/discord-components-v2-schema';
import { attachmentFileRefs } from './attachments';
import type { Exporter, ExportContext } from './types';

/**
 * Emits a discord.js v14.16+ snippet using the real Components V2 builder
 * classes (verified against the discord.js guide and typed docs):
 * ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 * MediaGalleryBuilder, MediaGalleryItemBuilder, FileBuilder, SeparatorBuilder,
 * ActionRowBuilder, ButtonBuilder, and the five select menu builders.
 *
 * emit() returns bare lines with no trailing punctuation; the caller appends
 * commas for argument/array contexts and closes its own parens.
 */
export const discordJsExporter: Exporter = {
  id: 'discordjs',
  label: 'discord.js',
  language: 'javascript',
  fileExtension: 'js',
  generate: (payload, context) => {
    const elements = payload.map((component) => withComma(emit(component, 1)).join('\n'));
    const body = elements.join('\n');
    const imports = wrapDestructure(USED.filter((name) => body.includes(name) || name === 'MessageFlags'));
    const lines = [
      '// discord.js v14.16+ — Components V2 via builder classes.',
      ...(imports ? [`const { ${imports} } = require('discord.js');`, ''] : []),
      'const components = [',
      body,
      '];',
      '',
      'await channel.send({',
      '  components,',
      '  flags: MessageFlags.IsComponentsV2,',
      '});',
    ];
    const fileRefs = attachmentFileRefs(payload);
    if (fileRefs.length > 0) {
      lines.push('', `// attachment:// references need matching files: [${fileRefs.map((f) => `'${f}'`).join(', ')}]`);
    }
    const kwargs: string[] = [];
    if (context.bot.username) kwargs.push(`username: ${JSON.stringify(context.bot.username)}`);
    if (context.bot.avatarUrl) kwargs.push(`avatar_url: ${JSON.stringify(context.bot.avatarUrl)}`);
    if (kwargs.length > 0) {
      lines.push('', '// Webhook variant:');
      lines.push(`await webhook.send({ components, flags: MessageFlags.IsComponentsV2, ${kwargs.join(', ')} });`);
    }
    return lines.join('\n');
  },
};

const USED = [
  'ContainerBuilder',
  'SectionBuilder',
  'TextDisplayBuilder',
  'ThumbnailBuilder',
  'MediaGalleryBuilder',
  'MediaGalleryItemBuilder',
  'FileBuilder',
  'SeparatorBuilder',
  'SeparatorSpacingSize',
  'ActionRowBuilder',
  'ButtonBuilder',
  'StringSelectMenuBuilder',
  'UserSelectMenuBuilder',
  'RoleSelectMenuBuilder',
  'MentionableSelectMenuBuilder',
  'ChannelSelectMenuBuilder',
  'ButtonStyle',
  'MessageFlags',
];

function wrapDestructure(names: string[]): string {
  if (names.length === 0) return '';
  const lines: string[] = [];
  let current = '';
  for (const name of names) {
    const next = current ? `${current}, ${name}` : name;
    if (next.length > 70 && current) {
      lines.push(current + ',');
      current = '  ' + name;
    } else {
      current = next;
    }
  }
  lines.push(current);
  return lines.join('\n');
}

/** Appends a comma to the last line (argument/array separator). */
function withComma(lines: string[]): string[] {
  lines[lines.length - 1] += ',';
  return lines;
}

const BUTTON_STYLES: Record<number, string> = {
  [ButtonStyle.Primary]: 'Primary',
  [ButtonStyle.Secondary]: 'Secondary',
  [ButtonStyle.Success]: 'Success',
  [ButtonStyle.Danger]: 'Danger',
  [ButtonStyle.Link]: 'Link',
};

const SELECT_BUILDERS: Record<number, string> = {
  [ComponentType.StringSelect]: 'StringSelectMenuBuilder',
  [ComponentType.UserSelect]: 'UserSelectMenuBuilder',
  [ComponentType.RoleSelect]: 'RoleSelectMenuBuilder',
  [ComponentType.MentionableSelect]: 'MentionableSelectMenuBuilder',
  [ComponentType.ChannelSelect]: 'ChannelSelectMenuBuilder',
};

const CONTAINER_ADD: Partial<Record<ComponentType, string>> = {
  [ComponentType.TextDisplay]: 'addTextDisplayComponents',
  [ComponentType.Section]: 'addSectionComponents',
  [ComponentType.MediaGallery]: 'addMediaGalleryComponents',
  [ComponentType.File]: 'addFileComponents',
  [ComponentType.Separator]: 'addSeparatorComponents',
  [ComponentType.ActionRow]: 'addActionRowComponents',
};

const ind = (depth: number) => '  '.repeat(depth);

/** One builder chain per call. Chain methods sit one level under `new`. */
function emit(data: Record<string, any>, depth: number): string[] {
  const out: string[] = [`${ind(depth)}new ${builderName(data.type)}()`];
  const call = (method: string, args = '') => out.push(`${ind(depth + 1)}.${method}(${args})`);
  // `.method(` + children + `)` — chain continues after the close.
  const wrap = (method: string, children: Record<string, any>[], extraDepth = 0) => {
    out.push(`${ind(depth + 1)}.${method}(`);
    for (const child of children) out.push(...withComma(emit(child, depth + 2 + extraDepth)));
    out.push(`${ind(depth + 1)})`);
  };

  switch (data.type) {
    case ComponentType.Container: {
      if (typeof data.accent_color === 'number') {
        call('setAccentColor', '0x' + data.accent_color.toString(16).padStart(6, '0'));
      }
      if (data.spoiler) call('setSpoiler', 'true');
      for (const child of data.components ?? []) {
        const method = CONTAINER_ADD[child.type as ComponentType];
        if (method) wrap(method, [child]);
      }
      return out;
    }
    case ComponentType.Section: {
      const texts = (data.components ?? []).filter((c: Record<string, any>) => c.type === ComponentType.TextDisplay);
      if (texts.length > 0) wrap('addTextDisplayComponents', texts);
      const acc = data.accessory;
      if (acc?.type === ComponentType.Button) wrap('setButtonAccessory', [acc]);
      else if (acc?.type === ComponentType.Thumbnail) wrap('setThumbnailAccessory', [acc]);
      return out;
    }
    case ComponentType.TextDisplay: {
      call('setContent', JSON.stringify(typeof data.content === 'string' ? data.content : ''));
      return out;
    }
    case ComponentType.Thumbnail: {
      call('setURL', JSON.stringify(String(data.media?.url ?? '')));
      if (data.description) call('setDescription', JSON.stringify(String(data.description)));
      if (data.spoiler) call('setSpoiler', 'true');
      return out;
    }
    case ComponentType.MediaGallery: {
      out.push(`${ind(depth + 1)}.addItems(`);
      for (const item of data.items ?? []) {
        const itemLines = [`${ind(depth + 2)}new MediaGalleryItemBuilder()`];
        itemLines.push(`${ind(depth + 3)}.setURL(${JSON.stringify(String(item.media?.url ?? ''))})`);
        if (item.description) {
          itemLines.push(`${ind(depth + 3)}.setDescription(${JSON.stringify(String(item.description))})`);
        }
        if (item.spoiler) itemLines.push(`${ind(depth + 3)}.setSpoiler(true)`);
        out.push(...withComma(itemLines));
      }
      out.push(`${ind(depth + 1)})`);
      return out;
    }
    case ComponentType.Separator: {
      if (data.divider === false) call('setDivider', 'false');
      if (typeof data.spacing === 'number') {
        call('setSpacing', `SeparatorSpacingSize.${SeparatorSpacing[data.spacing]}`);
      }
      return out;
    }
    case ComponentType.File: {
      call('setURL', JSON.stringify(String(data.file?.url ?? '')));
      if (data.spoiler) call('setSpoiler', 'true');
      return out;
    }
    case ComponentType.ActionRow: {
      const kids = data.components ?? [];
      if (kids.length > 0) wrap('addComponents', kids);
      return out;
    }
    case ComponentType.Button: {
      call('setLabel', JSON.stringify(String(data.label ?? '')));
      call('setStyle', `ButtonStyle.${BUTTON_STYLES[data.style] ?? 'Primary'}`);
      const emojiParts: string[] = [];
      if (data.emoji?.id) emojiParts.push(`id: ${JSON.stringify(String(data.emoji.id))}`);
      if (data.emoji?.name) emojiParts.push(`name: ${JSON.stringify(String(data.emoji.name))}`);
      if (data.emoji?.animated) emojiParts.push('animated: true');
      if (emojiParts.length > 0) call('setEmoji', `{ ${emojiParts.join(', ')} }`);
      if (data.style === ButtonStyle.Link) call('setURL', JSON.stringify(String(data.url ?? '')));
      else if (data.custom_id) call('setCustomId', JSON.stringify(String(data.custom_id)));
      if (data.disabled) call('setDisabled', 'true');
      return out;
    }
    default: {
      // Select menus: String/User/Role/Mentionable/Channel.
      call('setCustomId', JSON.stringify(String(data.custom_id ?? '')));
      if (data.placeholder) call('setPlaceholder', JSON.stringify(String(data.placeholder)));
      if (typeof data.min_values === 'number') call('setMinValues', String(data.min_values));
      if (typeof data.max_values === 'number') call('setMaxValues', String(data.max_values));
      if (data.disabled) call('setDisabled', 'true');
      if (Array.isArray(data.options) && data.options.length > 0) {
        // RestOrArray accepts a single array argument.
        call('addOptions', JSON.stringify(data.options));
      }
      return out;
    }
  }
}

function builderName(type: ComponentType): string {
  if (type === ComponentType.Container) return 'ContainerBuilder';
  if (type === ComponentType.Section) return 'SectionBuilder';
  if (type === ComponentType.TextDisplay) return 'TextDisplayBuilder';
  if (type === ComponentType.Thumbnail) return 'ThumbnailBuilder';
  if (type === ComponentType.MediaGallery) return 'MediaGalleryBuilder';
  if (type === ComponentType.Separator) return 'SeparatorBuilder';
  if (type === ComponentType.File) return 'FileBuilder';
  if (type === ComponentType.ActionRow) return 'ActionRowBuilder';
  if (type === ComponentType.Button) return 'ButtonBuilder';
  return SELECT_BUILDERS[type] ?? 'TextDisplayBuilder';
}
