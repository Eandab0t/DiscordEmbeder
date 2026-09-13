import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
