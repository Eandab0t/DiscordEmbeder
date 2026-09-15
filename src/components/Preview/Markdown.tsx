import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Discord entities (`<@id>`, `<@&id>`, `<#id>`, `<t:epoch:style>`, custom
 * emoji) render as styled chips/images in real messages. Each is substituted
 * with a sentinel markdown image before parsing; the img renderer swaps it
 * back for the real chip. Code segments are skipped — Discord keeps entities
 * literal inside code blocks/spans.
 */
const ENTITY_RE =
  /(<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>|<@!?\d{17,20}>|<@&\d{17,20}>|<#\d{17,20}>|<t:\d{1,13}(?::[tTdDFfR])?>)/g;
const CODE_SPLIT_RE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;
const SENTINEL = 'discord-entity/';

export function substituteEntities(text: string): string {
  return text
    .split(CODE_SPLIT_RE)
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(ENTITY_RE, (token) => `![entity](${SENTINEL}${encodeURIComponent(token)})`),
    )
    .join('');
}

const TS_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  t: { timeStyle: 'short' },
  T: { timeStyle: 'medium' },
  d: { dateStyle: 'short' },
  D: { dateStyle: 'long' },
  f: { dateStyle: 'long', timeStyle: 'short' },
  F: { dateStyle: 'full', timeStyle: 'short' },
};

const DIVISORS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_557_600],
  ['month', 2_629_800],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** Discord `<t:epoch:style>` rendering, approximated with Intl in the viewer's timezone. */
export function formatTimestamp(epochSec: number, style = 'f'): string {
  if (style === 'R') {
    const diff = epochSec - Date.now() / 1000;
    const [unit, sec] = DIVISORS.find(([, s]) => Math.abs(diff) >= s) ?? DIVISORS[DIVISORS.length - 1];
    return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(Math.round(diff / sec), unit);
  }
  return new Intl.DateTimeFormat('en-US', TS_STYLES[style] ?? TS_STYLES.f).format(
    new Date(epochSec * 1000),
  );
}

function EntityChip({ token }: { token: string }) {
  const pill = 'rounded-[3px] bg-[#5865f2]/30 px-1 font-medium text-[#dee0fc]';
  if (token.startsWith('<t:')) {
    const [, epoch, style] = /^<t:(\d{1,13})(?::([tTdDFfR]))?>$/.exec(token) ?? [];
    return <span className={pill}>{formatTimestamp(Number(epoch), style)}</span>;
  }
  if (token.startsWith('<@') || token.startsWith('<#')) {
    const [, id] = /^<(?:@!?|@&|#)(\d{17,20})>$/.exec(token) ?? [];
    const name = token.includes('@&') ? '@role' : token.startsWith('<#') ? '#channel' : '@user';
    return (
      <span className={pill} title={id ? `id: ${id}` : undefined}>
        {name}
      </span>
    );
  }
  const [, animated, name, id] = /^<(a?):([A-Za-z0-9_]{2,32}):(\d{17,20})>$/.exec(token) ?? [];
  return (
    <img
      src={`https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=44&quality=lossless`}
      alt={name}
      title={`:${name}:`}
      className="mx-px inline-block h-[1.375em] align-[-0.25em]"
    />
  );
}

/**
 * Discord-flavored markdown approximation for the live preview:
 * GFM (tables, strikethrough, autolinks) + Discord's #-heading sizing.
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="dc-md [&_a]:text-[#00a8fc] [&_a]:no-underline [&_a:hover]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-discord-panel [&_blockquote]:pl-3 [&_blockquote]:text-discord-text [&_code]:rounded [&_code]:bg-discord-sidebar [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[85%] [&_code]:text-discord-text [&_h1]:mb-2 [&_h1]:mt-1 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:mb-2 [&_h2]:mt-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h3]:mb-1 [&_h3]:font-bold [&_h3]:text-white [&_hr]:border-discord-panel [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-0.5 [&_pre]:my-1 [&_pre]:rounded [&_pre]:bg-discord-sidebar [&_pre]:p-2 [&_pre]:text-[85%] [&_strong]:text-white [&_table]:my-1 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-discord-panel [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-discord-panel [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer noopener" />,
          img: ({ src }) => {
            const s = String(src ?? '');
            return s.startsWith(SENTINEL) ? (
              <EntityChip token={decodeURIComponent(s.slice(SENTINEL.length))} />
            ) : (
              <img src={s} alt="" />
            );
          },
        }}
      >
        {substituteEntities(text)}
      </ReactMarkdown>
    </div>
  );
}
