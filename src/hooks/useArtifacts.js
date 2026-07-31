"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { listArtifacts, loadArtifact } from "@/lib/api";

const FENCED_CODE_RE = /```(\w+)?\n([\s\S]*?)```/g;

export function useArtifacts(messages, sessionMeta, { autoOpen = false } = {}) {
  const [selectedArtifactId, setSelectedArtifactId] = useState(null);
  const [adkArtifacts, setAdkArtifacts] = useState([]);
  const [adkArtifactContents, setAdkArtifactContents] = useState({});
  const [refreshCounter, setRefreshCounter] = useState(0);
  const lastFetchKey = useRef("");
  const prevInlineCountRef = useRef(0);

  // sessionMeta: { agentName, userId, sessionId }
  const agentName = sessionMeta?.agentName;
  const userId = sessionMeta?.userId;
  const sessionId = sessionMeta?.sessionId;

  // Fetch ADK artifacts list when session changes or refresh triggered
  useEffect(() => {
    if (!agentName || !userId || !sessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset artifact list when session becomes invalid
      setAdkArtifacts([]);
      return;
    }

    const fetchKey = `${agentName}/${userId}/${sessionId}/${refreshCounter}`;
    if (fetchKey === lastFetchKey.current) return;
    lastFetchKey.current = fetchKey;

    let cancelled = false;
    listArtifacts(agentName, userId, sessionId)
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setAdkArtifacts(list);
        }
      })
      .catch((err) => {
        console.warn("[useArtifacts] Failed to fetch ADK artifacts:", err);
        if (!cancelled) setAdkArtifacts([]);
      });

    return () => { cancelled = true; };
  }, [agentName, userId, sessionId, refreshCounter]);

  // Load artifact content on demand
  const loadArtifactContent = useCallback(
    async (filename) => {
      if (!agentName || !userId || !sessionId) return null;
      if (adkArtifactContents[filename]) return adkArtifactContents[filename];
      try {
        const data = await loadArtifact(agentName, userId, sessionId, filename);
        setAdkArtifactContents((prev) => ({ ...prev, [filename]: data }));
        return data;
      } catch (err) {
        console.warn("[useArtifacts] Failed to load artifact:", filename, err);
        return null;
      }
    },
    [agentName, userId, sessionId, adkArtifactContents],
  );

  // Refresh function
  const refreshArtifacts = useCallback(() => {
    setRefreshCounter((c) => c + 1);
  }, []);

  // Inline artifacts extracted via regex
  const inlineArtifacts = useMemo(() => {
    const result = [];
    if (!messages) return result;
    const usedNames = new Set();

    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.content) continue;

      let match;
      const fencedCodeRe = new RegExp(FENCED_CODE_RE.source, FENCED_CODE_RE.flags);
      let blockIndex = 0;

      while ((match = fencedCodeRe.exec(msg.content)) !== null) {
        const language = match[1] || "text";
        const code = match[2];
        if (code.trim().length < 20) continue;

        const textBefore = msg.content.slice(0, match.index);
        let filename = _extractFilename(textBefore, code, language);
        if (!filename) {
          filename = _inferFilename(code, language, blockIndex);
        }
        // Deduplicate within the same session
        if (usedNames.has(filename)) {
          const base = filename.replace(/\.\w+$/, "");
          const ext = filename.slice(base.length);
          let n = 2;
          while (usedNames.has(`${base}_${n}${ext}`)) n++;
          filename = `${base}_${n}${ext}`;
        }
        usedNames.add(filename);

        result.push({
          id: `inline-${msg.id}-${blockIndex}`,
          filename,
          language,
          code: code.trimEnd(),
          source: "inline",
          version: null,
          messageId: msg.id,
        });
        blockIndex++;
      }
    }

    return result;
  }, [messages]);

  // Merge ADK + inline artifacts (ADK first, then inline not covered by ADK)
  const artifacts = useMemo(() => {
    const adkMapped = adkArtifacts.map((a) => ({
      id: `adk-${a.filename}`,
      filename: a.filename,
      language: a.language,
      code: adkArtifactContents[a.filename]?.code || null,
      source: "adk",
      version: a.version,
    }));

    const adkFilenames = new Set(adkArtifacts.map((a) => a.filename));
    const filteredInline = inlineArtifacts.filter(
      (a) => !adkFilenames.has(a.filename),
    );

    return [...adkMapped, ...filteredInline];
  }, [adkArtifacts, adkArtifactContents, inlineArtifacts]);

  // Auto-open: select the latest inline artifact when a new one appears during streaming
  useEffect(() => {
    if (!autoOpen) return;
    const count = inlineArtifacts.length;
    if (count > prevInlineCountRef.current && count > 0) {
      const latestId = inlineArtifacts[count - 1].id;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: auto-select latest artifact when a new one appears during streaming
      setSelectedArtifactId(latestId);
    }
    prevInlineCountRef.current = count;
  }, [autoOpen, inlineArtifacts]);

  // When selecting an ADK artifact, load its content if not yet loaded
  const selectArtifact = useCallback(
    async (id) => {
      setSelectedArtifactId(id);
      if (id && id.startsWith("adk-")) {
        const filename = id.replace("adk-", "");
        await loadArtifactContent(filename);
      }
    },
    [loadArtifactContent],
  );

  // Inject an artifact immediately (from SSE stream) without waiting for backend refresh
  const injectArtifact = useCallback(({ filename, language, code }) => {
    if (!filename || !code) return;
    setAdkArtifacts((prev) => {
      const exists = prev.some((a) => a.filename === filename);
      if (exists) return prev;
      return [...prev, { filename, language, version: 0 }];
    });
    setAdkArtifactContents((prev) => ({ ...prev, [filename]: { code } }));
  }, []);

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId) || null;

  return {
    artifacts,
    selectedArtifact,
    selectArtifact,
    clearSelection: () => setSelectedArtifactId(null),
    refreshArtifacts,
    injectArtifact,
    loadArtifactContent,
  };
}

