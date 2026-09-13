// ---------------------------------------------------------------------------
// Canvas tree node — the editor's representation of a Discord component.
// `data` always matches the schema interfaces exactly (key order is preserved
// through JSON.stringify), so serializing nodes yields byte-perfect payloads.
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react';
import {
  ComponentType,
  type ActionRowComponent,
  type ButtonComponent,
  type ContainerComponent,
  type FileComponent,
  type MediaGalleryComponent,
  type SectionComponent,
  type SeparatorComponent,
  type StringSelectComponent,
  type ResolvedSelectComponent,
  type TextDisplayComponent,
  type ThumbnailComponent,
} from './discord-components-v2-schema';

/** Schema data shapes, tagged for discriminated-union narrowing on `type`. */
export type DiscordData =
  | ActionRowComponent
  | ButtonComponent
  | StringSelectComponent
  | ResolvedSelectComponent
  | SectionComponent
  | TextDisplayComponent
  | ThumbnailComponent
  | MediaGalleryComponent
  | FileComponent
  | SeparatorComponent
  | ContainerComponent;

export interface BaseNode {
  /** Stable per-node identity for editor operations. Never serialized. */
  readonly key: string;
  readonly type: ComponentType;
  data: DiscordData;
  /** Children for types governed by ALLOWED_CHILDREN (Container, Section, ActionRow). */
  children: ComponentNode[];
}

/** Sections keep their single accessory (button or thumbnail) in a dedicated slot. */
export interface SectionNode extends BaseNode {
  readonly type: ComponentType.Section;
  accessory: ComponentNode | null;
}

export type ComponentNode = BaseNode | SectionNode;

export function isSectionNode(n: ComponentNode): n is SectionNode {
  return n.type === ComponentType.Section;
}

export interface BotIdentity {
  /** Webhook username override. */
  username: string;
  /** Webhook avatar URL override. */
  avatarUrl: string;
}

export interface ProjectMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Full editor session — the shape of a saved project file. */
export interface ProjectSession {
  version: 1;
  metadata: ProjectMetadata;
  bot: BotIdentity;
  /** Top-level components, in order. */
  tree: ComponentNode[];
}

/** Small helper so panels can show a human label next to a node. */
export function nodeLabel(type: ComponentType): string {
  switch (type) {
    case ComponentType.ActionRow:
      return 'Action Row';
    case ComponentType.Button:
      return 'Button';
    case ComponentType.StringSelect:
      return 'String Select';
    case ComponentType.UserSelect:
      return 'User Select';
    case ComponentType.RoleSelect:
      return 'Role Select';
    case ComponentType.MentionableSelect:
      return 'Mentionable Select';
    case ComponentType.ChannelSelect:
      return 'Channel Select';
    case ComponentType.Section:
      return 'Section';
    case ComponentType.TextDisplay:
      return 'Text Display';
    case ComponentType.Thumbnail:
      return 'Thumbnail';
    case ComponentType.MediaGallery:
      return 'Media Gallery';
    case ComponentType.File:
      return 'File';
    case ComponentType.Separator:
      return 'Separator';
    case ComponentType.Container:
      return 'Container';
    default:
      return `Type ${type}`;
  }
}

/** Icon glyph per component type, used in palette + outline + header chips. */
export function nodeGlyph(type: ComponentType): ReactNode {
  switch (type) {
    case ComponentType.ActionRow:
      return '⬓';
    case ComponentType.Button:
      return '▭';
    case ComponentType.StringSelect:
    case ComponentType.UserSelect:
    case ComponentType.RoleSelect:
    case ComponentType.MentionableSelect:
    case ComponentType.ChannelSelect:
      return '▾';
    case ComponentType.Section:
      return '◫';
    case ComponentType.TextDisplay:
      return '¶';
    case ComponentType.Thumbnail:
      return '▣';
    case ComponentType.MediaGallery:
      return '▦';
    case ComponentType.File:
      return '📎';
    case ComponentType.Separator:
      return '—';
    case ComponentType.Container:
      return '▤';
    default:
      return '◻';
  }
}
