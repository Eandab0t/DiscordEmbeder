import { useState } from 'react';
import { ComponentType, SeparatorSpacing, ButtonStyle } from '../../model/discord-components-v2-schema';
import { isSectionNode, type BotIdentity, type ComponentNode } from '../../model/node';
import { Markdown } from './Markdown';

interface PreviewProps {
  tree: ComponentNode[];
  bot: BotIdentity;
}

export function Preview({ tree, bot }: PreviewProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-discord-base p-4">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex gap-4 rounded-lg p-1">
          <BotAvatar url={bot.avatarUrl} name={bot.username} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[15px] font-medium text-white">{bot.username || 'App'}</span>
              <span className="rounded bg-discord-accent px-1 py-px text-[10px] font-bold uppercase text-white">App</span>
              <span className="text-[11px] text-discord-muted">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {tree.length === 0 ? (
              <p className="text-sm italic text-discord-muted">Nothing to preview yet…</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {tree.map((node) => (
                  <PreviewNode key={node.key} node={node} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BotAvatar({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || 'A').trim().charAt(0).toUpperCase();
  if (!url || failed) {
    return (
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-discord-accent text-sm font-bold text-white">
        {initial}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-full object-cover"
    />
  );
}

function PreviewNode({ node }: { node: ComponentNode }) {
  switch (node.type) {
    case ComponentType.Container:
      return <ContainerPreview node={node} />;
    case ComponentType.Section:
      return <SectionPreview node={node} />;
    case ComponentType.TextDisplay:
      return <TextDisplayPreview node={node} />;
    case ComponentType.MediaGallery:
      return <GalleryPreview node={node} />;
    case ComponentType.File:
      return <FilePreview node={node} />;
    case ComponentType.Separator:
      return <SeparatorPreview node={node} />;
    case ComponentType.ActionRow:
      return <ActionRowPreview node={node} />;
    case ComponentType.Thumbnail:
      return <ThumbnailPreview node={node} />;
    default:
      return null;
  }
}

function ContainerPreview({ node }: { node: ComponentNode }) {
  const d = node.data as Extract<ComponentNode['data'], { type: ComponentType.Container }>;
  const accent = typeof d.accent_color === 'number' ? '#' + d.accent_color.toString(16).padStart(6, '0') : 'transparent';
  return (
    <div
      className={`overflow-hidden rounded-lg border border-discord-panel bg-discord-base-deep ${d.spoiler ? 'spoiler-blur' : ''}`}
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex flex-col gap-1.5 p-3">
        {node.children.length === 0 ? (
          <p className="text-xs italic text-discord-muted">Empty container</p>
        ) : (
          node.children.map((c) => <PreviewNode key={c.key} node={c} />)
        )}
      </div>
    </div>
  );
}

function SectionPreview({ node }: { node: ComponentNode }) {
  const accessory = isSectionNode(node) ? node.accessory : null;
  return (
    <div className="flex gap-3">
      <div className="min-w-0 flex-1">
        {node.children.length === 0 ? (
          <p className="text-xs italic text-discord-muted">Empty section</p>
        ) : (
          node.children.map((c) => <PreviewNode key={c.key} node={c} />)
        )}
      </div>
      {accessory && <PreviewNode node={accessory} />}
    </div>
  );
}

function TextDisplayPreview({ node }: { node: ComponentNode }) {
  const d = node.data as Extract<ComponentNode['data'], { type: ComponentType.TextDisplay }>;
  if (!d.content.trim()) {
    return <p className="text-xs italic text-discord-muted">(empty text)</p>;
  }
  return (
    <div className="text-[15px] leading-[1.375] text-discord-text">
      <Markdown text={d.content} />
    </div>
  );
}

function ThumbnailPreview({ node }: { node: ComponentNode }) {
  const d = node.data as Extract<ComponentNode['data'], { type: ComponentType.Thumbnail }>;
  const url = d.media?.url;
  return (
    <div
      className={`h-20 w-20 shrink-0 overflow-hidden rounded-md border border-discord-panel bg-discord-panel ${d.spoiler ? 'spoiler-blur' : ''}`}
      title={d.description ?? undefined}
    >
      {url ? (
        <img
          src={url}
          alt={d.description ?? ''}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            img.parentElement?.setAttribute('data-img-error', '');
          }}
        />
      ) : (
        <div className="grid h-full place-items-center text-[10px] text-discord-muted">no URL</div>
      )}
    </div>
  );
}

function GalleryPreview({ node }: { node: ComponentNode }) {
  const d = node.data as Extract<ComponentNode['data'], { type: ComponentType.MediaGallery }>;
  const items = d.items ?? [];
  if (items.length === 0) return null;
  const gridCols =
    items.length === 1
      ? 'grid-cols-1'
      : items.length === 2 || items.length === 4
        ? 'grid-cols-2'
        : 'grid-cols-3';
  return (
    <div className={`grid max-w-md gap-1 ${gridCols}`}>
      {items.map((item, i) => (
        <div
          key={i}
          className={`relative overflow-hidden rounded-md bg-discord-panel ${item.spoiler ? 'spoiler-blur' : ''}`}
        >
          {item.media.url ? (
            <img
              src={item.media.url}
              alt={item.description ?? ''}
              className="h-36 w-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="grid h-36 place-items-center text-xs text-discord-muted">no URL</div>
          )}
        </div>
      ))}
    </div>
  );
}

function FilePreview({ node }: { node: ComponentNode }) {
  const d = node.data as Extract<ComponentNode['data'], { type: ComponentType.File }>;
  const name = d.file?.url?.replace(/^attachment:\/\//i, '') || 'file';
  return (
    <div
      className={`inline-flex max-w-md items-center gap-2 rounded-lg border border-discord-panel bg-discord-base-deep px-3 py-2.5 ${d.spoiler ? 'spoiler-blur' : ''}`}
    >
      <span className="text-lg">📄</span>
      <span className="truncate text-sm text-discord-accent">{name}</span>
    </div>
  );
}

function SeparatorPreview({ node }: { node: ComponentNode }) {
  const d = node.data as Extract<ComponentNode['data'], { type: ComponentType.Separator }>;
  const large = d.spacing === SeparatorSpacing.Large;
  return (
    <div className={large ? 'my-2' : 'my-0.5'}>
      {d.divider !== false && <hr className="border-discord-panel" />}
    </div>
  );
}

function ActionRowPreview({ node }: { node: ComponentNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-0.5">
      {node.children.length === 0 ? (
        <p className="text-xs italic text-discord-muted">Empty action row</p>
      ) : (
        node.children.map((c) => {
          if (c.type === ComponentType.Button) return <ButtonPreview key={c.key} node={c} />;
          return <SelectPreview key={c.key} node={c} />;
        })
      )}
    </div>
  );
}

function ButtonPreview({ node }: { node: ComponentNode }) {
  const d = node.data as Extract<ComponentNode['data'], { type: ComponentType.Button }>;
  const bg = {
    [ButtonStyle.Primary]: 'bg-[#5865f2] hover:bg-[#4752c4]',
    [ButtonStyle.Secondary]: 'bg-[#4e5058] hover:bg-[#6d6f78]',
    [ButtonStyle.Success]: 'bg-[#248046] hover:bg-[#1a6334]',
    [ButtonStyle.Danger]: 'bg-[#da373c] hover:bg-[#a12d31]',
    [ButtonStyle.Link]: 'bg-[#4e5058] hover:bg-[#6d6f78]',
  }[d.style] ?? 'bg-[#4e5058]';
  return (
    <span
      className={`inline-flex cursor-default items-center gap-1.5 rounded px-4 py-2 text-sm font-medium text-white ${bg} ${d.disabled ? 'opacity-50' : ''}`}
    >
      {d.emoji?.name && !d.emoji.id && <span>{d.emoji.name}</span>}
      {d.label}
    </span>
  );
}

function SelectPreview({ node }: { node: ComponentNode }) {
  const d = node.data as Extract<
    ComponentNode['data'],
    { type: ComponentType.StringSelect | ComponentType.UserSelect | ComponentType.RoleSelect | ComponentType.MentionableSelect | ComponentType.ChannelSelect }
  >;
  return (
    <div className="flex w-full max-w-md items-center justify-between rounded border border-discord-panel bg-discord-base-deep px-3 py-2.5">
      <span className="truncate text-sm text-discord-muted">{d.placeholder || 'Make a selection'}</span>
      <span className="ml-2 text-xs text-discord-muted">▾</span>
    </div>
  );
}
