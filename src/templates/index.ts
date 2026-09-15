import {
  ButtonStyle,
  ComponentType,
  IS_COMPONENTS_V2,
  SeparatorSpacing,
  type ComponentsV2Message,
} from '../model/discord-components-v2-schema';

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  glyph: string;
  /** 'starter' = minimal, good first pick; 'advanced' = showcases several component types. */
  complexity: 'starter' | 'advanced';
  message: ComponentsV2Message;
}

export const TEMPLATES: TemplateEntry[] = [
  {
    id: 'announcement',
    name: 'Announcement card',
    description: 'Accent-colored container with title text, details and a link button.',
    glyph: '📣',
    complexity: 'starter',
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
    complexity: 'advanced',
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
    complexity: 'advanced',
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
    complexity: 'starter',
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
  {
    id: 'event-invite',
    name: 'Event invite',
    description: 'Date/time card with an RSVP thumbnail and an attending toggle row.',
    glyph: '📅',
    complexity: 'starter',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.Container,
          accent_color: 0xfee75c,
          components: [
            {
              type: ComponentType.Section,
              components: [
                {
                  type: ComponentType.TextDisplay,
                  content: '# 📅 Community Game Night\n**Friday 8PM UTC** — Mario Kart, fall guys and whatever else wins the poll.\n-# RSVP below so we know team sizes.',
                },
              ],
              accessory: {
                type: ComponentType.Thumbnail,
                media: { url: 'https://i.imgur.com/AfFp7pu.png' },
                description: 'Game night artwork',
                spoiler: false,
              },
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Success,
                  label: "I'm in!",
                  custom_id: 'event_rsvp_yes',
                },
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Secondary,
                  label: 'Maybe',
                  custom_id: 'event_rsvp_maybe',
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'faq',
    name: 'FAQ card',
    description: 'Question-and-answer text blocks with a support button.',
    glyph: '❓',
    complexity: 'starter',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.Container,
          accent_color: 0x5865f2,
          components: [
            { type: ComponentType.TextDisplay, content: '## ❓ Frequently Asked' },
            { type: ComponentType.Separator, divider: true, spacing: SeparatorSpacing.Small },
            {
              type: ComponentType.TextDisplay,
              content: '**How do I get a role?**\nPick one in <#123456789012345678> and it applies instantly.',
            },
            {
              type: ComponentType.TextDisplay,
              content: '**Can I invite friends?**\nYes — invites are open, keep it to people who follow the rules.',
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Link,
                  label: 'Ask in support',
                  url: 'https://discord.com/discord',
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'rules-short',
    name: 'Short rules',
    description: 'Three-rule summary with an accent bar — the gentle version.',
    glyph: '📜',
    complexity: 'starter',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.Container,
          accent_color: 0xed4245,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: '## 📜 House Rules\n1. **Be decent.** No harassment, no hate.\n2. **Keep it legal.** ToS, DMCA, common sense.\n3. **Stay on topic.** Use the right channel.',
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Primary,
                  label: 'I agree',
                  custom_id: 'rules_agree',
                },
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Link,
                  label: 'Full policy',
                  url: 'https://discord.com/guidelines',
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'feedback-form',
    name: 'Feedback form',
    description: 'Intro text plus a rating select and an open-reply row.',
    glyph: '📝',
    complexity: 'advanced',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: '## 📝 Quick feedback\nTell us what you think — 30 seconds, honest answers only.',
        },
        {
          type: ComponentType.Container,
          accent_color: 0x57f287,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.StringSelect,
                  custom_id: 'feedback_rating',
                  placeholder: 'How would you rate the server?',
                  min_values: 1,
                  max_values: 1,
                  options: [
                    { label: '⭐ Amazing', value: '5', description: 'Best server ever' },
                    { label: '👍 Good', value: '4', description: 'Solid, keeps improving' },
                    { label: '😐 Okay', value: '3', description: 'It does the job' },
                    { label: '👎 Poor', value: '2', description: 'Needs real work' },
                  ],
                },
              ],
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.UserSelect,
                  custom_id: 'feedback_staff_shoutout',
                  placeholder: 'Shout out a helpful staff member',
                  min_values: 0,
                  max_values: 1,
                },
              ],
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Success,
              label: 'Submit',
              custom_id: 'feedback_submit',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'media-showcase',
    name: 'Media showcase',
    description: 'Four-image gallery with captions and a spoiler treat.',
    glyph: '🖼️',
    complexity: 'advanced',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.Container,
          accent_color: 0xeb459e,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: '## 🖼️ Community builds of the month\nVoted by you, rendered by the game.',
            },
            {
              type: ComponentType.MediaGallery,
              items: [
                { media: { url: 'https://i.imgur.com/AfFp7pu.png' }, description: 'First place build' },
                { media: { url: 'https://i.imgur.com/x7QzWGT.png' }, description: 'Second place build' },
                { media: { url: 'https://i.imgur.com/MoVZbeD.png' }, description: 'Third place build' },
                { media: { url: 'https://i.imgur.com/dJQm0yF.png' }, description: 'Secret bonus build', spoiler: true },
              ],
            },
            {
              type: ComponentType.TextDisplay,
              content: '-# One of these builders gets a custom role next month.',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'support-ticket',
    name: 'Support desk',
    description: 'Ticket opener with category select and priority buttons.',
    glyph: '🛟',
    complexity: 'advanced',
    message: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentType.Container,
          accent_color: 0x5865f2,
          components: [
            {
              type: ComponentType.Section,
              components: [
                {
                  type: ComponentType.TextDisplay,
                  content: '## 🛟 Need a human?\nOpen a ticket and pick a category — a moderator will join your channel within the hour.',
                },
              ],
              accessory: {
                type: ComponentType.Thumbnail,
                media: { url: 'https://i.imgur.com/dHi3bZq.png' },
                description: 'Support desk',
                spoiler: false,
              },
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.StringSelect,
                  custom_id: 'ticket_category',
                  placeholder: 'What do you need help with?',
                  min_values: 1,
                  max_values: 1,
                  options: [
                    { label: 'Account issue', value: 'account', emoji: { name: '👤' } },
                    { label: 'Bug report', value: 'bug', emoji: { name: '🐛' } },
                    { label: 'Report a member', value: 'report', emoji: { name: '🚨' } },
                    { label: 'Something else', value: 'other', emoji: { name: '💬' } },
                  ],
                },
              ],
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Danger,
                  label: 'Urgent',
                  custom_id: 'ticket_urgent',
                },
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Secondary,
                  label: 'Normal priority',
                  custom_id: 'ticket_normal',
                },
              ],
            },
          ],
        },
      ],
    },
  },
];
