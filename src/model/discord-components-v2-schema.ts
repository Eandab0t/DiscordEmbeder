/**
 * Discord Message Components V2 — canonical TypeScript data model
 *
 * Source of truth: https://docs.discord.com/developers/components/reference
 * Verified against Discord's official docs: September 2026.
 *
 * Use this file as the single shared schema between:
 *  - the visual canvas/editor (this IS what a node "on the canvas" looks like)
 *  - the JSON exporter (this tree serializes directly to Discord's payload shape)
 *  - the discord.js / discord.py / other code generators (read this tree, emit code)
 *
 * If Discord has changed anything here since Sept 2026, the reference URL above
 * is the place to re-check before diverging from this file.
 */

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

/** Set this on message.flags to opt a message into Components V2.
 *  Once a message is sent with this flag, it cannot be removed from it. */
export const IS_COMPONENTS_V2 = 1 << 15; // 32768

/** Hard ceiling from Discord: total components in a message, counted
 *  recursively through all nesting. */
export const MAX_TOTAL_COMPONENTS = 40;

// ---------------------------------------------------------------------------
// Component type IDs (exact numbering from Discord's official reference)
// ---------------------------------------------------------------------------

export enum ComponentType {
  ActionRow = 1,
  Button = 2,
  StringSelect = 3,
  TextInput = 4, // modal-only, not usable in messages
  UserSelect = 5,
  RoleSelect = 6,
  MentionableSelect = 7,
  ChannelSelect = 8,
  Section = 9, // V2 only
  TextDisplay = 10, // V2 only
  Thumbnail = 11, // V2 only
  MediaGallery = 12, // V2 only
  File = 13, // V2 only
  Separator = 14, // V2 only
  Container = 17, // V2 only
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface UnfurledMediaItem {
  /** Either a normal https:// URL, or `attachment://filename.ext` for a file
   *  uploaded alongside the message. */
  url: string;
}

export interface Emoji {
  id?: string;
  name?: string;
  animated?: boolean;
}

interface BaseComponent {
  type: ComponentType;
  /** Optional. Discord auto-assigns sequential ids if omitted; must be
   *  unique within the message if you do set it. */
  id?: number;
}

// ---------------------------------------------------------------------------
// Pre-V2 interactive components (still used *inside* V2 layouts)
// ---------------------------------------------------------------------------

export enum ButtonStyle {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Link = 5,
}

export interface ButtonComponent extends BaseComponent {
  type: ComponentType.Button;
  style: ButtonStyle;
  label?: string;
  emoji?: Emoji;
  /** Required unless style === Link. */
  custom_id?: string;
  /** Required if style === Link. */
  url?: string;
  disabled?: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: Emoji;
  default?: boolean;
}

export interface StringSelectComponent extends BaseComponent {
  type: ComponentType.StringSelect;
  custom_id: string;
  options: SelectOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
}

/** User/Role/Mentionable/Channel selects share this shape — Discord resolves
 *  the choices itself, so there's no `options` array. Add per-kind interfaces
 *  as needed; they only really differ by `type` and an optional
 *  `channel_types` filter on ChannelSelect. */
export interface ResolvedSelectComponent extends BaseComponent {
  type:
    | ComponentType.UserSelect
    | ComponentType.RoleSelect
    | ComponentType.MentionableSelect
    | ComponentType.ChannelSelect;
  custom_id: string;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
  channel_types?: number[]; // ChannelSelect only
}

export interface ActionRowComponent extends BaseComponent {
  type: ComponentType.ActionRow;
  /** Max 5 buttons, OR exactly 1 select menu of any kind. */
  components: (ButtonComponent | StringSelectComponent | ResolvedSelectComponent)[];
}

// ---------------------------------------------------------------------------
// V2 layout & content components
// ---------------------------------------------------------------------------

export interface TextDisplayComponent extends BaseComponent {
  type: ComponentType.TextDisplay;
  /** Markdown-formatted text. Commonly cited cap is ~4000 characters —
   *  re-verify against current docs before hard-coding this as a limit. */
  content: string;
}

export interface ThumbnailComponent extends BaseComponent {
  type: ComponentType.Thumbnail;
  media: UnfurledMediaItem;
  description?: string;
  spoiler?: boolean;
}

export interface MediaGalleryItem {
  media: UnfurledMediaItem;
  description?: string;
  spoiler?: boolean;
}

export interface MediaGalleryComponent extends BaseComponent {
  type: ComponentType.MediaGallery;
  /** 1–10 items. */
  items: MediaGalleryItem[];
}

export interface FileComponent extends BaseComponent {
  type: ComponentType.File;
  /** Must be `attachment://filename.ext`. */
  file: UnfurledMediaItem;
  spoiler?: boolean;
}

export enum SeparatorSpacing {
  Small = 1,
  Large = 2,
}

export interface SeparatorComponent extends BaseComponent {
  type: ComponentType.Separator;
  divider?: boolean;
  spacing?: SeparatorSpacing;
}

export interface SectionComponent extends BaseComponent {
  type: ComponentType.Section;
  /** 1–3 text displays. */
  components: TextDisplayComponent[];
  /** Exactly one accessory: a button, or a thumbnail. */
  accessory: ButtonComponent | ThumbnailComponent;
}

export type ContainerChild =
  | ActionRowComponent
  | SectionComponent
  | TextDisplayComponent
  | MediaGalleryComponent
  | FileComponent
  | SeparatorComponent;

export interface ContainerComponent extends BaseComponent {
  type: ComponentType.Container;
  components: ContainerChild[];
  /** RGB integer, same convention as embed color. */
  accent_color?: number | null;
  spoiler?: boolean;
}

// ---------------------------------------------------------------------------
// Top-level message
// ---------------------------------------------------------------------------

export type TopLevelComponent =
  | ContainerComponent
  | SectionComponent
  | TextDisplayComponent
  | MediaGalleryComponent
  | FileComponent
  | SeparatorComponent
  | ActionRowComponent;

export interface ComponentsV2Message {
  /** Must include IS_COMPONENTS_V2. */
  flags: number;
  /** Max 40 total, counted recursively across all nesting. */
  components: TopLevelComponent[];
}

// ---------------------------------------------------------------------------
// Nesting rules (for the canvas's drag-and-drop validation)
// ---------------------------------------------------------------------------

/** Which component types are legal direct children of each container-like
 *  type. Use this as the single source of truth for what the palette allows
 *  dropping where — don't duplicate this logic elsewhere. */
export const ALLOWED_CHILDREN: Partial<Record<ComponentType, ComponentType[]>> = {
  [ComponentType.Container]: [
    ComponentType.ActionRow,
    ComponentType.Section,
    ComponentType.TextDisplay,
    ComponentType.MediaGallery,
    ComponentType.File,
    ComponentType.Separator,
  ],
  [ComponentType.Section]: [ComponentType.TextDisplay], // + a single accessory field, handled separately
  [ComponentType.ActionRow]: [
    ComponentType.Button,
    ComponentType.StringSelect,
    ComponentType.UserSelect,
    ComponentType.RoleSelect,
    ComponentType.MentionableSelect,
    ComponentType.ChannelSelect,
  ],
};
