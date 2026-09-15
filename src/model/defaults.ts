import {
  ButtonStyle,
  ComponentType,
  SeparatorSpacing,
  type SelectOption,
} from './discord-components-v2-schema';
import type { DiscordData } from './node';

export interface PaletteItem {
  type: ComponentType;
  label: string;
  description: string;
  category: 'layout' | 'content' | 'interactive';
  /** Puzzle-piece colorway (Tailwind classes). */
  hue: string;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: ComponentType.Container,
    label: 'Container',
    description: 'Groups components in a box with an optional accent color',
    category: 'layout',
    hue: 'border-sky-500/60 bg-sky-500/10 text-sky-200',
  },
  {
    type: ComponentType.Section,
    label: 'Section',
    description: '1–3 text displays beside one button or thumbnail',
    category: 'layout',
    hue: 'border-violet-500/60 bg-violet-500/10 text-violet-200',
  },
  {
    type: ComponentType.TextDisplay,
    label: 'Text Display',
    description: 'Markdown text block',
    category: 'content',
    hue: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200',
  },
  {
    type: ComponentType.MediaGallery,
    label: 'Media Gallery',
    description: 'Grid of 1–10 images or videos',
    category: 'content',
    hue: 'border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-200',
  },
  {
    type: ComponentType.File,
    label: 'File',
    description: 'A single uploaded file card',
    category: 'content',
    hue: 'border-orange-500/60 bg-orange-500/10 text-orange-200',
  },
  {
    type: ComponentType.Separator,
    label: 'Separator',
    description: 'Spacing with an optional divider line',
    category: 'layout',
    hue: 'border-slate-400/60 bg-slate-400/10 text-slate-200',
  },
  {
    type: ComponentType.ActionRow,
    label: 'Action Row',
    description: 'Holds up to 5 buttons, or one select menu',
    category: 'layout',
    hue: 'border-blue-500/60 bg-blue-500/10 text-blue-200',
  },
  {
    type: ComponentType.Thumbnail,
    label: 'Thumbnail',
    description: 'Small image beside a Section\u2019s text (accessory)',
    category: 'content',
    hue: 'border-teal-500/60 bg-teal-500/10 text-teal-200',
  },
  {
    type: ComponentType.Button,
    label: 'Button',
    description: 'Clickable button (link or custom_id)',
    category: 'interactive',
    hue: 'border-rose-500/60 bg-rose-500/10 text-rose-200',
  },
  {
    type: ComponentType.StringSelect,
    label: 'String Select',
    description: 'Dropdown with custom options',
    category: 'interactive',
    hue: 'border-amber-500/60 bg-amber-500/10 text-amber-200',
  },
  {
    type: ComponentType.UserSelect,
    label: 'User Select',
    description: 'Pick users (Discord resolves options)',
    category: 'interactive',
    hue: 'border-amber-500/60 bg-amber-500/10 text-amber-200',
  },
  {
    type: ComponentType.RoleSelect,
    label: 'Role Select',
    description: 'Pick roles (Discord resolves options)',
    category: 'interactive',
    hue: 'border-amber-500/60 bg-amber-500/10 text-amber-200',
  },
  {
    type: ComponentType.MentionableSelect,
    label: 'Mentionable Select',
    description: 'Pick users or roles',
    category: 'interactive',
    hue: 'border-amber-500/60 bg-amber-500/10 text-amber-200',
  },
    {
      type: ComponentType.ChannelSelect,
      label: 'Channel Select',
      description: 'Pick channels, optionally filtered',
      category: 'interactive',
      hue: 'border-amber-500/60 bg-amber-500/10 text-amber-200',
    },
]

export const PALETTE_BY_TYPE: Partial<Record<ComponentType, PaletteItem>> = Object.fromEntries(
  PALETTE_ITEMS.map((p) => [p.type, p]),
);

/** Sensible defaults for each component type's schema data. */
export function createDefaultData(type: ComponentType): DiscordData {
  switch (type) {
    case ComponentType.Container:
      return {
        type: ComponentType.Container,
        components: [],
        accent_color: null,
        spoiler: false,
      };
    case ComponentType.Section:
      return { type: ComponentType.Section, components: [], accessory: undefined } as unknown as Extract<
        DiscordData,
        { type: ComponentType.Section }
      >;
    case ComponentType.TextDisplay:
      return {
        type: ComponentType.TextDisplay,
        content: 'Text with **markdown** support — https://discord.com',
      };
    case ComponentType.Thumbnail:
      return { type: ComponentType.Thumbnail, media: { url: 'https://i.imgur.com/AfFp7pu.png' }, spoiler: false };
    case ComponentType.MediaGallery:
      return {
        type: ComponentType.MediaGallery,
        items: [{ media: { url: 'https://i.imgur.com/AfFp7pu.png' } }],
      };
    case ComponentType.File:
      return { type: ComponentType.File, file: { url: 'attachment://example.pdf' }, spoiler: false };
    case ComponentType.Separator:
      return { type: ComponentType.Separator, divider: true, spacing: SeparatorSpacing.Small };
    case ComponentType.ActionRow:
      return { type: ComponentType.ActionRow, components: [] };
    case ComponentType.Button:
      return {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: 'Click me',
        custom_id: 'button_1',
      };
    case ComponentType.StringSelect:
      return {
        type: ComponentType.StringSelect,
        custom_id: 'select_1',
        options: [
          { label: 'Option 1', value: 'option_1', description: 'First option' },
          { label: 'Option 2', value: 'option_2' },
        ] as SelectOption[],
        placeholder: 'Make a selection',
        min_values: 1,
        max_values: 1,
      };
    case ComponentType.UserSelect:
      return { type: ComponentType.UserSelect, custom_id: 'user_select_1', placeholder: 'Select a user' };
    case ComponentType.RoleSelect:
      return { type: ComponentType.RoleSelect, custom_id: 'role_select_1', placeholder: 'Select a role' };
    case ComponentType.MentionableSelect:
      return {
        type: ComponentType.MentionableSelect,
        custom_id: 'mentionable_select_1',
        placeholder: 'Select a user or role',
      };
    case ComponentType.ChannelSelect:
      return {
        type: ComponentType.ChannelSelect,
        custom_id: 'channel_select_1',
        placeholder: 'Select a channel',
      };
    default:
      throw new Error(`No default data for component type ${type}`);
  }
}