/**
 * Try to extract a meaningful filename from the text preceding a code block
 * or from the first line of the code itself.
 */
function _extractFilename(textBefore, code, language) {
  // Take only the last ~300 chars before the code block for context
  const ctx = textBefore.slice(-300);

  // Pattern 1: filename in backticks near the end — e.g., `index.html`
  const backtick = ctx.match(/`([^`]*?[\w-]+\.\w{1,10})`[^`]{0,40}$/);
  if (backtick) return backtick[1].split("/").pop();

  // Pattern 2: bold filename — e.g., **styles.css**
  const bold = ctx.match(/\*\*([^*]*?[\w-]+\.\w{1,10})\*\*[^*]{0,40}$/);
  if (bold) return bold[1].split("/").pop();

  // Pattern 3: "File:" or filename on its own line — e.g., "File: app.py" or "app.py:"
  const line = ctx.match(/(?:^|\n)\s*(?:File:\s*)?(\w[\w. /-]*?[\w-]+\.\w{1,10})\s*:?\s*$/i);
  if (line) return line[1].split("/").pop();

  // Pattern 4: first comment in code — e.g., # filename.py  // filename.js  <!-- file.html -->
  const firstLine = code.split("\n")[0]?.trim();
  if (firstLine) {
    const comment = firstLine.match(/^(?:\/\/|#|<!--|\/\*)\s*([\w][\w./-]*?[\w-]+\.\w{1,10})/);
    if (comment) return comment[1].split("/").pop();
  }

  return null;
}

/**
 * Infer a meaningful filename from the code content itself.
 */
function _inferFilename(code, language, blockIndex) {
  const ext = _extForLang(language);
  const lang = language?.toLowerCase();

  // HTML: look for <title> tag
  if (lang === "html") {
    const title = code.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i);
    if (title) return _slugify(title[1]) + "." + ext;
    // Look for main heading or id
    const h1 = code.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
    if (h1) return _slugify(h1[1]) + "." + ext;
  }

  // CSS: look for first meaningful selector or comment description
  if (lang === "css") {
    const comment = code.match(/\/\*\s*(.+?)\s*\*\//);
    if (comment) return _slugify(comment[1].slice(0, 30)) + "." + ext;
    const selector = code.match(/^([.#]?[\w-]+)\s*\{/m);
    if (selector) return _slugify(selector[1]) + "-styles." + ext;
  }

  // JS/TS/JSX/TSX: look for component, class, or main function
  if (["js", "javascript", "ts", "typescript", "jsx", "tsx"].includes(lang)) {
    // React component: export default function Foo / const Foo =
    const component = code.match(/(?:export\s+default\s+)?(?:function|const)\s+([A-Z][\w]*)/);
    if (component) return component[1] + "." + ext;
    // Class
    const cls = code.match(/class\s+(\w+)/);
    if (cls) return cls[1] + "." + ext;
    // Named export function
    const fn = code.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (fn) return fn[1] + "." + ext;
  }

  // Python: look for class or main function
  if (["python", "py"].includes(lang)) {
    const cls = code.match(/^class\s+(\w+)/m);
    if (cls) return _slugify(cls[1]) + "." + ext;
    const fn = code.match(/^def\s+(\w+)/m);
    if (fn) return fn[1] + "." + ext;
  }

  // SQL: look for table name
  if (lang === "sql") {
    const table = code.match(/(?:CREATE|ALTER|INSERT INTO|SELECT.*FROM)\s+(?:TABLE\s+)?[`"]?(\w+)/i);
    if (table) return table[1] + "-query." + ext;
  }

  // JSON: look for a descriptive top-level key
  if (lang === "json") {
    try {
      const parsed = JSON.parse(code);
      const name = parsed.name || parsed.title || parsed.id;
      if (typeof name === "string") return _slugify(name.slice(0, 30)) + "." + ext;
    } catch {}
  }

  // Bash/shell: look for shebang or first command
  if (["bash", "sh", "shell"].includes(lang)) {
    const firstCmd = code.split("\n").find((l) => l.trim() && !l.trim().startsWith("#"));
    if (firstCmd) {
      const cmd = firstCmd.trim().split(/\s+/)[0];
      return _slugify(cmd) + "-script." + ext;
    }
  }

  // Fallback: use language + index
  return `${lang || "code"}_${blockIndex + 1}.${ext}`;
}

function _slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "file";
}

function _extForLang(language) {
  const map = {
    python: "py",
    javascript: "js",
    js: "js",
    bash: "sh",
    sh: "sh",
    ruby: "rb",
    go: "go",
    html: "html",
    css: "css",
    sql: "sql",
    json: "json",
    yaml: "yml",
    typescript: "ts",
    tsx: "tsx",
    jsx: "jsx",
  };
  return map[language?.toLowerCase()] || "txt";
}
