"use client";

import { useCallback } from "react";

const URL_REGEX = /^https?:\/\/[^\s]+$/i;

/**
 * Hook that turns a plain <textarea> into a markdown-aware editor:
 *
 *   - **Keyboard shortcuts**
 *       Ctrl/Cmd+B  → wrap selection in `**…**`
 *       Ctrl/Cmd+I  → wrap selection in `*…*`
 *       Ctrl/Cmd+E  → wrap selection in `` `…` ``
 *       Ctrl/Cmd+K  → wrap selection in `[text](url|)` with cursor on url
 *       Ctrl/Cmd+Shift+Period → prepend `> ` to the current line(s)
 *
 *   - **Smart list continuation**
 *       Enter on a line starting with `- `, `* `, or `N. ` adds the next
 *       marker. On an empty marker line, Enter removes the marker.
 *       Shift+Enter always produces a raw newline.
 *
 *   - **Paste URL over selection**
 *       Pasting a URL while text is selected wraps the selection in
 *       `[selection](url)`.
 *
 * The hook returns `{ handleKeyDown, handlePaste, applyAction }`.
 * `handleKeyDown` and `handlePaste` are meant to be composed with the
 * caller's own handlers (e.g. submit on Enter, paste files). They return
 * `true` when they've consumed the event, so the caller can early-exit.
 *
 * `applyAction(action)` lets the caller drive actions from a toolbar.
 * Supported actions: bold, italic, code, link, ul, quote.
 */
