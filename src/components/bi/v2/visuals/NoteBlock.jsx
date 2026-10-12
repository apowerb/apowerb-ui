"use client";

import { Fragment } from "react";
import { useTranslations } from "use-intl";

// Light markdown: **bold**, `code`, "- " lists, paragraphs. Nothing else is
// interpreted, and no HTML is ever injected.
function inline(text, keyPrefix) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(<Fragment key={`${keyPrefix}-${n++}`}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={`${keyPrefix}-${n++}`} className="font-semibold th-text">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <code
          key={`${keyPrefix}-${n++}`}
          className="rounded px-1 py-0.5 font-mono text-[0.85em] th-bg-surface"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(<Fragment key={`${keyPrefix}-${n++}`}>{text.slice(last)}</Fragment>);
  return out;
}

export function parseNote(markdown) {
  const blocks = [];
  let list = null;
  for (const raw of String(markdown ?? "").split(/\r?\n/)) {
    const line = raw.trimEnd();
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (!list) {
        list = { type: "list", items: [] };
        blocks.push(list);
      }
      list.items.push(item[1]);
    } else if (line.trim() === "") {
      list = null;
    } else {
      list = null;
      const head = /^#{1,4}\s+(.*)$/.exec(line);
      blocks.push(head ? { type: "heading", text: head[1] } : { type: "p", text: line });
    }
  }
  return blocks;
}

const BADGE_STYLE = {
  real: "var(--v2-good)",
  simulated: "var(--v2-warn)",
  forecast: "var(--v2-accent)",
};

export function ProvenanceBadge({ kind }) {
  const t = useTranslations("DashboardV2");
  const color = BADGE_STYLE[kind] || "var(--v2-muted)";
  return (
    <span
      data-provenance={kind}
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {t(`provenance.${kind}`)}
    </span>
  );
}

export default function NoteBlock({ result }) {
  const blocks = parseNote(result?.text);
  const badges = result?.badges || [];
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto text-xs leading-relaxed th-text-secondary" data-testid="v2-note">
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <ProvenanceBadge key={b} kind={b} />
          ))}
        </div>
      )}
      {blocks.map((b, i) =>
        b.type === "list" ? (
          <ul key={i} className="list-disc space-y-0.5 pl-4">
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, `${i}-${j}`)}</li>
            ))}
          </ul>
        ) : b.type === "heading" ? (
          <h4 key={i} className="text-xs font-semibold th-text">
            {inline(b.text, `h${i}`)}
          </h4>
        ) : (
          <p key={i}>{inline(b.text, `p${i}`)}</p>
        ),
      )}
    </div>
  );
}
