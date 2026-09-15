import {
  ALLOWED_CHILDREN,
  ComponentType,
  IS_COMPONENTS_V2,
  SeparatorSpacing,
  type TopLevelComponent,
} from '../model/discord-components-v2-schema';
import type { ComponentNode, DiscordData } from '../model/node';
import { dataToNode } from '../model/tree';
import { isTopLevelLegal, SELECT_OPTIONS_CAP } from '../validation/rules';

export interface ImportResult {
  ok: boolean;
  components: TopLevelComponent[];
  nodes: ComponentNode[];
  errors: ImportError[];
  warnings: string[];
}

export interface ImportError {
  path: string;
  message: string;
}

const CONTAINER_CHILD_TYPES: ReadonlySet<number> = new Set(ALLOWED_CHILDREN[ComponentType.Container]);
const ACTION_ROW_CHILD_TYPES: ReadonlySet<number> = new Set(ALLOWED_CHILDREN[ComponentType.ActionRow]);

export function parsePayloadJson(text: string): ImportResult {
  const errors: ImportError[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      components: [],
      nodes: [],
      errors: [{ path: '$', message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` }],
      warnings,
    };
  }

  // Accept a bare components array, or an object with a components field.
  let componentsRaw: unknown;
  if (Array.isArray(parsed)) {
    componentsRaw = parsed;
    warnings.push(
      'Input was a bare component array — flags default to IS_COMPONENTS_V2 (32768).',
    );
  } else if (parsed && typeof parsed === 'object' && 'components' in parsed) {
    componentsRaw = (parsed as Record<string, unknown>).components;
    const flags = (parsed as Record<string, unknown>).flags;
    if (typeof flags === 'number' && (flags & IS_COMPONENTS_V2) === 0) {
      warnings.push(
        `Message flags (${flags}) do not include IS_COMPONENTS_V2 (32768) — the payload will not render as Components V2.`,
      );
    }
  } else {
    return {
      ok: false,
      components: [],
      nodes: [],
      errors: [
        {
          path: '$',
          message: 'Expected a Components V2 message object with a "components" array (or a bare array of components).',
        },
      ],
      warnings,
    };
  }

  if (!Array.isArray(componentsRaw) || componentsRaw.length === 0) {
    return {
      ok: false,
      components: [],
      nodes: [],
      errors: [
        {
          path: '$.components',
          message: 'Expected a non-empty array of components.',
        },
      ],
      warnings,
    };
  }

  const components: TopLevelComponent[] = [];
  const normalized: string[] = [];
  const stripped: string[] = [];
  componentsRaw.forEach((raw, i) => {
    const comp = validateComponent(normalizeClientAliases(raw, `$.components[${i}]`, normalized, stripped), `$.components[${i}]`, errors, true);
    if (comp) components.push(comp as TopLevelComponent);
  });
  if (normalized.length > 0) {
    warnings.push(
      `Normalized Discord client field names (customId → custom_id) at: ${normalized.slice(0, 5).join(', ')}${normalized.length > 5 ? ` — and ${normalized.length - 5} more` : ''}.`,
    );
  }
  if (stripped.length > 0) {
    warnings.push(
      `Stripped read-only client fields (string "id", media metadata) at: ${stripped.slice(0, 5).join(', ')}${stripped.length > 5 ? ` — and ${stripped.length - 5} more` : ''}.`,
    );
  }

  const nodes: ComponentNode[] = [];
  if (errors.length === 0) {
    for (const c of components) {
      try {
        nodes.push(dataToNode(JSON.parse(JSON.stringify(c)) as DiscordData));
      } catch (e) {
        errors.push({
          path: '$',
          message: `Failed to build canvas node: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
  }

  return { ok: errors.length === 0 && components.length > 0, components, nodes, errors, warnings };
}

/**
 * Message payloads captured from Discord's client (message dumps, copy-paste
 * from the app) differ from the send shape: `custom_id` is camelCase, `id`
 * holds read-only string paths like "0,2,1" (the API takes integer ids only),
 * and media objects carry read-only metadata (proxyUrl, loadingState, …).
 * Rewrite all of it to send-shape so round-tripping a dump yields a payload
 * Discord accepts.
 */
function normalizeClientAliases(raw: unknown, path: string, normalized: string[], stripped: string[]): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };
  if (typeof out.customId === 'string' && out.custom_id === undefined) {
    out.custom_id = out.customId;
    delete out.customId;
    normalized.push(path);
  }
  if (typeof out.id === 'string') {
    delete out.id;
    stripped.push(`${path}.id`);
  }
  for (const key of ['media', 'file'] as const) {
    const m = out[key];
    if (m && typeof m === 'object' && typeof (m as Record<string, unknown>).url === 'string') {
      out[key] = { url: (m as Record<string, unknown>).url };
      stripped.push(`${path}.${key}`);
    }
  }
  if (Array.isArray(out.components)) {
    out.components = out.components.map((c, i) => normalizeClientAliases(c, `${path}.components[${i}]`, normalized, stripped));
  }
  if (Array.isArray(out.items)) {
    out.items = out.items.map((c, i) => normalizeClientAliases(c, `${path}.items[${i}]`, normalized, stripped));
  }
  if (out.accessory && typeof out.accessory === 'object') {
    out.accessory = normalizeClientAliases(out.accessory, `${path}.accessory`, normalized, stripped);
  }
  return out;
}

