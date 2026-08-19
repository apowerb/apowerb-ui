"use client";

/**
 * Renders an artifact's body: numbered source, or a sandboxed preview for HTML.
 *
 * Shared by the chat side panel and the artifacts library so both screens stay
 * visually identical — and so the iframe sandbox attributes are declared once.
 */

function LineNumbers({ count }) {
  return (
    <div className="select-none text-right pr-3 th-text-ghost text-[11px] leading-[1.4rem] font-mono">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  );
}

/** What a browser can render on its own, given the bytes and a type. */
function canBrowserDisplay(mimeType) {
  return (
    mimeType === "application/pdf" ||
    mimeType?.startsWith("image/") ||
    mimeType?.startsWith("text/")
  );
}

export default function ArtifactCodeView({
  code,
  language,
  showPreview = false,
  previewTitle,
  emptyLabel,
  binaryUrl,
  binaryType,
}) {
  const isHtml = language === "html";

  // A PDF has no source to show, but it is not unshowable: the browser has a
  // viewer for it. Describing the file was only ever a fallback for the case
  // where it cannot be rendered at all -- an archive, a spreadsheet.
  if (binaryUrl) {
    if (!canBrowserDisplay(binaryType)) {
      return <div className="p-4 th-text-faint text-sm italic">{emptyLabel}</div>;
    }
    return (
      <iframe
        src={binaryUrl}
        className="w-full h-full bg-white"
        title={previewTitle}
        tabIndex={0}
      />
    );
  }

  if (showPreview && isHtml) {
    return (
      <iframe
        srcDoc={code}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        className="w-full h-full bg-white"
        title={previewTitle}
        tabIndex={0}
      />
    );
  }

  if (!code) {
    return (
      <div className="p-4 th-text-faint text-sm italic">{emptyLabel}</div>
    );
  }

  const lines = code.split("\n");

  return (
    <div className="flex text-xs font-mono p-3">
      <LineNumbers count={lines.length} />
      <pre className="flex-1 overflow-x-auto th-text-secondary leading-[1.4rem] whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
