import {
  ButtonStyle,
  ComponentType,
  IS_COMPONENTS_V2,
  SeparatorSpacing,
  type ComponentsV2Message,
} from '../model/discord-components-v2-schema';

export interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  glyph: string;
  message: ComponentsV2Message;
}

export const TEMPLATES: TemplateEntry[] = [
  {
    id: 'announcement',
    name: 'Announcement card',
    description: 'Accent-colored container with title text, details and a link button.',
    glyph: '📣',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.Container,
          accent_color: 0x5865f2,
          spoiler: false,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: '# 📣 Server Announcement\nWelcome to the new **Components V2** era — richer messages, cleaner layouts.',
            },
            {
              type: ComponentType.Separator,
              divider: true,
              spacing: SeparatorSpacing.Small,
            },
            {
              type: ComponentType.Section,
              components: [
                {
                  type: ComponentType.TextDisplay,
                  content: 'Read the full changelog to see everything that shipped this week, from layout components to media galleries.',
                },
              ],
              accessory: {
                type: ComponentType.Thumbnail,
                media: { url: 'https://i.imgur.com/AfFp7pu.png' },
                description: 'Announcement artwork',
                spoiler: false,
              },
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Link,
                  label: 'Open changelog',
                  url: 'https://discord.com/developers/docs/components/reference',
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'patch-notes',
    name: 'Patch notes',
    description: 'Versioned notes with sections, separators and reaction buttons.',
    glyph: '🛠️',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: '# 🛠️ Patch 2.4.1\nEverything new since the last build.',
        },
        {
          type: ComponentType.Separator,
          divider: true,
          spacing: SeparatorSpacing.Large,
        },
        {
          type: ComponentType.Container,
          accent_color: 0x57f287,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: '## ✨ Added\n- Media Gallery layouts\n- Spoiler support on files\n',
            },
            {
              type: ComponentType.TextDisplay,
              content: '## 🔧 Fixed\n- Drag handles now hit their targets\n- Exporter edge cases with emoji',
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Success,
              label: 'Looks good',
              custom_id: 'patch_ack_ok',
            },
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: 'Found a bug',
              custom_id: 'patch_ack_bug',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'release',
    name: 'New release card',
    description: 'Release highlight with thumbnail, downloads row and select.',
    glyph: '🚀',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.Container,
          accent_color: 0xeb459e,
          components: [
            {
              type: ComponentType.Section,
              components: [
                {
                  type: ComponentType.TextDisplay,
                  content: '## 🚀 v1.0.0 — First stable\nThe builder is out of beta. Export to JSON, discord.js or discord.py in one click.',
                },
              ],
              accessory: {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                label: 'Download',
                url: 'https://github.com',
              },
            },
            {
              type: ComponentType.Separator,
              divider: true,
              spacing: SeparatorSpacing.Small,
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.StringSelect,
                  custom_id: 'release_platform',
                  placeholder: 'Choose your platform',
                  min_values: 1,
                  max_values: 1,
                  options: [
                    { label: 'Windows', value: 'win', description: 'Windows 10/11 installer', emoji: { name: '🪟' } },
                    { label: 'macOS', value: 'mac', description: 'Universal binary', emoji: { name: '🍎' } },
                    { label: 'Linux', value: 'linux', description: 'AppImage + tarball', emoji: { name: '🐧' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'welcome',
    name: 'Simple welcome',
    description: 'Minimal welcome text with a rules link — great starting point.',
    glyph: '👋',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: '# 👋 Welcome!\nGlad to have you here. Grab a role, say hi, and check the rules.',
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Primary,
              label: 'Introduce yourself',
              custom_id: 'welcome_intro',
            },
            {
              type: ComponentType.Button,
              style: ButtonStyle.Link,
              label: 'Rules',
              url: 'https://discord.com',
            },
          ],
        },
      ],
    },
  },
];