function validateComponent(
  raw: unknown,
  path: string,
  errors: ImportError[],
  topLevel: boolean,
): DiscordData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ path, message: 'Expected a component object with a numeric "type".' });
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== 'number' || !Number.isInteger(type)) {
    errors.push({
      path,
      message: 'Missing or invalid "type" (expected an integer component type id).',
    });
    return null;
  }
  const typePath = `${path}.type`;
  if (topLevel && !isTopLevelLegal(type)) {
    errors.push({
      path: typePath,
      message:
        type === ComponentType.Button || type === ComponentType.Thumbnail
          ? 'This type only exists inside a Section (as accessory) or Action Row — it can’t be top-level.'
          : `Component type ${type} can’t be used at the top level (or is unknown).`,
    });
    return null;
  }

  switch (type) {
    case ComponentType.TextDisplay: {
      if (typeof obj.content !== 'string') {
        errors.push({ path: `${path}.content`, message: 'Text Display requires string "content".' });
        return null;
      }
      return obj as unknown as DiscordData;
    }
    case ComponentType.Container: {
      if (!Array.isArray(obj.components)) {
        errors.push({ path: `${path}.components`, message: 'Container requires a "components" array.' });
        return null;
      }
      const kids: unknown[] = [];
      obj.components.forEach((child, i) => {
        const childPath = `${path}.components[${i}]`;
        const ct = (child as Record<string, unknown> | null)?.type;
        if (typeof ct === 'number' && !CONTAINER_CHILD_TYPES.has(ct)) {
          errors.push({
            path: `${childPath}.type`,
            message: `Type ${ct} can’t be a direct child of a Container.`,
          });
          return;
        }
        const validated = validateComponent(child, childPath, errors, false);
        if (validated) kids.push(validated);
      });
      return { ...obj, components: kids } as unknown as DiscordData;
    }
    case ComponentType.Section: {
      if (!Array.isArray(obj.components)) {
        errors.push({
          path: `${path}.components`,
          message: 'Section requires a "components" array of Text Displays.',
        });
        return null;
      }
      if (obj.components.length < 1 || obj.components.length > 3) {
        errors.push({
          path: `${path}.components`,
          message: `Section must hold 1–3 Text Displays (got ${obj.components.length}).`,
        });
      }
      const kids: unknown[] = [];
      obj.components.forEach((child, i) => {
        const validated = validateComponent(child, `${path}.components[${i}]`, errors, false);
        if (validated) kids.push(validated);
      });
      let accessory: unknown = undefined;
      if (obj.accessory === undefined || obj.accessory === null) {
        errors.push({
          path: `${path}.accessory`,
          message: 'Section requires an accessory (button or thumbnail).',
        });
      } else {
        const at = (obj.accessory as Record<string, unknown>).type;
        if (at !== ComponentType.Button && at !== ComponentType.Thumbnail) {
          errors.push({
            path: `${path}.accessory.type`,
            message: 'Section accessory must be a Button (2) or Thumbnail (11).',
          });
        } else {
          accessory = validateComponent(obj.accessory, `${path}.accessory`, errors, false);
        }
      }
      return { ...obj, components: kids, accessory } as unknown as DiscordData;
    }
    case ComponentType.ActionRow: {
      if (!Array.isArray(obj.components)) {
        errors.push({ path: `${path}.components`, message: 'Action Row requires a "components" array.' });
        return null;
      }
      const kids: unknown[] = [];
      obj.components.forEach((child, i) => {
        const childPath = `${path}.components[${i}]`;
        const ct = (child as Record<string, unknown> | null)?.type;
        if (typeof ct === 'number' && !ACTION_ROW_CHILD_TYPES.has(ct)) {
          errors.push({
            path: `${childPath}.type`,
            message: `Type ${ct} can’t be a direct child of an Action Row.`,
          });
          return;
        }
        const validated = validateComponent(child, childPath, errors, false);
        if (validated) kids.push(validated);
      });
      const selects = kids.filter(
        (k) =>
          typeof (k as Record<string, unknown>).type === 'number' &&
          (k as Record<string, unknown>).type !== ComponentType.Button,
      );
      if (selects.length > 0 && kids.length > 1) {
        errors.push({
          path: `${path}.components`,
          message: 'An Action Row with a select menu must contain exactly that one select.',
        });
      }
      if (kids.length > 5) {
        errors.push({
          path: `${path}.components`,
          message: 'Action Row holds at most 5 components.',
        });
      }
      return { ...obj, components: kids } as unknown as DiscordData;
    }
    case ComponentType.Button: {
      const style = obj.style;
      if (typeof style !== 'number') {
        errors.push({ path: `${path}.style`, message: 'Button requires a numeric "style".' });
        return null;
      }
      if (style === 5) {
        if (typeof obj.url !== 'string' || !obj.url) {
          errors.push({ path: `${path}.url`, message: 'Link buttons (style 5) require a "url".' });
        }
      } else if (typeof obj.custom_id !== 'string' || !obj.custom_id) {
        errors.push({ path: `${path}.custom_id`, message: 'Non-link buttons need a "custom_id".' });
      }
      if (!obj.label && !obj.emoji) {
        errors.push({ path, message: 'Button requires a "label" or an "emoji".' });
      }
      return obj as unknown as DiscordData;
    }
    case ComponentType.StringSelect: {
      if (typeof obj.custom_id !== 'string' || !obj.custom_id) {
        errors.push({ path: `${path}.custom_id`, message: 'String Select requires a "custom_id".' });
      }
      if (!Array.isArray(obj.options) || obj.options.length === 0) {
        errors.push({
          path: `${path}.options`,
          message: 'String Select requires a non-empty "options" array.',
        });
      } else if (obj.options.length > SELECT_OPTIONS_CAP) {
        errors.push({
          path: `${path}.options`,
          message: `String Select holds at most ${SELECT_OPTIONS_CAP} options (got ${obj.options.length}).`,
        });
      }
      return obj as unknown as DiscordData;
    }
    case ComponentType.UserSelect:
    case ComponentType.RoleSelect:
    case ComponentType.MentionableSelect:
    case ComponentType.ChannelSelect: {
      if (typeof obj.custom_id !== 'string' || !obj.custom_id) {
        errors.push({ path: `${path}.custom_id`, message: 'Select menus require a "custom_id".' });
      }
      return obj as unknown as DiscordData;
    }
    case ComponentType.Thumbnail: {
      if (!isUnfurled(obj.media)) {
        errors.push({ path: `${path}.media`, message: 'Thumbnail requires "media": { "url": string }.' });
        return null;
      }
      return obj as unknown as DiscordData;
    }
    case ComponentType.MediaGallery: {
      if (!Array.isArray(obj.items) || obj.items.length === 0) {
        errors.push({
          path: `${path}.items`,
          message: 'Media Gallery requires a non-empty "items" array.',
        });
        return null;
      }
      if (obj.items.length > 10) {
        errors.push({
          path: `${path}.items`,
          message: `Media Gallery holds at most 10 items (got ${obj.items.length}).`,
        });
      }
      obj.items.forEach((item, i) => {
        if (!isUnfurled((item as Record<string, unknown> | null)?.media)) {
          errors.push({
            path: `${path}.items[${i}].media`,
            message: 'Each gallery item requires "media": { "url": string }.',
          });
        }
      });
      return obj as unknown as DiscordData;
    }
    case ComponentType.File: {
      if (!isUnfurled(obj.file)) {
        errors.push({ path: `${path}.file`, message: 'File requires "file": { "url": "attachment://..." }.' });
        return null;
      }
      if (!/^attachment:\/\//i.test((obj.file as { url: string }).url)) {
        errors.push({ path: `${path}.file.url`, message: 'File URL must be attachment://filename.ext.' });
      }
      return obj as unknown as DiscordData;
    }
    case ComponentType.Separator: {
      if (obj.spacing !== undefined && obj.spacing !== SeparatorSpacing.Small && obj.spacing !== SeparatorSpacing.Large) {
        errors.push({
          path: `${path}.spacing`,
          message: `Separator spacing must be ${SeparatorSpacing.Small} (small) or ${SeparatorSpacing.Large} (large).`,
        });
      }
      return obj as unknown as DiscordData;
    }
    default:
      errors.push({ path: typePath, message: `Unknown component type ${type}.` });
      return null;
  }
}

function isUnfurled(value: unknown): value is { url: string } {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).url === 'string'
  );
}
