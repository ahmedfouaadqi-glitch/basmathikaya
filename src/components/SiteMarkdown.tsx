// Minimal Markdown renderer — supports **bold**, _italic_, `code`, [text](url),
// - list items, and paragraph breaks. Good enough for editable site copy.
import { Fragment, type ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={i++}>{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<strong key={i++}>{m[3]}</strong>);
    else if (m[4] !== undefined) nodes.push(<em key={i++}>{m[4]}</em>);
    else if (m[5] !== undefined) nodes.push(<code key={i++} className="rounded bg-muted px-1 py-0.5 text-xs">{m[5]}</code>);
    else if (m[6] !== undefined && m[7] !== undefined) {
      const href = m[7];
      const external = /^https?:/i.test(href);
      nodes.push(
        <a key={i++} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="underline hover:opacity-80">
          {m[6]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function SiteMarkdown({ source, className }: { source: string; className?: string }) {
  const lines = (source ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={k++}>{renderInline(para.join(" "))}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={k++} className="list-disc space-y-1 pr-6">
          {list.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      list.push(li[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return <div className={className}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