export function useMarkdownTextarea(textareaRef, { value, setValue } = {}) {
  // --- Low-level helpers -------------------------------------------------

  const getSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return null;
    return { start: ta.selectionStart, end: ta.selectionEnd };
  }, [textareaRef]);

  const setSelection = useCallback(
    (start, end = start) => {
      const ta = textareaRef.current;
      if (!ta) return;
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = start;
        ta.selectionEnd = end;
      });
    },
    [textareaRef],
  );

  /** Replace [start, end) with `replacement`, update value, reposition caret. */
  const replaceRange = useCallback(
    (start, end, replacement, selection) => {
      const next =
        (value ?? "").slice(0, start) + replacement + (value ?? "").slice(end);
      setValue?.(next);
      if (selection != null) {
        const [selStart, selEnd = selStart] = Array.isArray(selection)
          ? selection
          : [selection];
        setSelection(selStart, selEnd);
      } else {
        setSelection(start + replacement.length);
      }
    },
    [value, setValue, setSelection],
  );

  /** Wrap the current selection with `before` / `after`. Empty selection
   *  inserts both markers and positions the caret between them. */
  const wrapSelection = useCallback(
    (before, after = before, placeholder = "") => {
      const sel = getSelection();
      if (!sel) return;
      const { start, end } = sel;
      const selected = (value ?? "").slice(start, end);
      const content = selected || placeholder;
      const replacement = `${before}${content}${after}`;

      if (selected) {
        const newStart = start + before.length;
        const newEnd = newStart + content.length;
        replaceRange(start, end, replacement, [newStart, newEnd]);
      } else {
        const caret = start + before.length;
        replaceRange(start, end, replacement, [caret, caret + placeholder.length]);
      }
    },
    [value, getSelection, replaceRange],
  );

  const prefixLines = useCallback(
    (prefix) => {
      const sel = getSelection();
      if (!sel) return;
      const { start, end } = sel;
      const str = value ?? "";
      const lineStart = str.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const lineEnd = (() => {
        const idx = str.indexOf("\n", end);
        return idx === -1 ? str.length : idx;
      })();
      const block = str.slice(lineStart, lineEnd);
      const lines = block.split("\n").map((l) => `${prefix}${l}`);
      const replacement = lines.join("\n");
      const delta = prefix.length * lines.length;
      replaceRange(lineStart, lineEnd, replacement, [
        start + prefix.length,
        end + delta,
      ]);
    },
    [value, getSelection, replaceRange],
  );

  const insertLink = useCallback(() => {
    const sel = getSelection();
    if (!sel) return;
    const { start, end } = sel;
    const selected = (value ?? "").slice(start, end);
    const text = selected || "text";
    const replacement = `[${text}](url)`;
    // Position caret on `url` so the user can paste/type the URL immediately.
    const urlStart = start + text.length + 3; // `[text](` length
    const urlEnd = urlStart + 3; // `url`
    replaceRange(start, end, replacement, [urlStart, urlEnd]);
  }, [value, getSelection, replaceRange]);

  // --- Actions dispatcher (toolbar) --------------------------------------

  const applyAction = useCallback(
    (action) => {
      switch (action) {
        case "bold":
          wrapSelection("**", "**", "bold");
          return;
        case "italic":
          wrapSelection("*", "*", "italic");
          return;
        case "code":
          wrapSelection("`", "`", "code");
          return;
        case "link":
          insertLink();
          return;
        case "ul":
          prefixLines("- ");
          return;
        case "quote":
          prefixLines("> ");
          return;
        default:
          return;
      }
    },
    [wrapSelection, insertLink, prefixLines],
  );

  // --- Smart list continuation -------------------------------------------

  /** Returns list-marker info for the line containing `caret`, or null. */
  const detectLineMarker = useCallback(
    (caret) => {
      const str = value ?? "";
      const lineStart = str.lastIndexOf("\n", caret - 1) + 1;
      const lineEnd = (() => {
        const idx = str.indexOf("\n", caret);
        return idx === -1 ? str.length : idx;
      })();
      const line = str.slice(lineStart, lineEnd);

      // Unordered list: `- ` / `* ` / `+ ` (with optional leading spaces)
      const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
      if (ulMatch) {
        return {
          lineStart,
          lineEnd,
          indent: ulMatch[1],
          marker: `${ulMatch[2]} `,
          body: ulMatch[3],
          kind: "ul",
        };
      }

      // Ordered list: `1. ` `2. ` etc.
      const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (olMatch) {
        return {
          lineStart,
          lineEnd,
          indent: olMatch[1],
          marker: `${olMatch[2]}. `,
          number: parseInt(olMatch[2], 10),
          body: olMatch[3],
          kind: "ol",
        };
      }

      return null;
    },
    [value],
  );

  // --- Key handler -------------------------------------------------------

  const handleKeyDown = useCallback(
    (e) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Shortcuts
      if (isMod) {
        const key = e.key.toLowerCase();
        if (key === "b") {
          e.preventDefault();
          applyAction("bold");
          return true;
        }
        if (key === "i") {
          e.preventDefault();
          applyAction("italic");
          return true;
        }
        if (key === "e") {
          e.preventDefault();
          applyAction("code");
          return true;
        }
        if (key === "k") {
          e.preventDefault();
          applyAction("link");
          return true;
        }
        if (e.shiftKey && (e.key === "." || e.key === ">")) {
          e.preventDefault();
          applyAction("quote");
          return true;
        }
      }

      // Smart list continuation on Enter (but not Shift+Enter)
      if (e.key === "Enter" && !e.shiftKey && !isMod) {
        const sel = getSelection();
        if (!sel || sel.start !== sel.end) return false;
        const marker = detectLineMarker(sel.start);
        if (!marker) return false;

        // Empty marker line → remove the marker (Markdown convention)
        if (marker.body.trim() === "") {
          e.preventDefault();
          replaceRange(marker.lineStart, marker.lineEnd, marker.indent);
          return true;
        }

        // Non-empty → insert next marker
        e.preventDefault();
        const nextMarker =
          marker.kind === "ol"
            ? `${marker.indent}${marker.number + 1}. `
            : `${marker.indent}${marker.marker}`;
        const insertion = `\n${nextMarker}`;
        replaceRange(sel.start, sel.end, insertion);
        return true;
      }

      return false;
    },
    [applyAction, detectLineMarker, getSelection, replaceRange],
  );

  // --- Paste handler (URL over selection) --------------------------------

  const handlePaste = useCallback(
    (e) => {
      const text = e.clipboardData?.getData("text/plain") || "";
      if (!text || !URL_REGEX.test(text.trim())) return false;
      const sel = getSelection();
      if (!sel || sel.start === sel.end) return false;
      e.preventDefault();
      const { start, end } = sel;
      const selected = (value ?? "").slice(start, end);
      const replacement = `[${selected}](${text.trim()})`;
      replaceRange(start, end, replacement);
      return true;
    },
    [value, getSelection, replaceRange],
  );

  return { handleKeyDown, handlePaste, applyAction };
}
